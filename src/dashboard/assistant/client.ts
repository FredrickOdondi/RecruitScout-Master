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
const MODEL = 'gpt-6-astra';

type ResponseInputItem = Record<string, unknown>;

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

/** Convert stored chat history into Responses API input items. */
function chatToResponseInput(messages: ChatMessage[]): ResponseInputItem[] {
  const input: ResponseInputItem[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      input.push({ role: 'user', content: m.content || '' });
      continue;
    }
    if (m.role === 'assistant') {
      if (m.tool_calls?.length) {
        for (const call of m.tool_calls) {
          input.push({
            type: 'function_call',
            call_id: call.id,
            name: call.function.name,
            arguments: call.function.arguments || '{}',
          });
        }
      }
      if (m.content) {
        input.push({ role: 'assistant', content: m.content });
      }
      continue;
    }
    if (m.role === 'tool' && m.tool_call_id) {
      input.push({
        type: 'function_call_output',
        call_id: m.tool_call_id,
        output: m.content || '',
      });
    }
  }
  return input;
}

function extractAssistantMessage(data: any): {
  message: ChatMessage;
  rawOutput: any[];
} {
  const output: any[] = Array.isArray(data.output) ? data.output : [];
  const functionCalls = output.filter((item) => item?.type === 'function_call');
  const textParts: string[] = [];

  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    textParts.push(data.output_text);
  } else {
    for (const item of output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part?.type === 'output_text' && part.text) textParts.push(part.text);
          else if (typeof part?.text === 'string') textParts.push(part.text);
        }
      }
    }
  }

  const tool_calls: OpenAIToolCall[] | undefined = functionCalls.length
    ? functionCalls.map((fc) => ({
        id: fc.call_id || fc.id,
        type: 'function' as const,
        function: {
          name: fc.name,
          arguments: typeof fc.arguments === 'string' ? fc.arguments : JSON.stringify(fc.arguments || {}),
        },
      }))
    : undefined;

  return {
    message: {
      role: 'assistant',
      content: textParts.join('\n').trim() || null,
      tool_calls,
    },
    rawOutput: output,
  };
}

async function callResponsesApi(input: ResponseInputItem[]): Promise<{
  message: ChatMessage;
  rawOutput: any[];
}> {
  const session = supabaseClient.getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  const payload = {
    model: MODEL,
    instructions: ASSISTANT_SYSTEM_PROMPT,
    input,
    tools: toolsForOpenAI(),
    tool_choice: 'auto' as const,
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
      signal: AbortSignal.timeout(180000),
    });
    if (edgeRes.ok) {
      const data = await edgeRes.json();
      const body = data.response || data;
      if (body?.output || body?.output_text) {
        return extractAssistantMessage(body);
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

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${directKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  return extractAssistantMessage(await res.json());
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

  // Responses-native input for the active turn (preserves reasoning items for Astra)
  let responseInput: ResponseInputItem[] = chatToResponseInput(messages);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (signal?.aborted) throw new Error('Cancelled');

    onEvent({ type: 'status', message: round === 0 ? 'Thinking…' : 'Continuing…' });

    const { message: assistant, rawOutput } = await callResponsesApi(responseInput);
    messages.push(assistant);
    await appendMessage(threadId, assistant).catch(() => {});

    if (rawOutput.length) {
      responseInput = [...responseInput, ...rawOutput];
    } else if (assistant.tool_calls?.length) {
      for (const call of assistant.tool_calls) {
        responseInput.push({
          type: 'function_call',
          call_id: call.id,
          name: call.function.name,
          arguments: call.function.arguments || '{}',
        });
      }
    } else if (assistant.content) {
      responseInput.push({ role: 'assistant', content: assistant.content });
    }

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

      const outputPayload = JSON.stringify(
        result.ok ? result.data : { error: result.error },
      );

      const toolMsg: ChatMessage = {
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: outputPayload,
      };
      messages.push(toolMsg);
      await appendMessage(threadId, toolMsg).catch(() => {});

      responseInput.push({
        type: 'function_call_output',
        call_id: call.id,
        output: outputPayload,
      });
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
