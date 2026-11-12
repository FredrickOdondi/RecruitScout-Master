import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Tag, ChevronRight, ChevronLeft, Bell, Settings, RefreshCw, MessageSquare, Check, X,
  CornerUpLeft, Loader2, AlertCircle,
} from 'lucide-react';
import { supabaseClient } from '../shared/supabase';
import { BlueCcClient } from '../shared/bluecc';

// Column and workspace dots use the six Glacier accent families (data colour, not status).
const FAMILY_DOTS = ['#1E70A7', '#0B7A75', '#6840E7', '#B27F00', '#00803F', '#B23F09'];
const LAST_WORKSPACE_KEY = 'rs_blue_last_workspace';
const AUTO_REFRESH_MS = 60000;

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(user?: { firstName?: string; lastName?: string }) {
  return `${user?.firstName?.[0] ?? '?'}${user?.lastName?.[0] ?? ''}`.toUpperCase();
}

function fullName(user?: { firstName?: string; lastName?: string }) {
  return `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Unknown';
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Try again.');

/** A Blue.cc tag: the word plus a dot in the tag's own colour. */
function TagBadge({ tag }: { tag: any }) {
  return (
    <span className="badge bg-neutral-badge text-fg-muted max-w-full">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color || 'rgb(var(--g-fg-subtle))' }} aria-hidden="true" />
      <span className="truncate">{tag.title}</span>
    </span>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [tokenId, setTokenId] = useState('');
  const [secretId, setSecretId] = useState('');
  const [companyId, setCompanyId] = useState('');

  const [client, setClient] = useState<BlueCcClient | null>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState<any | null>(null);
  const [workspaceData, setWorkspaceData] = useState<any | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [refreshingBoard, setRefreshingBoard] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Card detail panel
  const [selectedTodo, setSelectedTodo] = useState<any | null>(null);
  const [todoDetail, setTodoDetail] = useState<{ text: string; comments: any[] } | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState<{ id: string; name: string } | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Drag and drop
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [dropListId, setDropListId] = useState<string | null>(null);

  // Mentions
  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([]);
  const [mentionSearch, setMentionSearch] = useState<{ query: string; position: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Notifications
  const [mentions, setMentions] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Short-lived message for failures that would otherwise be silent
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 6000);
  }, []);

  const requestIdRef = useRef(0);

  // Close the notifications dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Escape closes the card panel, then the notifications
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (selectedTodo) setSelectedTodo(null);
      else if (showNotifications) setShowNotifications(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedTodo, showNotifications]);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadBoard = useCallback(async (blueClient: BlueCcClient, ws: any, background = false) => {
    const thisRequestId = ++requestIdRef.current;
    if (background) setRefreshingBoard(true);
    else { setLoadingWorkspace(true); setWorkspaceData(null); }
    setBoardError(null);
    try {
      const data = await blueClient.getWorkspaceContent(ws.id, ws.companyId);
      if (thisRequestId !== requestIdRef.current) return;
      setWorkspaceData(data);
      // Keep the open card in sync with the latest board data
      setSelectedTodo((open: any) => {
        if (!open) return open;
        for (const l of data.lists || []) {
          const fresh = (l.todos || []).find((t: any) => t.id === open.id);
          if (fresh) return { ...open, ...fresh };
        }
        return open;
      });
      if (!background) {
        const users = await blueClient.getWorkspaceUsers(ws.id);
        if (thisRequestId === requestIdRef.current) setWorkspaceUsers(users);
      }
    } catch (err) {
      if (thisRequestId !== requestIdRef.current) return;
      if (background) showToast(`The board didn't refresh. ${errorText(err)}`);
      else setBoardError(errorText(err));
    } finally {
      if (thisRequestId === requestIdRef.current) {
        setLoadingWorkspace(false);
        setRefreshingBoard(false);
      }
    }
  }, [showToast]);

  const handleSelectWorkspace = (ws: any) => {
    setSelectedWorkspace(ws);
    setSelectedTodo(null);
    try { localStorage.setItem(LAST_WORKSPACE_KEY, ws.id); } catch { /* ignore */ }
    if (client) loadBoard(client, ws);
  };

  const fetchWorkspaces = useCallback(async (blueClient: BlueCcClient) => {
    setLoadingWorkspaces(true);
    setWorkspacesError(null);
    try {
      const data = await blueClient.getWorkspaces();
      setWorkspaces(data);
      return data as any[];
    } catch (err) {
      setWorkspacesError(errorText(err));
      return [];
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  const fetchMentions = useCallback(async (blueClient: BlueCcClient) => {
    try {
      const result = await blueClient.getMentions(20);
      setMentions(result.items);
    } catch (err) {
      console.info('[Blue.cc] Mentions did not load:', errorText(err));
    }
  }, []);

  // Connect, list workspaces and reopen the workspace used last time
  const connect = useCallback(async (blueClient: BlueCcClient) => {
    setClient(blueClient);
    fetchMentions(blueClient);
    const list = await fetchWorkspaces(blueClient);
    let lastId: string | null = null;
    try { lastId = localStorage.getItem(LAST_WORKSPACE_KEY); } catch { /* ignore */ }
    const last = list.find(w => w.id === lastId);
    if (last) {
      setSelectedWorkspace(last);
      loadBoard(blueClient, last);
    }
    return list;
  }, [fetchMentions, fetchWorkspaces, loadBoard]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const session = supabaseClient.getSession();
      if (session?.user?.id) {
        const res = await supabaseClient.getUserIntegration(session.user.id);
        if (res.data) {
          setTokenId(res.data.bluecc_token_id || '');
          setSecretId(res.data.bluecc_secret_id || '');
          setCompanyId(res.data.bluecc_company_id || '');
          if (res.data.bluecc_token_id && res.data.bluecc_secret_id) {
            connect(new BlueCcClient(res.data.bluecc_token_id, res.data.bluecc_secret_id, res.data.bluecc_company_id || undefined));
          } else {
            setShowSettings(true);
          }
        } else {
          setShowSettings(true);
        }
      }
      setLoading(false);
    })();
  }, [connect]);

  // Keep the board current: refresh every minute while visible, and on returning to the tab
  useEffect(() => {
    if (!client || !selectedWorkspace) return;
    const refresh = () => {
      if (document.visibilityState === 'visible' && !draggedTodoId) loadBoard(client, selectedWorkspace, true);
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [client, selectedWorkspace, draggedTodoId, loadBoard]);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSettingsError(null);
    const session = supabaseClient.getSession();
    if (!session?.user?.id) {
      setSettingsError('Your session has ended. Sign in again.');
      setSaving(false);
      return;
    }
    const res = await supabaseClient.upsertUserIntegration({
      user_id: session.user.id, bluecc_token_id: tokenId.trim(), bluecc_secret_id: secretId.trim(), bluecc_company_id: companyId.trim(),
    });
    if (res.error) {
      setSettingsError(`Credentials weren't saved. ${res.error}`);
    } else {
      const c = new BlueCcClient(tokenId.trim(), secretId.trim(), companyId.trim() || undefined);
      await connect(c);
      setShowSettings(false);
    }
    setSaving(false);
  };

  // ── Card detail and comments ───────────────────────────────────────────────

  const loadComments = useCallback(async (todo: any) => {
    if (!client || !selectedWorkspace) return;
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const result = await client.getTodoComments(todo.id, selectedWorkspace.id);
      setTodoDetail({ text: todo.text || '', comments: result?.comments || [] });
    } catch (err) {
      setTodoDetail({ text: todo.text || '', comments: [] });
      setDetailError(`Comments didn't load. ${errorText(err)}`);
    } finally {
      setLoadingDetail(false);
    }
  }, [client, selectedWorkspace]);

  const handleTodoClick = (todo: any) => {
    setSelectedTodo(todo);
    setTodoDetail(null);
    setNewCommentText('');
    setReplyingToComment(null);
    setMentionSearch(null);
    loadComments(todo);
  };

  const handleSubmitComment = async () => {
    if (!newCommentText.trim() || !client || !selectedWorkspace || !selectedTodo) return;
    setIsSubmittingComment(true);
    try {
      await client.createComment(selectedTodo.id, 'TODO', newCommentText.trim(), selectedWorkspace.id, replyingToComment?.id);
      const result = await client.getTodoComments(selectedTodo.id, selectedWorkspace.id);
      setTodoDetail(prev => ({ text: prev?.text || '', comments: result?.comments || [] }));
      // Keep the card's comment count in step without reloading the board
      const total = (result?.comments || []).reduce((n: number, c: any) => n + 1 + (c.replies?.length || 0), 0);
      setWorkspaceData((prev: any) => prev && ({
        ...prev,
        lists: prev.lists.map((l: any) => ({
          ...l,
          todos: (l.todos || []).map((t: any) => (t.id === selectedTodo.id ? { ...t, commentCount: total } : t)),
        })),
      }));
      setNewCommentText('');
      setReplyingToComment(null);
      setMentionSearch(null);
    } catch (err) {
      showToast(`Your comment wasn't posted. ${errorText(err)}`);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewCommentText(val);
    const match = val.slice(0, e.target.selectionStart).match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    setMentionSearch(match ? { query: match[1].toLowerCase(), position: e.target.selectionStart } : null);
  };

  const insertMention = (user: any) => {
    if (!mentionSearch || !textareaRef.current) return;
    const start = newCommentText.slice(0, mentionSearch.position - mentionSearch.query.length - 1);
    const end = newCommentText.slice(textareaRef.current.selectionStart);
    setNewCommentText(`${start}@${fullName(user)} ${end}`);
    setMentionSearch(null);
    textareaRef.current.focus();
  };

  const mentionMatches = useMemo(
    () => (mentionSearch ? workspaceUsers.filter(u => fullName(u).toLowerCase().includes(mentionSearch.query)) : []),
    [mentionSearch, workspaceUsers],
  );

  // ── Moving cards between lists ─────────────────────────────────────────────

  const handleDrop = async (targetListId: string, todoId: string) => {
    if (!todoId || !workspaceData || !client || !selectedWorkspace) return;
    const fromList = workspaceData.lists.find((l: any) => l.todos?.some((t: any) => t.id === todoId));
    if (!fromList || fromList.id === targetListId) return;

    const before = workspaceData;
    setWorkspaceData((prev: any) => {
      if (!prev) return prev;
      const lists = prev.lists.map((l: any) => ({ ...l, todos: [...(l.todos || [])] }));
      const src = lists.find((l: any) => l.id === fromList.id);
      const idx = src.todos.findIndex((t: any) => t.id === todoId);
      const [moved] = src.todos.splice(idx, 1);
      lists.find((l: any) => l.id === targetListId)?.todos.unshift(moved);
      return { ...prev, lists };
    });

    try {
      await client.moveTodo(todoId, targetListId, selectedWorkspace.id);
    } catch (err) {
      setWorkspaceData(before); // put the card back where it was
      showToast(`The card wasn't moved. ${errorText(err)}`);
    }
  };

  const unreadCount = mentions.filter(m => !m.isRead).length;

  // Sorted copies for display; never sort state in place
  const lists = useMemo(() => (workspaceData?.lists || []).map((list: any) => ({
    ...list,
    todos: [...(list.todos || [])].sort((a: any, b: any) => (b.position || 0) - (a.position || 0)),
  })), [workspaceData]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-fg-muted text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading Blue.cc…
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes blueSlideIn { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes blueFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .blue-slide-in { animation: blueSlideIn 200ms cubic-bezier(0.16, 1, 0.3, 1); }
        .blue-fade-in { animation: blueFadeIn 150ms ease-out; }
        @media (prefers-reduced-motion: reduce) { .blue-slide-in, .blue-fade-in { animation: none; } }
      `}</style>

      <div className="flex flex-col bg-canvas text-fg" style={{ height: '100%', minHeight: '600px' }}>

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-stroke-card bg-surface shrink-0">
          <nav className="flex items-center gap-1.5 min-w-0 text-sm" aria-label="Breadcrumb">
            <Tag size={16} className="text-accent-text shrink-0" aria-hidden="true" />
            <span className="font-medium text-fg">Blue.cc</span>
            {selectedWorkspace && (
              <>
                <ChevronRight size={14} className="text-fg-subtle shrink-0" aria-hidden="true" />
                <span className="text-fg-muted truncate">{selectedWorkspace.name}</span>
              </>
            )}
            {refreshingBoard && <Loader2 size={14} className="animate-spin text-fg-subtle ml-1" aria-label="Refreshing" />}
          </nav>

          <div className="flex items-center gap-1">
            {client && selectedWorkspace && (
              <button
                onClick={() => loadBoard(client, selectedWorkspace, true)}
                disabled={refreshingBoard}
                className="btn-ghost px-2"
                aria-label="Refresh board"
                title="Refresh board"
              >
                <RefreshCw size={16} className={refreshingBoard ? 'animate-spin' : ''} />
              </button>
            )}

            {client && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifications(v => !v)}
                  className="btn-ghost px-2 relative"
                  aria-label={unreadCount ? `Mentions, ${unreadCount} unread` : 'Mentions'}
                  aria-expanded={showNotifications}
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-danger-solid text-fg-on-solid text-xs leading-4 font-medium text-center tabular">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-10 z-50 w-80 bg-surface rounded-xl shadow-dialog border border-stroke-card overflow-hidden blue-fade-in">
                    <div className="px-4 h-11 border-b border-stroke-divider flex items-center justify-between">
                      <span className="text-sm font-semibold">Mentions</span>
                      {unreadCount > 0 && <span className="text-xs text-fg-muted">{unreadCount} unread</span>}
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                      {mentions.length === 0 && (
                        <p className="py-8 text-center text-fg-subtle text-sm">No mentions yet</p>
                      )}
                      {mentions.map(m => (
                        <button
                          key={m.id}
                          className="w-full flex gap-3 px-4 py-3 text-left hover:bg-hover border-b border-stroke-divider last:border-b-0"
                          onClick={() => {
                            const ws = workspaces.find(w => w.id === m.targetWorkspace?.id);
                            if (ws) handleSelectWorkspace(ws);
                            setShowNotifications(false);
                          }}
                        >
                          <span className="w-8 h-8 rounded-full bg-accent-subtle-2 text-accent-subtle-fg flex items-center justify-center text-xs font-medium shrink-0">
                            {initials(m.mentioner)}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-fg">
                              <span className="font-medium">{fullName(m.mentioner)}</span> mentioned you in{' '}
                              <span className="font-medium">{m.targetWorkspace?.name}</span>
                            </span>
                            <span className="block text-xs text-fg-subtle mt-0.5">{timeAgo(m.createdAt)}</span>
                          </span>
                          {!m.isRead && <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" aria-label="Unread" />}
                        </button>
                      ))}
                    </div>
                    <div className="px-2 py-1.5 border-t border-stroke-divider">
                      <button onClick={() => fetchMentions(client)} className="btn-ghost w-full">Refresh mentions</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setShowSettings(v => !v)}
              className={`btn-ghost px-2 ${showSettings ? 'bg-hover text-fg' : ''}`}
              aria-label="Blue.cc settings"
              aria-expanded={showSettings}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* ── Credentials ── */}
        {showSettings && (
          <form onSubmit={handleSaveCredentials} className="border-b border-stroke-card bg-surface px-4 py-4 shrink-0 blue-fade-in">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-sm font-semibold">Blue.cc API credentials</h2>
                <p className="text-xs text-fg-muted mt-0.5">Create a token in Blue.cc under Profile, then API. The company ID is found automatically if left empty.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-medium block">Token ID</span>
                <input type="text" required value={tokenId} onChange={e => setTokenId(e.target.value)} className="input mono-id" autoComplete="off" />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium block">Secret</span>
                <input type="password" required value={secretId} onChange={e => setSecretId(e.target.value)} className="input" autoComplete="off" />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium block">Company ID <span className="font-normal text-fg-subtle">(optional)</span></span>
                <input type="text" value={companyId} onChange={e => setCompanyId(e.target.value)} placeholder="Found automatically" className="input mono-id" autoComplete="off" />
              </label>
            </div>
            {settingsError && <p className="text-sm text-danger-fg mt-3">{settingsError}</p>}
            <div className="flex items-center gap-2 mt-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Connecting…' : 'Save and connect'}
              </button>
              {client && (
                <button type="button" onClick={() => setShowSettings(false)} className="btn-ghost">Cancel</button>
              )}
            </div>
          </form>
        )}

        {/* ── Body: workspaces + board ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Workspaces */}
          <aside
            className="flex flex-col border-r border-stroke-card bg-surface shrink-0 transition-[width] duration-200"
            style={{ width: sidebarOpen ? 220 : 48 }}
            aria-label="Workspaces"
          >
            <div className={`flex items-center h-11 border-b border-stroke-divider ${sidebarOpen ? 'px-3' : 'justify-center'}`}>
              {sidebarOpen && <span className="text-xs font-medium text-fg-subtle flex-1">Workspaces</span>}
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className="p-1 rounded-md text-fg-subtle hover:text-fg hover:bg-hover"
                aria-label={sidebarOpen ? 'Collapse workspaces' : 'Expand workspaces'}
              >
                {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
              {!client && sidebarOpen && <p className="px-2 py-4 text-sm text-fg-subtle text-center">Not connected</p>}
              {client && loadingWorkspaces && sidebarOpen && (
                <p className="px-2 py-4 text-sm text-fg-subtle flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</p>
              )}
              {client && workspacesError && sidebarOpen && (
                <div className="px-2 py-3 text-sm text-danger-fg">
                  Workspaces didn't load. {workspacesError}
                  <button onClick={() => fetchWorkspaces(client)} className="block mt-2 text-accent-text font-medium hover:underline">Try again</button>
                </div>
              )}
              {client && !loadingWorkspaces && !workspacesError && workspaces.length === 0 && sidebarOpen && (
                <p className="px-2 py-4 text-sm text-fg-subtle text-center">No workspaces</p>
              )}
              {workspaces.map((ws, i) => {
                const isSelected = selectedWorkspace?.id === ws.id;
                const hasMention = mentions.some(m => !m.isRead && m.targetWorkspace?.id === ws.id);
                return (
                  <button
                    key={ws.id}
                    onClick={() => handleSelectWorkspace(ws)}
                    title={ws.name}
                    aria-current={isSelected ? 'page' : undefined}
                    className={`w-full flex items-center gap-2.5 h-9 rounded-md text-sm text-left transition-colors ${sidebarOpen ? 'px-2.5' : 'justify-center'} ${
                      isSelected
                        ? 'bg-surface-alt text-fg font-medium shadow-[inset_0_0_0_1px_rgb(var(--g-stroke-card))]'
                        : 'text-fg-muted hover:bg-hover hover:text-fg'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: FAMILY_DOTS[i % FAMILY_DOTS.length] }} aria-hidden="true" />
                    {sidebarOpen && <span className="truncate flex-1">{ws.name}</span>}
                    {sidebarOpen && hasMention && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-label="Unread mention" />}
                  </button>
                );
              })}
            </div>

            {client && (
              <div className="border-t border-stroke-divider p-1.5">
                <button
                  onClick={() => { fetchWorkspaces(client); fetchMentions(client); }}
                  className={`w-full flex items-center gap-2 h-8 rounded-md text-sm text-fg-muted hover:text-fg hover:bg-hover ${sidebarOpen ? 'px-2.5' : 'justify-center'}`}
                  aria-label="Refresh workspaces"
                >
                  <RefreshCw size={14} className={loadingWorkspaces ? 'animate-spin' : ''} />
                  {sidebarOpen && 'Refresh workspaces'}
                </button>
              </div>
            )}
          </aside>

          {/* Board */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {!client && (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-xs">
                  <div className="w-12 h-12 rounded-xl bg-accent-subtle-2 text-accent-text flex items-center justify-center mx-auto mb-3"><Tag size={20} /></div>
                  <h2 className="text-base font-semibold">Connect Blue.cc</h2>
                  <p className="text-sm text-fg-muted mt-1 mb-4">Add your Blue.cc API credentials to see your workspaces here.</p>
                  <button onClick={() => setShowSettings(true)} className="btn-primary">Add API credentials</button>
                </div>
              </div>
            )}

            {client && !selectedWorkspace && (
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div>
                  <h2 className="text-base font-semibold">Choose a workspace</h2>
                  <p className="text-sm text-fg-muted mt-1">Select a workspace on the left to open its board.</p>
                </div>
              </div>
            )}

            {client && selectedWorkspace && (
              <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 custom-scrollbar">
                {loadingWorkspace && (
                  <div className="flex gap-4 h-full" aria-label="Loading board">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="w-[280px] shrink-0 rounded-xl border border-stroke-card bg-surface-alt p-3 space-y-2.5 animate-pulse">
                        <div className="h-4 w-28 rounded bg-subtle" />
                        {[0, 1, 2].map(j => <div key={j} className="h-20 rounded-lg bg-surface border border-stroke-card" />)}
                      </div>
                    ))}
                  </div>
                )}

                {!loadingWorkspace && boardError && (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center max-w-sm">
                      <AlertCircle size={24} className="text-danger-fg mx-auto mb-2" />
                      <h2 className="text-base font-semibold">The board didn't load</h2>
                      <p className="text-sm text-fg-muted mt-1 mb-4">{boardError}</p>
                      <button onClick={() => loadBoard(client, selectedWorkspace)} className="btn-secondary">Try again</button>
                    </div>
                  </div>
                )}

                {!loadingWorkspace && !boardError && lists.length > 0 && (
                  <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
                    {lists.map((list: any, idx: number) => {
                      const isDropTarget = dropListId === list.id && !!draggedTodoId;
                      return (
                        <section
                          key={list.id}
                          aria-label={list.title}
                          className={`flex flex-col w-[280px] shrink-0 max-h-full rounded-xl border transition-colors ${
                            isDropTarget ? 'border-accent bg-accent-subtle' : 'border-stroke-card bg-surface-alt'
                          }`}
                          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dropListId !== list.id) setDropListId(list.id); }}
                          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropListId(null); }}
                          onDrop={e => {
                            e.preventDefault();
                            setDropListId(null);
                            handleDrop(list.id, e.dataTransfer.getData('text/plain'));
                          }}
                        >
                          <header className="flex items-center gap-2 px-3 h-11 shrink-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: FAMILY_DOTS[idx % FAMILY_DOTS.length] }} aria-hidden="true" />
                            <h3 className="text-sm font-semibold truncate flex-1">{list.title}</h3>
                            <span className="text-xs text-fg-muted tabular px-1.5 rounded-full bg-neutral-badge">{list.todos.length}</span>
                          </header>

                          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2 custom-scrollbar">
                            {list.todos.length === 0 && (
                              <div className={`flex items-center justify-center h-20 rounded-lg border border-dashed text-sm ${isDropTarget ? 'border-accent text-accent-text' : 'border-stroke-control text-fg-subtle'}`}>
                                {isDropTarget ? 'Drop to move here' : 'No cards'}
                              </div>
                            )}
                            {list.todos.map((todo: any) => (
                              <article
                                key={todo.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleTodoClick(todo)}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTodoClick(todo); } }}
                                draggable
                                onDragStart={e => { e.dataTransfer.setData('text/plain', todo.id); e.dataTransfer.effectAllowed = 'move'; setDraggedTodoId(todo.id); }}
                                onDragEnd={() => { setDraggedTodoId(null); setDropListId(null); }}
                                className={`block bg-surface rounded-lg border border-stroke-card shadow-raised px-3 py-2.5 cursor-pointer transition-[border-color,box-shadow,opacity] hover:border-stroke-control hover:shadow-card ${
                                  draggedTodoId === todo.id ? 'opacity-40' : ''
                                }`}
                              >
                                {todo.tags?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-1.5">
                                    {todo.tags.map((tag: any) => <TagBadge key={tag.id} tag={tag} />)}
                                  </div>
                                )}
                                <p className={`text-sm leading-5 break-words ${todo.done ? 'text-fg-muted' : 'text-fg'}`}>{todo.title}</p>
                                {(todo.done || (todo.commentCount ?? 0) > 0) && (
                                  <div className="flex items-center gap-3 mt-2 text-xs text-fg-subtle">
                                    {todo.done && <span className="flex items-center gap-1 text-success-fg"><Check size={12} /> Done</span>}
                                    {(todo.commentCount ?? 0) > 0 && (
                                      <span className="flex items-center gap-1 ml-auto" aria-label={`${todo.commentCount} comments`}>
                                        <MessageSquare size={12} /> <span className="tabular">{todo.commentCount}</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </article>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}

                {!loadingWorkspace && !boardError && workspaceData && lists.length === 0 && (
                  <div className="flex h-full items-center justify-center text-sm text-fg-muted">This workspace has no lists yet.</div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── Card detail panel ── */}
      {selectedTodo && (
        <div className="fixed inset-0 z-[80] flex" role="dialog" aria-modal="true" aria-labelledby="blue-card-title">
          <div className="flex-1 bg-black/40 blue-fade-in" onClick={() => setSelectedTodo(null)} />
          <div className="w-full max-w-[560px] bg-surface flex flex-col shadow-flyout border-l border-stroke-card blue-slide-in">

            <div className="flex items-start gap-3 px-5 py-4 border-b border-stroke-divider shrink-0">
              <span className={`mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                selectedTodo.done ? 'bg-success-fg border-success-fg text-surface' : 'border-stroke-accessible'
              }`} aria-label={selectedTodo.done ? 'Done' : 'Not done'}>
                {selectedTodo.done && <Check size={12} strokeWidth={3} />}
              </span>
              <div className="flex-1 min-w-0">
                <h2 id="blue-card-title" className="text-xl font-semibold leading-7 break-words">{selectedTodo.title}</h2>
                {selectedTodo.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedTodo.tags.map((tag: any) => <TagBadge key={tag.id} tag={tag} />)}
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedTodo(null)} className="btn-ghost px-2 -mr-2" aria-label="Close card">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {todoDetail?.text && (
                <section className="px-5 py-4 border-b border-stroke-divider">
                  <h3 className="text-xs font-medium text-fg-subtle mb-2">Description</h3>
                  <p className="text-sm text-fg whitespace-pre-wrap break-words">{todoDetail.text}</p>
                </section>
              )}

              <section className="px-5 py-4">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm font-semibold">Comments</h3>
                  {!loadingDetail && todoDetail && (
                    <span className="text-xs text-fg-muted tabular px-1.5 rounded-full bg-neutral-badge">{todoDetail.comments.length}</span>
                  )}
                </div>

                {loadingDetail && (
                  <p className="flex items-center justify-center gap-2 text-sm text-fg-subtle py-6"><Loader2 size={14} className="animate-spin" /> Loading comments…</p>
                )}

                {!loadingDetail && detailError && (
                  <div className="bg-danger-bg text-danger-fg text-sm rounded-md px-3 py-2.5 mb-4">
                    {detailError}{' '}
                    <button onClick={() => loadComments(selectedTodo)} className="font-medium underline">Try again</button>
                  </div>
                )}

                {!loadingDetail && todoDetail && (
                  <div className="space-y-5">
                    {todoDetail.comments.length === 0 && !detailError && (
                      <p className="text-sm text-fg-subtle text-center py-8 rounded-lg border border-dashed border-stroke-control">No comments yet</p>
                    )}
                    {todoDetail.comments.map((comment: any) => {
                      const name = fullName(comment.user);
                      return (
                        <div key={comment.id} className="flex gap-3 group">
                          <span className="w-8 h-8 rounded-full bg-accent-subtle-2 text-accent-subtle-fg flex items-center justify-center text-xs font-medium shrink-0">{initials(comment.user)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium">{name}</span>
                              <span className="text-xs text-fg-subtle" title={new Date(comment.createdAt).toLocaleString()}>{timeAgo(comment.createdAt)}</span>
                            </div>
                            <p className="text-sm text-fg mt-1 whitespace-pre-wrap break-words">{comment.text}</p>
                            <button
                              onClick={() => { setReplyingToComment({ id: comment.id, name }); textareaRef.current?.focus(); }}
                              className="mt-1 text-xs font-medium text-fg-subtle hover:text-accent-text inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                              <CornerUpLeft size={12} /> Reply
                            </button>

                            {comment.replies?.length > 0 && (
                              <div className="mt-3 pl-3 border-l border-stroke-card space-y-3">
                                {comment.replies.map((reply: any) => (
                                  <div key={reply.id} className="flex gap-2.5">
                                    <span className="w-6 h-6 rounded-full bg-subtle text-fg-muted flex items-center justify-center text-xs font-medium shrink-0">{initials(reply.user)}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-medium">{fullName(reply.user)}</span>
                                        <span className="text-xs text-fg-subtle" title={new Date(reply.createdAt).toLocaleString()}>{timeAgo(reply.createdAt)}</span>
                                      </div>
                                      <p className="text-sm text-fg mt-0.5 whitespace-pre-wrap break-words">{reply.text}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Composer */}
            <div className="border-t border-stroke-divider p-4 shrink-0">
              {replyingToComment && (
                <div className="flex items-center justify-between gap-2 bg-accent-subtle rounded-md px-3 h-8 mb-2 text-sm text-accent-subtle-fg">
                  <span className="flex items-center gap-1.5 truncate"><CornerUpLeft size={14} /> Replying to {replyingToComment.name}</span>
                  <button onClick={() => setReplyingToComment(null)} className="p-0.5 rounded hover:bg-hover" aria-label="Cancel reply"><X size={14} /></button>
                </div>
              )}
              <div className="relative">
                {mentionSearch && (
                  <div className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto bg-surface border border-stroke-card shadow-dialog rounded-lg py-1 z-[85]" role="listbox">
                    {mentionMatches.map(u => (
                      <button key={u.id} onClick={() => insertMention(u)} role="option" aria-selected="false" className="w-full text-left px-3 h-8 hover:bg-hover flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-accent-subtle-2 text-accent-subtle-fg flex items-center justify-center text-xs font-medium shrink-0">{initials(u)}</span>
                        {fullName(u)}
                      </button>
                    ))}
                    {mentionMatches.length === 0 && <p className="px-3 py-2 text-sm text-fg-subtle">No matching people</p>}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={newCommentText}
                  onChange={handleCommentChange}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitComment(); }}
                  placeholder={replyingToComment ? 'Write a reply. Type @ to mention someone.' : 'Add a comment. Type @ to mention someone.'}
                  aria-label={replyingToComment ? 'Reply' : 'Comment'}
                  className="w-full text-sm rounded-md border border-stroke-control border-b-stroke-accessible bg-surface p-3 min-h-[88px] resize-none focus:border-b-accent"
                  disabled={isSubmittingComment}
                />
              </div>
              <div className="flex items-center justify-end gap-3 mt-2">
                <span className="text-xs text-fg-subtle hidden sm:inline"><span className="mono-id">Ctrl Enter</span> to post</span>
                <button onClick={handleSubmitComment} disabled={isSubmittingComment || !newCommentText.trim()} className="btn-primary">
                  {isSubmittingComment && <Loader2 size={16} className="animate-spin" />}
                  {isSubmittingComment ? 'Posting…' : replyingToComment ? 'Post reply' : 'Post comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failure toast */}
      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 bg-surface border border-stroke-card shadow-dialog rounded-lg px-4 py-2.5 text-sm max-w-[90vw] blue-fade-in">
          <AlertCircle size={16} className="text-danger-fg shrink-0" />
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="p-0.5 rounded text-fg-subtle hover:text-fg" aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}
    </>
  );
}
