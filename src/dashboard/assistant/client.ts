import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseClient } from '../../shared/supabase';
import { ASSISTANT_SYSTEM_PROMPT } from './systemPrompt';
import { executeTool } from './executeTool';
import { toolsForOpenAI, getToolDef } from './tools';
import { appendMessage, logToolRun } from './persistence';
import type {
  AssistantUiEvent,
  BridgeSendMessage,
  ChatMessage,
  OpenAIToolCall,
  ToolResult,
} from './types';

const MAX_TOOL_ROUNDS = 10;
const MODEL = 'gpt-4.1';

function summarizeArgs(args: unknown): string {
  try {
    return JSON.stringify(args).slice(0, 500);
  } catch {
    return String(args);
  }
}

function summarizeResult(result: ToolResult): string {
  if (result.needsConfirmation) return `needs_confirmation: ${result.preview || ''}`;
  if (!result.ok) return `error: ${result.error || 'failed'}`;
  try {
    return JSON.stringify(result.data).slice(0, 800);
  } catch {
    return 'ok';
  }
}

async function callOpenAI(messages: ChatMessage[]): Promise<ChatMessage> {
  const session = supabaseClient.getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const tools = toolsForOpenAI();

  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
      ...messages.map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'tool',
            tool_call_id: m.tool_call_id,
            content: m.content || '',
          };
        }
        if (m.role === 'assistant' && m.tool_calls?.length) {
          return {
            role: 'assistant',
            content: m.content,
            tool_calls: m.tool_calls,
          };
        }
        return { role: m.role, content: m.content };
      }),
    ],
    tools,
    tool_choice: 'auto',
  };

  // 1) Prefer edge function (server-held OPENAI_API_KEY)
  try {
    const edgeRes = await fetch(`${SUPABASE_URL}/functions/v1/assistant-chat`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000),
    });
    if (edgeRes.ok) {
      const data = await edgeRes.json();
      const msg = data.message || data.choices?.[0]?.message;
      if (msg) {
        return {
          role: 'assistant',
          content: msg.content ?? null,
          tool_calls: msg.tool_calls,
        };
      }
    }
  } catch {
    // fall through to direct key
  }

  // 2) Dev / interim fallback: Vite env key (dashboard only)
  const directKey = (import.meta as any).env?.VITE_OPENAI_API_KEY as string | undefined;
  if (!directKey) {
    throw new Error(
      'Assistant is not configured. Deploy the assistant-chat edge function with OPENAI_API_KEY, or set VITE_OPENAI_API_KEY for local use.',
    );
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${directKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error('Empty OpenAI response');
  return {
    role: 'assistant',
    content: msg.content ?? null,
    tool_calls: msg.tool_calls,
  };
}

function waitForConfirmation(
  onEvent: (e: AssistantUiEvent) => void,
  name: string,
  args: unknown,
  preview: string,
  risk: ToolResult['risk'],
): Promise<boolean> {
  return new Promise((resolve) => {
    onEvent({
      type: 'needs_confirmation',
      name,
      args,
      preview,
      risk: risk || 'write',
      resolve,
    });
  });
}

export async function runAssistantTurn(opts: {
  threadId: string;
  userId: string;
  history: ChatMessage[];
  userMessage: string;
  bridgeSendMessage: BridgeSendMessage;
  onEvent: (e: AssistantUiEvent) => void;
  signal?: AbortSignal;
}): Promise<ChatMessage[]> {
  const { threadId, userId, bridgeSendMessage, onEvent, signal } = opts;
  const messages: ChatMessage[] = [...opts.history];

  const userMsg: ChatMessage = { role: 'user', content: opts.userMessage };
  messages.push(userMsg);
  await appendMessage(threadId, userMsg).catch(() => {});

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (signal?.aborted) throw new Error('Cancelled');

    onEvent({ type: 'status', message: round === 0 ? 'Thinking…' : 'Continuing…' });
    const assistant = await callOpenAI(messages);
    messages.push(assistant);
    await appendMessage(threadId, assistant).catch(() => {});

    const toolCalls = (assistant.tool_calls || []) as OpenAIToolCall[];
    if (!toolCalls.length) {
      if (assistant.content) {
        onEvent({ type: 'assistant_delta', content: assistant.content });
      }
      onEvent({ type: 'done', messages });
      return messages;
    }

    for (const call of toolCalls) {
      if (signal?.aborted) throw new Error('Cancelled');

      let args: Record<string, any> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        args = {};
      }

      onEvent({ type: 'tool_start', name: call.function.name, args });
      const started = Date.now();

      let result = await executeTool(call.function.name, args, {
        bridgeSendMessage,
        userId,
        confirmed: false,
      });

      if (result.needsConfirmation) {
        await logToolRun({
          threadId,
          userId,
          toolName: call.function.name,
          argsSummary: summarizeArgs(args),
          resultSummary: summarizeResult(result),
          status: 'needs_confirmation',
          durationMs: Date.now() - started,
        });

        const approved = await waitForConfirmation(
          onEvent,
          call.function.name,
          args,
          result.preview || 'Confirm this action?',
          result.risk || getToolDef(call.function.name)?.risk,
        );

        if (!approved) {
          result = { ok: false, error: 'User cancelled this action.' };
          await logToolRun({
            threadId,
            userId,
            toolName: call.function.name,
            argsSummary: summarizeArgs(args),
            resultSummary: 'cancelled',
            status: 'cancelled',
            durationMs: Date.now() - started,
          });
        } else {
          const confirmStarted = Date.now();
          result = await executeTool(call.function.name, { ...args, confirm: true }, {
            bridgeSendMessage,
            userId,
            confirmed: true,
          });
          await logToolRun({
            threadId,
            userId,
            toolName: call.function.name,
            argsSummary: summarizeArgs(args),
            resultSummary: summarizeResult(result),
            status: result.ok ? 'ok' : 'error',
            durationMs: Date.now() - confirmStarted,
          });
        }
      } else {
        await logToolRun({
          threadId,
          userId,
          toolName: call.function.name,
          argsSummary: summarizeArgs(args),
          resultSummary: summarizeResult(result),
          status: result.ok ? 'ok' : 'error',
          durationMs: Date.now() - started,
        });
      }

      onEvent({
        type: 'tool_end',
        name: call.function.name,
        result,
        durationMs: Date.now() - started,
      });

      const toolMsg: ChatMessage = {
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(
          result.needsConfirmation
            ? { error: 'Confirmation was required' }
            : result.ok
              ? result.data
              : { error: result.error },
        ),
      };
      messages.push(toolMsg);
      await appendMessage(threadId, toolMsg).catch(() => {});
    }
  }

  const cap: ChatMessage = {
    role: 'assistant',
    content: 'I hit the tool-step limit for this turn. Ask me to continue if you need more.',
  };
  messages.push(cap);
  onEvent({ type: 'assistant_delta', content: cap.content || '' });
  onEvent({ type: 'done', messages });
  return messages;
}
