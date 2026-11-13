// @ts-nocheck — Deno edge function
/**
 * RecruitScout MCP server (Streamable HTTP, JSON responses).
 *
 *   POST https://<supabase>/functions/v1/mcp/<key>
 *   or   POST .../functions/v1/mcp  with  Authorization: Bearer <key>
 *
 * - The key is a personal MCP key from Settings (create_mcp_key). Only its
 *   sha256 hash is stored; unknown or revoked keys get 401.
 * - Each request runs as the key's owner: a one-hour user token is signed with
 *   JWT_SECRET so RPCs and row security see that user.
 * - Tools are the dashboard Assistant's own tools (runtime.js, generated from
 *   src/mcp/runtime.ts by `npm run build:mcp`). Browser-only tools are relayed to a
 *   RecruitScout extension through mcp_bridge_commands.
 * - Every tool call is logged to mcp_tool_runs.
 */
import { callTool, handleRpc, withCaller } from "./runtime.js";

const MODEL = "gpt-6-astra";
const BRIDGE_WAIT_MS = 25_000;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://kong:8000";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const JWT_SECRET = Deno.env.get("JWT_SECRET") || "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", ...extra } });

// ── Helpers ──────────────────────────────────────────────────────────────────

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array | string) => {
  const raw = typeof bytes === "string" ? enc.encode(bytes) : bytes;
  let s = "";
  for (const b of raw) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value)));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** HS256 user token, the same shape GoTrue issues, valid for one hour. */
async function signUserToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    sub: userId, role: "authenticated", aud: "authenticated", iss: "supabase", iat: now, exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey("raw", enc.encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${header}.${payload}`)));
  return `${header}.${payload}.${b64url(sig)}`;
}

/** PostgREST as the service role (server-only tables: keys, audit, relay). */
async function admin(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Database HTTP ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

function keyFrom(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (bearer.startsWith("rs_")) return bearer;
  const segment = new URL(req.url).pathname.split("/").filter(Boolean).pop() || "";
  return segment.startsWith("rs_") ? segment : "";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Hand an extension message to a RecruitScout browser and wait for its answer. */
async function relay(userId: string, message: any, agent?: string): Promise<any> {
  const [row] = await admin("mcp_bridge_commands", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, agent: agent || null, message }),
  });
  const deadline = Date.now() + BRIDGE_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(1500);
    const [cur] = await admin(`mcp_bridge_commands?id=eq.${row.id}&select=status,result,claimed_by`);
    if (cur?.status === "done") return cur.result?.data ?? { success: true };
    if (cur?.status === "failed") throw new Error(cur.result?.error || `The browser ${cur.claimed_by || ""} could not do it.`.trim());
  }
  throw new Error(
    `No RecruitScout browser${agent ? ` named "${agent}"` : ""} answered within ${BRIDGE_WAIT_MS / 1000} seconds. `
    + `The command is queued as ${row.id} for 10 minutes; check it with get_bridge_command. `
    + `Browsers pick commands up every 30 seconds while the extension is running.`,
  );
}

async function openai(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  if (!OPENAI_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not set on the server." }), { status: 500 });
  }
  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, instructions: body.instructions, input: body.input, tools: body.tools, tool_choice: "auto", stream: false,
    }),
    signal,
  });
  if (upstream.ok) return upstream;
  const detail = (await upstream.text()).slice(0, 500);
  const status = upstream.status === 429 || upstream.status >= 500 ? upstream.status : 502;
  return new Response(JSON.stringify({ error: `OpenAI returned HTTP ${upstream.status}.`, detail }), { status });
}

function summarize(args: unknown): string {
  try { return JSON.stringify(args ?? {}).slice(0, 500); } catch { return ""; }
}

// ── Server ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    // No server-initiated stream and no sessions: POST only
    return json(405, { error: "Use POST for MCP requests." }, { Allow: "POST, OPTIONS" });
  }

  const key = keyFrom(req);
  if (!key) return json(401, { error: "Missing MCP key. Generate an MCP URL in RecruitScout Settings." });
  if (!SERVICE_KEY || !JWT_SECRET) return json(500, { error: "The MCP server is not configured." });

  let keyRow: any;
  try {
    const hash = await sha256Hex(key);
    [keyRow] = await admin(`mcp_keys?key_hash=eq.${hash}&revoked_at=is.null&select=id,user_id`);
  } catch {
    return json(503, { error: "Couldn't check the MCP key. Try again." });
  }
  if (!keyRow) return json(401, { error: "This MCP key is not valid or has been revoked." });

  admin(`mcp_keys?id=eq.${keyRow.id}`, {
    method: "PATCH", body: JSON.stringify({ last_used_at: new Date().toISOString() }), headers: { Prefer: "return=minimal" },
  }).catch(() => {});

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }

  const caller = {
    userId: keyRow.user_id,
    accessToken: await signUserToken(keyRow.user_id),
    bridge: (message: any, agent?: string) => relay(keyRow.user_id, message, agent),
    openai,
  };

  const run = async (name: string, args: unknown) => {
    const started = Date.now();
    let result;
    if (name === "get_bridge_command") {
      const id = (args as any)?.id;
      const [row] = typeof id === "string"
        ? await admin(`mcp_bridge_commands?id=eq.${encodeURIComponent(id)}&user_id=eq.${keyRow.user_id}&select=id,status,agent,claimed_by,result,created_at,done_at`)
        : [];
      result = row
        ? { content: [{ type: "text", text: JSON.stringify(row, null, 1) }], isError: false }
        : { content: [{ type: "text", text: "No command with that id." }], isError: true };
    } else {
      result = await withCaller(caller, () => callTool(name, args, caller));
    }
    admin("mcp_tool_runs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        key_id: keyRow.id, user_id: keyRow.user_id, tool_name: name, args_summary: summarize(args),
        ok: !result.isError, error: result.isError ? result.content?.[0]?.text?.slice(0, 500) : null,
        duration_ms: Date.now() - started,
      }),
    }).catch(() => {});
    return result;
  };

  const messages = Array.isArray(body) ? body : [body];
  const replies = (await Promise.all(messages.map((m) => handleRpc(m, run)))).filter(Boolean);

  if (!replies.length) return new Response(null, { status: 202, headers: corsHeaders });
  return json(200, Array.isArray(body) ? replies : replies[0]);
});

