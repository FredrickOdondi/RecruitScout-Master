// @ts-nocheck — Deno edge function
/**
 * RecruitScout Assistant model proxy.
 *
 * - Holds OPENAI_API_KEY on the server; the browser never sees it.
 * - Requires a signed-in Supabase user, checked before anything else.
 * - Pins the model; the client cannot choose another one.
 * - Streams the OpenAI Responses API back as server-sent events.
 * Tools are executed in the dashboard, not here.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MODEL = "gpt-6-astra";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // 1. Signed-in user first: an anon key or missing token never reaches OpenAI
  const authHeader = req.headers.get("Authorization") || "";
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return json(401, { error: "Sign in to use the Assistant." });
  } catch {
    return json(401, { error: "Sign in to use the Assistant." });
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return json(500, { error: "The Assistant is not configured on the server (OPENAI_API_KEY missing)." });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  if (!Array.isArray(body.input)) return json(400, { error: "input must be an array (Responses API)." });

  const stream = body.stream === true;
  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        instructions: typeof body.instructions === "string" ? body.instructions : undefined,
        input: body.input,
        tools: Array.isArray(body.tools) ? body.tools : undefined,
        tool_choice: "auto",
        stream,
      }),
    });
  } catch (e) {
    return json(502, { error: "Couldn't reach OpenAI.", detail: String(e?.message || e) });
  }

  if (!upstream.ok) {
    const detail = (await upstream.text()).slice(0, 800);
    // Pass rate limits and outages through so the client can retry
    const status = upstream.status === 429 || upstream.status >= 500 ? upstream.status : 502;
    return json(status, { error: `OpenAI returned HTTP ${upstream.status}.`, detail });
  }

  if (stream && upstream.body) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  }
  return new Response(await upstream.text(), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
