/**
 * read        – looks at data; runs immediately
 * write       – routine change; runs immediately
 * bulk        – changes many records at once; needs an Approve click
 * destructive – deletes or cannot be undone; needs an Approve click
 * external    – sends something outside RecruitScout (email, Sheets); needs an Approve click
 * extension   – controls a scraping agent; needs an Approve click
 */
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
  /** Short, human label for the activity feed, e.g. "Queue tasks" */
  label: string;
  description: string;
  risk: ToolRisk;
  parameters: JsonSchema;
}

export interface JsonSchema {
  type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number)[];
  additionalProperties?: boolean;
  minimum?: number;
  maximum?: number;
}

/** What an approval card shows: a plain sentence plus the exact changes. */
export interface ApprovalPreview {
  summary: string;
  details?: string[];
}

export interface ToolResult {
  ok: boolean;
  /** JSON-serializable payload returned to the model */
  data?: unknown;
  error?: string;
  /** Set when the tool is waiting for an Approve click */
  needsApproval?: boolean;
  preview?: ApprovalPreview;
  /** One line for the activity feed when the tool succeeds, e.g. "Queued 4 tasks" */
  summary?: string;
  /** Optional structured view for the UI (tables, stat tiles) */
  view?: ToolView;
}

export type ToolView =
  | { kind: 'stats'; items: { label: string; value: string | number; tone?: 'neutral' | 'success' | 'warning' | 'danger' }[] }
  | { kind: 'table'; columns: string[]; rows: (string | number | null)[][]; total?: number }
  | { kind: 'list'; items: string[] };

export type BridgeSendMessage = <T>(message: any) => Promise<T>;

/** Proof that the user clicked Approve for this exact call. Only the UI creates these. */
export interface ApprovalGrant {
  key: string;
}

export interface ToolContext {
  bridgeSendMessage: BridgeSendMessage;
  userId: string;
  approval?: ApprovalGrant;
  /** Lets tools switch dashboard tabs */
  navigate?: (view: string, filters?: Record<string, string>) => void;
}

export type AssistantUiEvent =
  | { type: 'status'; message: string }
  | { type: 'assistant_delta'; delta: string }
  | { type: 'assistant_message'; content: string }
  | { type: 'tool_start'; callId: string; name: string; label: string; args: unknown }
  | { type: 'tool_end'; callId: string; name: string; label: string; result: ToolResult; durationMs: number }
  | {
      type: 'needs_approval';
      callId: string;
      name: string;
      label: string;
      risk: ToolRisk;
      preview: ApprovalPreview;
      resolve: (approved: boolean) => void;
    }
  | { type: 'error'; message: string; retryable?: boolean }
  | { type: 'done'; messages: ChatMessage[] };

export interface AgentThread {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}
