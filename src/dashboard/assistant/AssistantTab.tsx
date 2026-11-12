import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageSquare, Plus, Send, Square, Loader2, Wrench, CheckCircle2,
  XCircle, AlertTriangle, Sparkles, ChevronRight,
} from 'lucide-react';
import { supabaseClient } from '../../shared/supabase';
import { runAssistantTurn } from './client';
import {
  appendMessage,
  createThread,
  listThreads,
  loadMessages,
  renameThread,
  titleFromPrompt,
} from './persistence';
import type {
  AgentThread,
  AssistantUiEvent,
  BridgeSendMessage,
  ChatMessage,
  ToolRisk,
} from './types';

interface Props {
  sendMessage: BridgeSendMessage;
  focusNonce?: number;
}

type UiMessage =
  | { kind: 'user'; content: string }
  | { kind: 'assistant'; content: string }
  | { kind: 'tool'; name: string; status: 'running' | 'ok' | 'error' | 'cancelled'; detail?: string }
  | { kind: 'confirm'; name: string; preview: string; risk: ToolRisk; resolve: (ok: boolean) => void };

const SUGGESTIONS = [
  'Diagnose why the swarm is idle',
  'Enqueue Software Engineer and Data Analyst in Milan for any worker on Indeed',
  'Show queue counts and online agents',
  'List Indeed accounts that are blocked',
  'Match recruiters to categorized jobs and summarize the top 10',
  'Reset completed queue tasks to pending',
];

function riskLabel(risk: ToolRisk) {
  switch (risk) {
    case 'destructive': return 'Destructive';
    case 'bulk': return 'Bulk change';
    case 'external': return 'External send';
    case 'extension': return 'Extension control';
    default: return 'Confirm';
  }
}

