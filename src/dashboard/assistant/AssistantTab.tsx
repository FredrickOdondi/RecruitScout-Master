import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, ArrowUp, Square, Search, Pencil, Trash2, Maximize2, X, RotateCcw, AlertCircle, Copy, Check, CornerDownRight } from 'lucide-react';
import { supabaseClient } from '../../shared/supabase';
import { runAssistantTurn } from './client';
import { getToolDef } from './tools';
import {
  appendMessage, createThread, deleteThread, listThreads, loadMessages, renameThread, titleFromPrompt,
} from './persistence';
import type { AgentThread, AssistantUiEvent, BridgeSendMessage, ChatMessage } from './types';
import Markdown from './ui/Markdown';
import Timeline, { WorkingLine, type Step, type DecideFn } from './ui/Timeline';
import './assistant.css';

interface Props {
  sendMessage: BridgeSendMessage;
  focusNonce?: number;
  /** 'page' = full Assistant tab; 'panel' = slide-over opened from another tab */
  variant?: 'page' | 'panel';
  /** Title of the screen the user is on, sent to the model as context */
  viewContext?: string;
  onNavigate?: (view: string) => void;
  onExpand?: () => void;
  onClose?: () => void;
}

type AssistantTurn = {
  kind: 'assistant';
  id: string;
  lead: string;
  steps: Step[];
  text: string;
  streaming: boolean;
  status?: string;
  done: boolean;
  startedAt: number;
  endedAt?: number;
};
type UiItem = { kind: 'user'; id: string; text: string } | AssistantTurn;

const SUGGESTIONS: { area: string; prompts: string[] }[] = [
  { area: 'Swarm', prompts: ['Why is the swarm idle?', 'Start the engine on this browser'] },
  { area: 'Queue', prompts: ['Queue Software Engineer and Data Analyst in Milan on Indeed', 'Reset finished queue tasks'] },
  { area: 'Leads', prompts: ['Match recruiters to new jobs and draft the top 3 emails'] },
  { area: 'Clients', prompts: ['Which clients have no sheet connected?'] },
  { area: 'Indeed', prompts: ['Which Indeed accounts are blocked or expired?'] },
  { area: 'Blue.cc', prompts: ['Summarise the Scrapers board on Blue.cc'] },
];

const uid = () => Math.random().toString(36).slice(2, 10);

/** Slash commands: quick prompts for common jobs (typed as "/" in the composer). */
/**
 * Slash commands. A command whose prompt ends with ": " needs the user's input
 * (e.g. "/queue Chef, Nurse in Milano"); the others run as soon as they're picked.
 * Every one is a full request the Assistant carries out with its tools.
 */
