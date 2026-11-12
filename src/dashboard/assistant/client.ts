import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseClient } from '../../shared/supabase';
import { ASSISTANT_SYSTEM_PROMPT } from './systemPrompt';
import { executeTool } from './executeTool';
import { toolsForOpenAI, getToolDef, APPROVAL_RISKS } from './tools';
import { approvalKey, validateArgs } from './validate';
import { appendMessage, logToolRun } from './persistence';
import type {
  AssistantUiEvent, BridgeSendMessage, ChatMessage, OpenAIToolCall, ToolContext, ToolResult,
} from './types';

const MAX_TOOL_ROUNDS = 20;
const MAX_TOOL_OUTPUT_CHARS = 12000;
const MAX_RETRIES = 3;

type InputItem = Record<string, unknown>;

export class AssistantError extends Error {
  constructor(message: string, public retryable = false) {
    super(message);
  }
}

// ── Model input ──────────────────────────────────────────────────────────────

/** Stored chat history → Responses API input items. */
function historyToInput(messages: ChatMessage[]): InputItem[] {
  const input: InputItem[] = [];
  for (const m of messages) {
    if (m.role === 'user') input.push({ role: 'user', content: m.content || '' });
    else if (m.role === 'assistant') {
      for (const call of m.tool_calls || []) {
        input.push({ type: 'function_call', call_id: call.id, name: call.function.name, arguments: call.function.arguments || '{}' });
      }
      if (m.content) input.push({ role: 'assistant', content: m.content });
    } else if (m.role === 'tool' && m.tool_call_id) {
      input.push({ type: 'function_call_output', call_id: m.tool_call_id, output: m.content || '' });
    }
  }
  return input;
}

/**
 * Tool output for the model: wrapped so the model treats it as data, and
 * capped so one large result cannot flood the context.
 */
export function toolOutputForModel(result: ToolResult): string {
  const payload = result.ok ? result.data ?? { ok: true } : { error: result.error };
  let json = JSON.stringify({ untrusted_data: payload });
  if (json.length > MAX_TOOL_OUTPUT_CHARS) {
    const raw = JSON.stringify(payload);
    // Escaping the sliced text makes it longer, so shrink until the whole envelope fits
    let keep = MAX_TOOL_OUTPUT_CHARS;
    do {
      keep = Math.floor(keep * 0.85);
      json = JSON.stringify({
        untrusted_data: raw.slice(0, keep),
        truncated: true,
        note: `Result truncated (${raw.length.toLocaleString()} characters in full). Use limit and offset to page if more is needed.`,
      });
    } while (json.length > MAX_TOOL_OUTPUT_CHARS && keep > 500);
  }
  return json;
}

// ── Model call (server function, streamed) ───────────────────────────────────

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new AssistantError('Cancelled')); }, { once: true });
  });

/** Parse a server-sent event stream from the Responses API. */
async function readStream(res: Response, onDelta: (text: string) => void): Promise<any> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final: any = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
      if (!data || data === '[DONE]') continue;
      let event: any;
      try { event = JSON.parse(data); } catch { continue; }
      if (event.type === 'response.output_text.delta' && event.delta) onDelta(event.delta);
      else if (event.type === 'response.completed' || event.type === 'response.incomplete') final = event.response;
      else if (event.type === 'response.failed') throw new AssistantError(event.response?.error?.message || 'The model failed to answer.', true);
      else if (event.type === 'error') throw new AssistantError(event.message || event.error?.message || 'The model stream failed.', true);
    }
  }
  if (!final) throw new AssistantError('The answer was cut off. Try again.', true);
  return final;
}

