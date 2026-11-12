export type ToolRisk = 'read' | 'write' | 'bulk' | 'destructive' | 'external' | 'extension';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  id?: string;
  role: ChatRole;
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: OpenAIToolCall[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  risk: ToolRisk;
  parameters: Record<string, unknown>;
}

export interface ToolResult {
  ok: boolean;
  /** JSON-serializable payload returned to the model */
  data?: unknown;
  error?: string;
  needsConfirmation?: boolean;
  preview?: string;
  risk?: ToolRisk;
}

export type BridgeSendMessage = <T>(message: any) => Promise<T>;

export interface ToolContext {
  bridgeSendMessage: BridgeSendMessage;
  userId: string;
  /** When true, write/bulk/destructive/external tools may run */
  confirmed?: boolean;
}

export type AssistantUiEvent =
  | { type: 'status'; message: string }
  | { type: 'assistant_delta'; content: string }
  | { type: 'tool_start'; name: string; args: unknown }
  | { type: 'tool_end'; name: string; result: ToolResult; durationMs: number }
  | { type: 'needs_confirmation'; name: string; args: unknown; preview: string; risk: ToolRisk; resolve: (ok: boolean) => void }
  | { type: 'error'; message: string }
  | { type: 'done'; messages: ChatMessage[] };

export interface AgentThread {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