const COMMANDS: { cmd: string; hint: string; prompt: string }[] = [
  { cmd: 'diagnose', hint: 'Why the swarm is or isn\'t scraping', prompt: 'Diagnose the swarm: queue, agents, Indeed accounts and this browser\'s engine. Tell me what is blocking scraping and fix what you can.' },
  { cmd: 'status', hint: 'Platform overview in numbers', prompt: 'Give me the platform overview with the key numbers.' },
  { cmd: 'queue', hint: 'Queue scrape tasks: titles, location', prompt: 'Queue these job titles on Indeed: ' },
  { cmd: 'tasks', hint: 'Queue tasks by status', prompt: 'Show the queue broken down by status, and list the failed and running tasks.' },
  { cmd: 'retry', hint: 'Send failed tasks back to pending', prompt: 'Set every failed queue task back to pending so agents run them again.' },
  { cmd: 'start', hint: 'Start the engine in this browser', prompt: 'Start the engine on this browser so it claims pending queue tasks.' },
  { cmd: 'stop', hint: 'Stop the engine in this browser', prompt: 'Stop the engine on this browser.' },
  { cmd: 'agents', hint: 'Which agents are online', prompt: 'Which scraping agents are online, and when did each last check in?' },
  { cmd: 'jobs', hint: 'Search jobs: title, company or place', prompt: 'Find jobs matching: ' },
  { cmd: 'recruiters', hint: 'Search recruiters: name, place or status', prompt: 'Find recruiters matching: ' },
  { cmd: 'blacklist', hint: 'Blacklisted recruiters', prompt: 'List the blacklisted recruiters with their country and specialty.' },
  { cmd: 'leads', hint: 'Match recruiters and draft emails', prompt: 'Match recruiters to new jobs and draft emails for the top 3.' },
  { cmd: 'emails', hint: 'Lead emails sent recently', prompt: 'Show the lead emails sent in the last 7 days: recruiter, address and number of jobs.' },
  { cmd: 'clients', hint: 'Clients and their sheets', prompt: 'List clients and which ones have no sheet connected.' },
  { cmd: 'sync', hint: 'Sync jobs to client sheets', prompt: 'Sync the latest jobs to every client\'s Google Sheet.' },
  { cmd: 'indeed', hint: 'Indeed account health', prompt: 'Which Indeed accounts are in use, blocked or expired?' },
  { cmd: 'blue', hint: 'Blue.cc boards', prompt: 'Summarise my Blue.cc workspaces and what changed recently.' },
  { cmd: 'export', hint: 'Download jobs as a file', prompt: 'Export the latest 1000 jobs as CSV.' },
  { cmd: 'db', hint: 'Ask anything of the database', prompt: 'From the database: ' },
];

const needsInput = (c: { prompt: string }) => c.prompt.endsWith(': ');

/** "/queue Chef, Nurse in Milano" → the command's full request plus what was typed. */
function expandCommand(text: string): string {
  const m = text.match(/^\/(\w+)\s+([\s\S]+)$/);
  if (!m) return text;
  const c = COMMANDS.find((x) => x.cmd === m[1].toLowerCase());
  if (!c) return text;
  return needsInput(c) ? c.prompt + m[2].trim() : `${c.prompt} ${m[2].trim()}`;
}

/** Short detail for a step chip, from the tool's arguments. */
function argsDetail(args: any): string | undefined {
  if (!args || typeof args !== 'object') return undefined;
  if (Array.isArray(args.ids)) return `${args.ids.length} selected`;
  if (Array.isArray(args.titles)) return [args.titles.slice(0, 2).join(', ') + (args.titles.length > 2 ? ` +${args.titles.length - 2}` : ''), args.location].filter(Boolean).join(' · ');
  const vals = Object.values(args).filter((v) => typeof v === 'string' || typeof v === 'number').slice(0, 2);
  return vals.length ? vals.join(' · ') : undefined;
}

/** Split a reply into its text and the follow-up suggestions block. */
function splitFollowUps(text: string): { body: string; followUps: string[] } {
  const m = text.match(/```followups\s*\n([\s\S]*?)(```|$)/);
  if (!m) return { body: text, followUps: [] };
  const followUps = m[1].split('\n').map((l) => l.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean).slice(0, 3);
  return { body: text.replace(m[0], '').trim(), followUps };
}

/** Saved chat messages → UI items (turns with their steps). */
function historyToItems(messages: ChatMessage[]): UiItem[] {
  const items: UiItem[] = [];
  let turn: AssistantTurn | null = null;
  const ensureTurn = () => {
    if (!turn) {
      turn = { kind: 'assistant', id: uid(), lead: '', steps: [], text: '', streaming: false, done: true, startedAt: 0 };
      items.push(turn);
    }
    return turn;
  };
  for (const m of messages) {
    if (m.role === 'user') {
      turn = null;
      items.push({ kind: 'user', id: m.id || uid(), text: m.content || '' });
    } else if (m.role === 'assistant') {
      const t = ensureTurn();
      if (m.tool_calls?.length) {
        if (m.content) t.lead = t.lead ? `${t.lead}\n\n${m.content}` : m.content;
        for (const c of m.tool_calls) {
          t.steps.push({ id: c.id, name: c.function.name, label: getToolDef(c.function.name)?.label || c.function.name, state: 'ok' });
        }
      } else if (m.content) {
        t.text = m.content;
      }
    } else if (m.role === 'tool' && m.tool_call_id) {
      const t = ensureTurn();
      const step = t.steps.find((s) => s.id === m.tool_call_id);
      if (step) {
        try {
          const parsed = JSON.parse(m.content || '{}');
          const err = parsed?.untrusted_data?.error ?? parsed?.error;
          if (err) {
            step.state = String(err).includes('declined') ? 'declined' : 'error';
            step.error = String(err);
          }
        } catch { /* keep ok */ }
      }
    }
  }
  return items;
}

function relativeTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} d` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function AnswerActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };
  return (
    <div className="flex items-center gap-1 -ml-1.5">
      <button type="button" onClick={copy} className="p-1.5 rounded-md text-fg-subtle hover:text-fg hover:bg-hover transition-colors" aria-label={copied ? 'Copied' : 'Copy answer'}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function Orb({ size = 28, active = false }: { size?: number; active?: boolean }) {
  return <span className="ai-orb" data-active={active} style={{ width: size, height: size }} aria-hidden="true" />;
}

export default function AssistantTab({ sendMessage, focusNonce = 0, variant = 'page', viewContext, onNavigate, onExpand, onClose }: Props) {
  const session = supabaseClient.getSession();
  const userId = session?.user?.id as string | undefined;
  const isPanel = variant === 'panel';

  const [threads, setThreads] = useState<AgentThread[]>([]);
  const [threadQuery, setThreadQuery] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [items, setItems] = useState<UiItem[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retryPrompt?: string } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [cmdIndex, setCmdIndex] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);
  const stickToBottom = useRef(true);
  historyRef.current = history;

  // Pause the aurora when the tab is hidden
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => { if (focusNonce > 0) inputRef.current?.focus(); }, [focusNonce]);

  // Follow new content unless the user has scrolled up to read
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [items]);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // Grow the composer with its content
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const refreshThreads = useCallback(async () => {
    if (userId) setThreads(await listThreads(userId));
  }, [userId]);
  useEffect(() => { refreshThreads(); }, [refreshThreads]);

  const updateTurn = (fn: (t: AssistantTurn) => AssistantTurn) =>
    setItems((prev) => {
      const idx = prev.length - 1;
      const last = prev[idx];
      if (!last || last.kind !== 'assistant') return prev;
      const next = [...prev];
      next[idx] = fn(last);
      return next;
    });

  const updateStep = (id: string, patch: Partial<Step>) =>
    updateTurn((t) => ({ ...t, steps: t.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const handleEvent = (e: AssistantUiEvent) => {
    switch (e.type) {
      case 'status':
        updateTurn((t) => ({ ...t, status: e.message }));
        break;
      case 'assistant_delta':
        updateTurn((t) => ({ ...t, text: t.text + e.delta, streaming: true }));
        break;
      case 'tool_start':
        // Text streamed before a tool call is the Assistant narrating its plan
        updateTurn((t) => ({
          ...t,
          lead: t.text ? (t.lead ? `${t.lead}\n\n${t.text}` : t.text) : t.lead,
          text: '',
          streaming: false,
          steps: t.steps.some((s) => s.id === e.callId) ? t.steps : [...t.steps, { id: e.callId, name: e.name, label: e.label, state: 'running', detail: argsDetail(e.args) }],
        }));
        break;
      case 'needs_approval':
        updateStep(e.callId, { state: 'waiting', approval: { risk: e.risk, preview: e.preview, resolve: e.resolve } });
        break;
      case 'tool_end': {
        const declined = !e.result.ok && (e.result.error || '').includes('declined');
        updateStep(e.callId, {
          state: e.result.ok ? 'ok' : declined ? 'declined' : 'error',
          summary: e.result.summary,
          error: e.result.ok || declined ? undefined : e.result.error,
          durationMs: e.durationMs,
          view: e.result.view,
          approval: undefined,
        });
        break;
      }
      case 'assistant_message':
        updateTurn((t) => ({ ...t, text: e.content, streaming: false }));
        break;
      case 'error':
        setError({ message: e.message });
        break;
      case 'done':
        updateTurn((t) => ({ ...t, done: true, streaming: false, status: undefined, endedAt: Date.now() }));
        setHistory(e.messages.filter((m) => m.role !== 'system'));
        break;
    }
  };

  const redirectRef = useRef<string | null>(null);
  const decide: DecideFn = useCallback((stepId, yes, redirect) => {
    if (redirect) redirectRef.current = redirect;
    setItems((prev) => prev.map((it) => {
      if (it.kind !== 'assistant') return it;
      const step = it.steps.find((s) => s.id === stepId);
      if (!step?.approval) return it;
      step.approval.resolve(yes);
      return { ...it, steps: it.steps.map((s) => (s.id === stepId ? { ...s, state: yes ? 'running' : 'declined', approval: undefined } : s)) };
    }));
  }, []);

  const pendingApproval = useMemo(() => {
    const last = items[items.length - 1];
    return last?.kind === 'assistant' ? last.steps.find((s) => s.state === 'waiting') : undefined;
  }, [items]);

  const openThread = async (id: string) => {
    if (busy) return;
    setThreadId(id);
    setError(null);
    const msgs = (await loadMessages(id)).filter((m) => m.role !== 'system');
    setHistory(msgs);
    setItems(historyToItems(msgs));
    stickToBottom.current = true;
  };

  const startNewChat = () => {
    if (busy) return;
    setThreadId(null);
    setHistory([]);
    setItems([]);
    setError(null);
    inputRef.current?.focus();
  };

  const removeThread = async (id: string) => {
    if (!confirm('Delete this chat?\n\nIts messages are removed. This can\'t be undone.')) return;
    await deleteThread(id);
    if (id === threadId) startNewChat();
    refreshThreads();
  };

  const saveRename = async () => {
    if (!renaming) return;
    const title = renaming.title.trim();
    setRenaming(null);
    if (title) {
      await renameThread(renaming.id, title);
      refreshThreads();
    }
  };

  const submit = async (text?: string) => {
    const prompt = expandCommand((text ?? input).trim());
    if (!prompt || busy || !userId) return;

    let activeThreadId = threadId;
    if (!activeThreadId) {
      const thread = await createThread(userId, titleFromPrompt(prompt));
      if (!thread) { setError({ message: 'The chat couldn\'t be created. Sign in again and retry.' }); return; }
      activeThreadId = thread.id;
      setThreadId(thread.id);
      refreshThreads();
    }

    setInput('');
    setError(null);
    stickToBottom.current = true;
    setItems((prev) => [
      ...prev,
      { kind: 'user', id: uid(), text: prompt },
      { kind: 'assistant', id: uid(), lead: '', steps: [], text: '', streaming: false, status: 'Thinking', done: false, startedAt: Date.now() },
    ]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const next = await runAssistantTurn({
        threadId: activeThreadId, userId, history: historyRef.current, userMessage: prompt,
        bridgeSendMessage: sendMessage, navigate: onNavigate ? (v) => onNavigate(v) : undefined,
        viewContext, onEvent: handleEvent, signal: controller.signal,
      });
      setHistory(next.filter((m) => m.role !== 'system'));
    } catch (err: any) {
      const message = err?.message || String(err);
      if (message === 'Cancelled') {
        updateTurn((t) => ({ ...t, done: true, streaming: false, status: undefined, endedAt: Date.now(), text: t.text || '_Stopped._' }));
      } else {
        updateTurn((t) => ({ ...t, done: true, streaming: false, status: undefined, endedAt: Date.now() }));
        setError({ message, retryPrompt: err?.retryable ? prompt : undefined });
        appendMessage(activeThreadId, { role: 'assistant', content: `Error: ${message}` }).catch(() => {});
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      refreshThreads();
      // "Something else…" on an approval card becomes the next request
      const redirect = redirectRef.current;
      redirectRef.current = null;
      if (redirect) setTimeout(() => submit(redirect), 0);
    }
  };

  const stop = () => {
    if (pendingApproval) decide(pendingApproval.id, false);
    abortRef.current?.abort();
  };

  const filteredThreads = threadQuery.trim()
    ? threads.filter((t) => t.title.toLowerCase().includes(threadQuery.trim().toLowerCase()))
    : threads;

  if (!userId) {
    return <div className="flex-1 flex items-center justify-center text-fg-muted text-sm">Sign in to use the Assistant.</div>;
  }

  const empty = items.length === 0;
  const slash = input.startsWith('/') && !input.includes(' ') ? input.slice(1).toLowerCase() : null;
  const commandMatches = slash === null ? [] : COMMANDS.filter((c) => c.cmd.startsWith(slash));
  const pickCommand = (c: (typeof COMMANDS)[number]) => {
    setCmdIndex(0);
    if (needsInput(c)) {
      setInput(c.prompt);
      inputRef.current?.focus();
      return;
    }
    setInput('');
    void submit(c.prompt);
  };

  return (
    <div className={`ai-root flex flex-1 min-h-0 ${isPanel ? 'h-full' : ''}`} data-busy={busy} data-hidden={hidden}>
      <div className="ai-aurora" aria-hidden="true"><span /></div>
      <div className="ai-grid" aria-hidden="true" />

      {/* Thread rail */}
      {!isPanel && (
        <aside className="ai-rail hidden lg:flex w-64 flex-col min-h-0 border-r border-stroke-card shrink-0" aria-label="Chats">
          <div className="p-3 space-y-2">
            <button type="button" onClick={startNewChat} className="btn-secondary w-full" disabled={busy}>
              <Plus size={16} /> New chat
            </button>
            <label className="relative block">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <input
                type="search" value={threadQuery} onChange={(e) => setThreadQuery(e.target.value)}
                placeholder="Search chats" aria-label="Search chats" className="input pl-8 h-8"
              />
            </label>
          </div>
          <nav className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-3 space-y-0.5">
            {filteredThreads.map((t) => {
              const active = threadId === t.id;
              return (
                <div key={t.id} className={`group relative flex items-center rounded-md transition-colors ${active ? 'bg-surface shadow-[inset_0_0_0_1px_rgb(var(--g-stroke-card))]' : 'hover:bg-hover'}`}>
                  {renaming?.id === t.id ? (
                    <input
                      autoFocus value={renaming.title}
                      onChange={(e) => setRenaming({ id: t.id, title: e.target.value })}
                      onBlur={saveRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenaming(null); }}
                      className="input h-8 m-0.5" aria-label="Chat name"
                    />
                  ) : (
                    <button type="button" onClick={() => openThread(t.id)} className="flex-1 min-w-0 text-left px-3 py-2" aria-current={active ? 'true' : undefined}>
                      <span className={`block text-sm truncate ${active ? 'text-fg font-medium' : 'text-fg-muted'}`}>{t.title}</span>
                      <span className="block text-xs text-fg-subtle">{relativeTime(t.updated_at)}</span>
                    </button>
                  )}
                  {renaming?.id !== t.id && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <button type="button" onClick={() => setRenaming({ id: t.id, title: t.title })} className="p-1.5 rounded text-fg-subtle hover:text-fg hover:bg-hover" aria-label={`Rename ${t.title}`}><Pencil size={13} /></button>
                      <button type="button" onClick={() => removeThread(t.id)} className="p-1.5 rounded text-fg-subtle hover:text-danger-fg hover:bg-hover" aria-label={`Delete ${t.title}`}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              );
            })}
            {!filteredThreads.length && (
              <p className="text-xs text-fg-subtle px-3 py-4">{threadQuery ? 'No chats match.' : 'Your chats appear here.'}</p>
            )}
          </nav>
        </aside>
      )}

      {/* Conversation */}
      <section className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="h-12 px-4 flex items-center gap-2.5 shrink-0 border-b border-stroke-card/70">
          <Orb size={20} active={busy} />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-fg leading-tight">Assistant</h2>
            <p className="text-xs text-fg-subtle leading-tight truncate">
              {busy ? (pendingApproval ? 'Waiting for your approval' : 'Working') : 'Runs RecruitScout for you · risky actions need your approval'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={startNewChat} className={`btn-ghost px-2 ${isPanel ? '' : 'lg:hidden'}`} aria-label="New chat" disabled={busy}><Plus size={16} /></button>
            {isPanel && onExpand && <button type="button" onClick={onExpand} className="btn-ghost px-2" aria-label="Open the full Assistant"><Maximize2 size={15} /></button>}
            {isPanel && onClose && <button type="button" onClick={onClose} className="btn-ghost px-2" aria-label="Close the Assistant"><X size={16} /></button>}
          </div>
        </header>

        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className={`mx-auto px-4 ${isPanel ? 'py-4' : 'md:px-6 py-8'} max-w-[760px]`}>
            {empty && (
              <div className={`ai-in ${isPanel ? 'pt-4' : 'pt-[8vh]'}`}>
                <Orb size={isPanel ? 36 : 52} />
                <h1 className={`${isPanel ? 'text-xl mt-4' : 'text-3xl mt-6'} font-semibold text-fg`}>What should we run?</h1>
                <p className="text-sm text-fg-muted mt-2 max-w-[52ch]">
                  Ask about anything in RecruitScout, or tell me what to do. I work through the same actions as the dashboard and show every step. Deletes, bulk changes, emails and agent controls wait for your approval.
                </p>
                <div className="mt-8 space-y-3">
                  {SUGGESTIONS.map((g) => (
                    <div key={g.area} className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                      <span className="w-16 shrink-0 text-xs text-fg-subtle">{g.area}</span>
                      <div className="flex flex-wrap gap-2 flex-1">
                        {g.prompts.map((p) => (
                          <button
                            key={p} type="button" onClick={() => submit(p)}
                            className="ai-glass rounded-full px-3 py-1.5 text-sm text-fg-muted hover:text-fg hover:border-stroke-control transition-colors text-left"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              {items.map((it) => {
                if (it.kind === 'user') {
                  return (
                    <div key={it.id} className="ai-in flex justify-end">
                      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent-subtle-2 text-fg px-4 py-2.5 text-sm whitespace-pre-wrap break-words">{it.text}</p>
                    </div>
                  );
                }
                const waiting = it.steps.some((s) => s.state === 'waiting');
                const runningStep = it.steps.find((s) => s.state === 'running');
                const { body, followUps } = splitFollowUps(it.text);
                const isLast = items[items.length - 1] === it;
                return (
                  <article key={it.id} className="ai-in flex gap-3">
                    <Orb size={24} active={!it.done} />
                    <div className="flex-1 min-w-0 space-y-3 pt-0.5">
                      {it.lead && <div className="text-fg-muted"><Markdown text={it.lead} /></div>}
                      <Timeline steps={it.steps} live={!it.done} elapsedMs={it.endedAt && it.startedAt ? it.endedAt - it.startedAt : undefined} onDecide={decide} />
                      {!it.done && !waiting && !it.streaming && (
                        <WorkingLine verb={runningStep ? runningStep.label : it.status || 'Thinking'} since={it.startedAt} />
                      )}
                      {body && <Markdown text={body} streaming={it.streaming} />}
                      {it.done && body && <AnswerActions text={body} />}
                      {it.done && isLast && followUps.length > 0 && (
                        <div className="ai-in pt-1">
                          <p className="text-xs text-fg-subtle mb-1.5">Follow-ups</p>
                          <div className="flex flex-col items-start gap-1">
                            {followUps.map((f) => (
                              <button key={f} type="button" onClick={() => submit(f)} disabled={busy} className="flex items-center gap-2 text-sm text-fg-muted hover:text-fg py-1 transition-colors text-left">
                                <CornerDownRight size={14} className="text-fg-subtle shrink-0" aria-hidden="true" />
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {error && (
                <div className="ai-in flex items-start gap-3 rounded-lg bg-danger-bg text-danger-fg px-4 py-3 text-sm" role="alert">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p className="flex-1">{error.message}</p>
                  {error.retryPrompt && (
                    <button type="button" className="btn-secondary shrink-0" onClick={() => { setItems((p) => p.slice(0, -2)); submit(error.retryPrompt); }}>
                      <RotateCcw size={14} /> Try again
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className={`shrink-0 px-4 ${isPanel ? 'pb-3' : 'md:px-6 pb-5'} pt-2`}>
          {commandMatches.length > 0 && (
            <div className="ai-in mx-auto max-w-[760px] mb-2 ai-glass rounded-xl p-1.5 shadow-dialog max-h-[min(360px,45vh)] overflow-y-auto" role="listbox" aria-label="Commands">
              {commandMatches.map((c, i) => (
                <button
                  key={c.cmd} type="button" role="option" aria-selected={i === cmdIndex}
                  ref={i === cmdIndex ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  onMouseEnter={() => setCmdIndex(i)} onClick={() => pickCommand(c)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${i === cmdIndex ? 'bg-hover' : ''}`}
                >
                  <span className="mono-id text-accent-text w-20 shrink-0">/{c.cmd}</span>
                  <span className="text-sm text-fg-muted truncate">{c.hint}</span>
                </button>
              ))}
              <p className="px-2.5 pt-1 pb-0.5 text-xs text-fg-subtle">Type to filter · Enter to run · commands with “:” take your details</p>
            </div>
          )}
          <form
            className="ai-composer ai-glass mx-auto max-w-[760px] flex items-end gap-2 p-2 pl-4"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (commandMatches.length) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIndex((i) => (i + 1) % commandMatches.length); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setCmdIndex((i) => (i - 1 + commandMatches.length) % commandMatches.length); return; }
                  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickCommand(commandMatches[Math.min(cmdIndex, commandMatches.length - 1)]); return; }
                  if (e.key === 'Escape') { setInput(''); return; }
                }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              rows={1}
              placeholder={busy ? 'Working… you can type your next request' : 'Ask or tell RecruitScout what to do, or type / for commands'}
              aria-label="Message the Assistant"
              className="flex-1 resize-none bg-transparent border-0 py-2 text-sm text-fg placeholder:text-fg-subtle max-h-[200px] focus:shadow-none"
              style={{ outlineOffset: 4 }}
            />
            {busy ? (
              <button type="button" onClick={stop} className="w-9 h-9 rounded-full bg-fg text-surface flex items-center justify-center shrink-0 transition-colors" aria-label="Stop">
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit" disabled={!input.trim()} aria-label="Send"
                className="w-9 h-9 rounded-full bg-accent text-on-accent flex items-center justify-center shrink-0 transition-colors hover:bg-accent-700 disabled:bg-subtle disabled:text-fg-subtle"
              >
                <ArrowUp size={17} />
              </button>
            )}
          </form>
          {!isPanel && (
            <p className="mx-auto max-w-[760px] mt-2 text-xs text-fg-subtle text-center">
              <span className="mono-id">Enter</span> to send · <span className="mono-id">Shift Enter</span> for a new line · <span className="mono-id">Ctrl K</span> opens the Assistant anywhere
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
