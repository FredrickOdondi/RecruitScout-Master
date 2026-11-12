import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseClient } from '../../shared/supabase';
import type { AgentThread, ChatMessage } from './types';

/** Local fallback when agent_* tables are not migrated yet */
const memoryThreads = new Map<string, AgentThread>();
const memoryMessages = new Map<string, ChatMessage[]>();
let memoryMode = false;

function authHeaders(): HeadersInit {
  const session = supabaseClient.getSession();
  const token = session?.access_token || SUPABASE_ANON_KEY;
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Prefer: 'return=representation',
  };
}

function newLocalThread(userId: string, title: string): AgentThread {
  const thread: AgentThread = {
    id: `local-${crypto.randomUUID()}`,
    user_id: userId,
    title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  memoryThreads.set(thread.id, thread);
  memoryMessages.set(thread.id, []);
  memoryMode = true;
  return thread;
}

export async function listThreads(userId: string): Promise<AgentThread[]> {
  if (memoryMode) {
    return [...memoryThreads.values()]
      .filter((t) => t.user_id === userId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/agent_threads?user_id=eq.${userId}&order=updated_at.desc&limit=50`,
    { headers: authHeaders(), signal: AbortSignal.timeout(30000) },
  );
  if (!res.ok) {
    memoryMode = true;
    return [...memoryThreads.values()]
      .filter((t) => t.user_id === userId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  return res.json();
}

export async function createThread(userId: string, title = 'New chat'): Promise<AgentThread | null> {
  if (memoryMode) return newLocalThread(userId, title);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/agent_threads`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ user_id: userId, title }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return newLocalThread(userId, title);
  const rows = await res.json();
  return rows[0] || newLocalThread(userId, title);
}

export async function renameThread(threadId: string, title: string): Promise<void> {
  const local = memoryThreads.get(threadId);
  if (local || threadId.startsWith('local-')) {
    if (local) {
      local.title = title;
      local.updated_at = new Date().toISOString();
    }
    return;
  }
  await fetch(`${SUPABASE_URL}/rest/v1/agent_threads?id=eq.${threadId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ title, updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(15000),
  });
}

export async function deleteThread(threadId: string): Promise<void> {
  memoryThreads.delete(threadId);
  memoryMessages.delete(threadId);
  if (threadId.startsWith('local-') || memoryMode) return;
  // Messages and tool runs reference the thread; remove them first
  await fetch(`${SUPABASE_URL}/rest/v1/agent_messages?thread_id=eq.${threadId}`, {
    method: 'DELETE', headers: authHeaders(), signal: AbortSignal.timeout(15000),
  }).catch(() => {});
  await fetch(`${SUPABASE_URL}/rest/v1/agent_tool_runs?thread_id=eq.${threadId}`, {
    method: 'DELETE', headers: authHeaders(), signal: AbortSignal.timeout(15000),
  }).catch(() => {});
  await fetch(`${SUPABASE_URL}/rest/v1/agent_threads?id=eq.${threadId}`, {
    method: 'DELETE', headers: authHeaders(), signal: AbortSignal.timeout(15000),
  });
}

export async function touchThread(threadId: string): Promise<void> {
  const local = memoryThreads.get(threadId);
  if (local || threadId.startsWith('local-')) {
    if (local) local.updated_at = new Date().toISOString();
    return;
  }
  await fetch(`${SUPABASE_URL}/rest/v1/agent_threads?id=eq.${threadId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ updated_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(15000),
  });
}

export async function loadMessages(threadId: string): Promise<ChatMessage[]> {
  if (threadId.startsWith('local-') || memoryMessages.has(threadId)) {
    return [...(memoryMessages.get(threadId) || [])];
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/agent_messages?thread_id=eq.${threadId}&order=created_at.asc&limit=200`,
    { headers: authHeaders(), signal: AbortSignal.timeout(30000) },
  );
  if (!res.ok) return [];
  const rows = await res.json();
  return rows.map((r: any) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    tool_call_id: r.tool_call_id || undefined,
    name: r.tool_name || undefined,
    tool_calls: r.tool_calls || undefined,
  }));
}

export async function appendMessage(threadId: string, message: ChatMessage): Promise<void> {
  if (threadId.startsWith('local-') || memoryMode) {
    const list = memoryMessages.get(threadId) || [];
    list.push(message);
    memoryMessages.set(threadId, list);
    await touchThread(threadId);
    return;
  }
  await fetch(`${SUPABASE_URL}/rest/v1/agent_messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      thread_id: threadId,
      role: message.role,
      content: message.content,
      tool_call_id: message.tool_call_id || null,
      tool_name: message.name || null,
      tool_calls: message.tool_calls || null,
    }),
    signal: AbortSignal.timeout(30000),
  });
  await touchThread(threadId);
}

export async function logToolRun(opts: {
  threadId: string;
  userId: string;
  toolName: string;
  argsSummary: string;
  resultSummary: string;
  status: 'ok' | 'error' | 'cancelled' | 'needs_confirmation';
  durationMs: number;
}): Promise<void> {
  if (opts.threadId.startsWith('local-') || memoryMode) return;
  await fetch(`${SUPABASE_URL}/rest/v1/agent_tool_runs`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      thread_id: opts.threadId,
      user_id: opts.userId,
      tool_name: opts.toolName,
      args_summary: opts.argsSummary.slice(0, 2000),
      result_summary: opts.resultSummary.slice(0, 4000),
      status: opts.status,
      duration_ms: opts.durationMs,
    }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => {});
}

export function titleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  return clean.length > 48 ? `${clean.slice(0, 45)}…` : clean || 'New chat';
}