export default function AssistantTab({ sendMessage, focusNonce = 0 }: Props) {
  const session = supabaseClient.getSession();
  const userId = session?.user?.id as string | undefined;

  const [threads, setThreads] = useState<AgentThread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [uiMessages, setUiMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<UiMessage & { kind: 'confirm' } | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uiMessages, status, pendingConfirm]);

  useEffect(() => {
    if (focusNonce > 0) {
      inputRef.current?.focus();
    }
  }, [focusNonce]);

  const refreshThreads = useCallback(async () => {
    if (!userId) return;
    const list = await listThreads(userId);
    setThreads(list);
  }, [userId]);

  useEffect(() => {
    refreshThreads();
  }, [refreshThreads]);

  const openThread = async (id: string) => {
    setThreadId(id);
    setError(null);
    setPendingConfirm(null);
    const msgs = await loadMessages(id);
    setHistory(msgs.filter((m) => m.role !== 'system'));
    setUiMessages(
      msgs
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
        .map((m) =>
          m.role === 'user'
            ? { kind: 'user' as const, content: m.content || '' }
            : { kind: 'assistant' as const, content: m.content || '' },
        ),
    );
  };

  const startNewChat = async () => {
    if (!userId) return;
    const thread = await createThread(userId);
    if (!thread) {
      setError('Could not create a chat thread. Apply the assistant migration and sign in again.');
      return;
    }
    setThreadId(thread.id);
    setHistory([]);
    setUiMessages([]);
    setPendingConfirm(null);
    setError(null);
    await refreshThreads();
    inputRef.current?.focus();
  };

  const handleEvent = (e: AssistantUiEvent) => {
    switch (e.type) {
      case 'status':
        setStatus(e.message);
        break;
      case 'assistant_delta':
        setUiMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.kind === 'assistant') {
            return [...prev.slice(0, -1), { kind: 'assistant', content: e.content }];
          }
          return [...prev, { kind: 'assistant', content: e.content }];
        });
        break;
      case 'tool_start':
        setUiMessages((prev) => [
          ...prev,
          { kind: 'tool', name: e.name, status: 'running' },
        ]);
        break;
      case 'tool_end':
        setUiMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            const m = next[i];
            if (m.kind === 'tool' && m.name === e.name && m.status === 'running') {
              next[i] = {
                kind: 'tool',
                name: e.name,
                status: e.result.ok ? 'ok' : e.result.error?.includes('cancelled') ? 'cancelled' : 'error',
                detail: e.result.ok
                  ? undefined
                  : e.result.error || e.result.preview,
              };
              break;
            }
          }
          return next;
        });
        break;
      case 'needs_confirmation': {
        const confirmMsg: UiMessage & { kind: 'confirm' } = {
          kind: 'confirm',
          name: e.name,
          preview: e.preview,
          risk: e.risk,
          resolve: e.resolve,
        };
        setPendingConfirm(confirmMsg);
        setUiMessages((prev) => [...prev, confirmMsg]);
        break;
      }
      case 'error':
        setError(e.message);
        break;
      case 'done':
        setStatus(null);
        setHistory(e.messages.filter((m) => m.role !== 'system'));
        break;
    }
  };

  const submit = async (text?: string) => {
    const prompt = (text ?? input).trim();
    if (!prompt || busy || !userId) return;

    let activeThreadId = threadId;
    if (!activeThreadId) {
      const thread = await createThread(userId, titleFromPrompt(prompt));
      if (!thread) {
        setError('Could not create a chat thread. Apply the assistant migration first.');
        return;
      }
      activeThreadId = thread.id;
      setThreadId(thread.id);
      await refreshThreads();
    } else if (history.length === 0) {
      renameThread(activeThreadId, titleFromPrompt(prompt)).then(refreshThreads);
    }

    setInput('');
    setError(null);
    setPendingConfirm(null);
    setUiMessages((prev) => [...prev, { kind: 'user', content: prompt }]);
    setBusy(true);
    setStatus('Thinking…');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const next = await runAssistantTurn({
        threadId: activeThreadId,
        userId,
        history: historyRef.current,
        userMessage: prompt,
        bridgeSendMessage: sendMessage,
        onEvent: handleEvent,
        signal: controller.signal,
      });
      setHistory(next.filter((m) => m.role !== 'system'));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message !== 'Cancelled') setError(message);
      // Persist a short assistant error note when possible
      if (activeThreadId && message !== 'Cancelled') {
        const msg: ChatMessage = { role: 'assistant', content: `Error: ${message}` };
        appendMessage(activeThreadId, msg).catch(() => {});
        setUiMessages((prev) => [...prev, { kind: 'assistant', content: `Error: ${message}` }]);
      }
    } finally {
      setBusy(false);
      setStatus(null);
      abortRef.current = null;
      refreshThreads();
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    if (pendingConfirm) {
      pendingConfirm.resolve(false);
      setPendingConfirm(null);
    }
  };

  if (!userId) {
    return (
      <div className="flex-1 flex items-center justify-center text-fg-muted text-sm">
        Sign in to use the Assistant.
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 gap-0 -m-4 md:-m-6">
      {/* Thread rail */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-stroke-card bg-chrome shrink-0">
        <div className="p-3 border-b border-stroke-divider">
          <button type="button" onClick={startNewChat} className="btn-secondary w-full justify-center gap-2">
            <Plus size={16} />
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => openThread(t.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm truncate transition-colors ${
                threadId === t.id
                  ? 'bg-surface text-fg shadow-[inset_0_0_0_1px_rgb(var(--g-stroke-card))]'
                  : 'text-fg-muted hover:text-fg hover:bg-hover'
              }`}
            >
              {t.title}
            </button>
          ))}
          {!threads.length && (
            <p className="text-xs text-fg-subtle px-3 py-4">No chats yet.</p>
          )}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 bg-canvas">
        <div className="h-12 px-4 md:px-6 flex items-center gap-2 border-b border-stroke-card bg-chrome/80">
          <MessageSquare size={18} className="text-accent-text" />
          <span className="text-sm font-medium text-fg">Assistant</span>
          <span className="text-xs text-fg-subtle hidden sm:inline">OpenAI · tools over live RecruitScout APIs</span>
          <button type="button" onClick={startNewChat} className="lg:hidden ml-auto btn-ghost text-xs gap-1">
            <Plus size={14} /> New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 py-4">
          {!uiMessages.length && !busy && (
            <div className="max-w-2xl mx-auto pt-10 pb-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={20} className="text-accent-text" />
                <h2 className="text-lg font-semibold text-fg">What do you want to run?</h2>
              </div>
              <p className="text-sm text-fg-muted mb-6">
                Enqueue scrapes, inspect the swarm, manage clients and leads, sync sheets, or operate Blue.cc — same actions as the dashboard, via a prompt.
              </p>
              <div className="grid gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="text-left px-4 py-3 rounded-md border border-stroke-card bg-surface hover:bg-hover text-sm text-fg transition-colors flex items-start gap-2"
                  >
                    <ChevronRight size={16} className="mt-0.5 text-fg-subtle shrink-0" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-w-3xl mx-auto space-y-4">
            {uiMessages.map((m, idx) => {
              if (m.kind === 'user') {
                return (
                  <div key={idx} className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-accent text-on-accent px-4 py-2.5 text-sm whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                );
              }
              if (m.kind === 'assistant') {
                return (
                  <div key={idx} className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg border border-stroke-card bg-surface px-4 py-2.5 text-sm text-fg whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                );
              }
              if (m.kind === 'tool') {
                const Icon =
                  m.status === 'running' ? Loader2
                    : m.status === 'ok' ? CheckCircle2
                      : m.status === 'cancelled' ? Square
                        : XCircle;
                return (
                  <div key={idx} className="flex items-center gap-2 text-xs text-fg-muted px-1">
                    <Wrench size={12} className="shrink-0" />
                    <Icon size={12} className={`shrink-0 ${m.status === 'running' ? 'animate-spin' : ''}`} />
                    <span className="font-medium text-fg-subtle">{m.name}</span>
                    {m.detail && <span className="truncate text-fg-subtle">— {m.detail}</span>}
                  </div>
                );
              }
              if (m.kind === 'confirm') {
                const isActive = pendingConfirm === m || (pendingConfirm && pendingConfirm.name === m.name && pendingConfirm.preview === m.preview);
                return (
                  <div key={idx} className="rounded-lg border border-stroke-accessible bg-surface p-4 max-w-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={16} className="text-saffron-500" />
                      <span className="text-sm font-semibold text-fg">{riskLabel(m.risk)}</span>
                      <span className="text-xs text-fg-subtle font-mono">{m.name}</span>
                    </div>
                    <p className="text-sm text-fg-muted whitespace-pre-wrap mb-3">{m.preview}</p>
                    {isActive && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            m.resolve(true);
                            setPendingConfirm(null);
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            m.resolve(false);
                            setPendingConfirm(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })}

            {status && (
              <div className="flex items-center gap-2 text-xs text-fg-muted">
                <Loader2 size={12} className="animate-spin" />
                {status}
              </div>
            )}
            {error && (
              <div className="rounded-md border border-coral-500/40 bg-coral-500/10 px-3 py-2 text-sm text-fg">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-stroke-card bg-chrome p-3 md:p-4">
          <form
            className="max-w-3xl mx-auto flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder="Ask RecruitScout… (Enter to send, Shift+Enter for newline)"
              className="flex-1 resize-none rounded-md border border-stroke-control border-b-stroke-accessible bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-b-accent min-h-[44px]"
              disabled={busy && !!pendingConfirm}
            />
            {busy ? (
              <button type="button" onClick={cancel} className="btn-danger h-11 px-4 shrink-0" aria-label="Stop">
                <Square size={16} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="btn-primary h-11 px-4 shrink-0"
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            )}
          </form>
          <p className="max-w-3xl mx-auto mt-2 text-xs text-fg-subtle">
            Destructive and email actions ask for confirmation. Cookie and API secrets stay in Settings / Blue.cc / Indeed accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