async function callModel(input: InputItem[], signal: AbortSignal | undefined, onDelta: (t: string) => void): Promise<any> {
  const session = supabaseClient.getSession();
  if (!session?.access_token) throw new AssistantError('Your session has ended. Sign in again.');

  let lastError: AssistantError | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1), signal);
    let streamed = false;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/assistant-chat`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ instructions: ASSISTANT_SYSTEM_PROMPT, input, tools: toolsForOpenAI(), stream: true }),
        signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body.error || body.msg || `The Assistant service returned HTTP ${res.status}.`;
        const retryable = res.status === 429 || res.status >= 500;
        if (res.status === 401) throw new AssistantError('Your session has ended. Sign in again.');
        throw new AssistantError(body.detail ? `${message} ${String(body.detail).slice(0, 200)}` : message, retryable);
      }
      if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
        return await readStream(res, (t) => { streamed = true; onDelta(t); });
      }
      return await res.json();
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') throw new AssistantError('Cancelled');
      const e = err instanceof AssistantError ? err : new AssistantError('Couldn\'t reach the Assistant service. Check your connection.', true);
      // Never retry once text has streamed: the user has already seen part of the answer
      if (!e.retryable || streamed) throw e;
      lastError = e;
    }
  }
  throw lastError || new AssistantError('The Assistant service is unavailable. Try again shortly.', true);
}

function parseOutput(response: any): { text: string; calls: OpenAIToolCall[]; raw: any[]; incomplete: boolean } {
  const raw: any[] = Array.isArray(response?.output) ? response.output : [];
  const text = typeof response?.output_text === 'string' && response.output_text
    ? response.output_text
    : raw.filter((i) => i?.type === 'message')
        .flatMap((i) => (i.content || []).map((p: any) => p?.text || ''))
        .join('');
  const calls = raw.filter((i) => i?.type === 'function_call').map((fc) => ({
    id: fc.call_id || fc.id,
    type: 'function' as const,
    function: { name: fc.name, arguments: typeof fc.arguments === 'string' ? fc.arguments : JSON.stringify(fc.arguments || {}) },
  }));
  return { text: text.trim(), calls, raw, incomplete: response?.status === 'incomplete' };
}

// ── Turn loop ────────────────────────────────────────────────────────────────

export async function runAssistantTurn(opts: {
  threadId: string;
  userId: string;
  history: ChatMessage[];
  userMessage: string;
  bridgeSendMessage: BridgeSendMessage;
  navigate?: ToolContext['navigate'];
  /** e.g. "Queue" — what the user is looking at, sent to the model but not saved */
  viewContext?: string;
  onEvent: (e: AssistantUiEvent) => void;
  signal?: AbortSignal;
}): Promise<ChatMessage[]> {
  const { threadId, userId, onEvent, signal } = opts;
  const messages: ChatMessage[] = [...opts.history];
  const userMsg: ChatMessage = { role: 'user', content: opts.userMessage };
  messages.push(userMsg);
  appendMessage(threadId, userMsg).catch(() => {});

  let input = historyToInput(messages);
  if (opts.viewContext) {
    input.splice(input.length - 1, 0, { role: 'developer', content: `The user is currently on the "${opts.viewContext}" screen of the dashboard.` });
  }
  const baseCtx: ToolContext = { bridgeSendMessage: opts.bridgeSendMessage, userId, navigate: opts.navigate };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (signal?.aborted) throw new AssistantError('Cancelled');
    onEvent({ type: 'status', message: round === 0 ? 'Thinking' : 'Working through the results' });

    const response = await callModel(input, signal, (delta) => onEvent({ type: 'assistant_delta', delta }));
    const { text, calls, raw, incomplete } = parseOutput(response);

    const assistant: ChatMessage = { role: 'assistant', content: text || null, tool_calls: calls.length ? calls : undefined };
    messages.push(assistant);
    appendMessage(threadId, assistant).catch(() => {});
    // Keep the model's own output items (including reasoning) for the next round
    input = [...input, ...raw];

    if (!calls.length) {
      const final = incomplete && text ? `${text}\n\n_The answer was cut short. Ask me to continue._` : text;
      onEvent({ type: 'assistant_message', content: final || 'Done.' });
      onEvent({ type: 'done', messages });
      return messages;
    }

    // Run routine calls in parallel; approval calls one at a time, in order
    const runs = calls.map((call) => ({ call, def: getToolDef(call.function.name) }));
    const results = new Map<string, ToolResult>();

    await Promise.all(runs.filter((r) => !r.def || !APPROVAL_RISKS.has(r.def.risk)).map(async ({ call }) => {
      results.set(call.id, await runCall(call, baseCtx, opts, false));
    }));
    for (const r of runs.filter((x) => x.def && APPROVAL_RISKS.has(x.def.risk))) {
      if (signal?.aborted) throw new AssistantError('Cancelled');
      results.set(r.call.id, await runCall(r.call, baseCtx, opts, true));
    }

    for (const { call } of runs) {
      const result = results.get(call.id)!;
      const output = toolOutputForModel(result);
      const toolMsg: ChatMessage = { role: 'tool', tool_call_id: call.id, name: call.function.name, content: output };
      messages.push(toolMsg);
      appendMessage(threadId, toolMsg).catch(() => {});
      input.push({ type: 'function_call_output', call_id: call.id, output });
    }
  }

  const cap = 'I reached the step limit for one request. Ask me to continue and I\'ll pick up where I stopped.';
  messages.push({ role: 'assistant', content: cap });
  onEvent({ type: 'assistant_message', content: cap });
  onEvent({ type: 'done', messages });
  return messages;
}

function parseArgs(call: OpenAIToolCall): unknown {
  try { return JSON.parse(call.function.arguments || '{}'); } catch { return {}; }
}

async function runCall(
  call: OpenAIToolCall,
  ctx: ToolContext,
  opts: { threadId: string; userId: string; onEvent: (e: AssistantUiEvent) => void; signal?: AbortSignal },
  mayNeedApproval: boolean,
): Promise<ToolResult> {
  const name = call.function.name;
  const def = getToolDef(name);
  const label = def?.label || name;
  const args = parseArgs(call);
  const started = Date.now();
  opts.onEvent({ type: 'tool_start', callId: call.id, name, label, args });

  let result = await executeTool(name, args, ctx);

  if (result.needsApproval && mayNeedApproval && def) {
    logToolRun({ threadId: opts.threadId, userId: opts.userId, toolName: name, argsSummary: JSON.stringify(args).slice(0, 500), resultSummary: result.preview?.summary || '', status: 'needs_confirmation', durationMs: 0 });
    const approved = await new Promise<boolean>((resolve) => {
      const onAbort = () => resolve(false);
      opts.signal?.addEventListener('abort', onAbort, { once: true });
      opts.onEvent({
        type: 'needs_approval', callId: call.id, name, label, risk: def.risk, preview: result.preview!,
        resolve: (yes) => { opts.signal?.removeEventListener('abort', onAbort); resolve(yes); },
      });
    });
    if (!approved) {
      result = { ok: false, error: 'The user declined this action. Do not retry it.' };
    } else {
      // The approval is bound to these exact (validated) arguments
      const checked = validateArgs(def.parameters, args);
      const key = 'error' in checked ? '' : approvalKey(name, checked.args);
      result = await executeTool(name, args, { ...ctx, approval: { key } });
    }
  }

  const durationMs = Date.now() - started;
  opts.onEvent({ type: 'tool_end', callId: call.id, name, label, result, durationMs });
  logToolRun({
    threadId: opts.threadId, userId: opts.userId, toolName: name,
    argsSummary: JSON.stringify(args).slice(0, 500),
    resultSummary: result.ok ? (result.summary || 'ok') : (result.error || 'failed'),
    status: result.ok ? 'ok' : result.error?.includes('declined') ? 'cancelled' : 'error',
    durationMs,
  });
  return result;
}
