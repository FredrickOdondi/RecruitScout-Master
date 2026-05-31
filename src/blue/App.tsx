import React, { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '../shared/supabase';
import { BlueCcClient } from '../shared/bluecc';

const COLUMN_COLORS = [
  { bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6' },
  { bg: '#FFF7ED', border: '#FED7AA', dot: '#F97316' },
  { bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  { bg: '#FDF4FF', border: '#E9D5FF', dot: '#A855F7' },
  { bg: '#FFF1F2', border: '#FECDD3', dot: '#F43F5E' },
  { bg: '#F0F9FF', border: '#BAE6FD', dot: '#0EA5E9' },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [tokenId, setTokenId] = useState('');
  const [secretId, setSecretId] = useState('');
  const [companyId, setCompanyId] = useState('');

  const [client, setClient] = useState<BlueCcClient | null>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<any | null>(null);
  const [workspaceData, setWorkspaceData] = useState<any | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Card detail panel
  const [selectedTodo, setSelectedTodo] = useState<any | null>(null);
  const [todoDetail, setTodoDetail] = useState<{ text: string; comments: any[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState<{ id: string, name: string } | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  
  // Mentions
  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([]);
  const [mentionSearch, setMentionSearch] = useState<{ query: string, position: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Notifications
  const [mentions, setMentions] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const requestIdRef = useRef(0);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectWorkspace = async (ws: any) => {
    setSelectedWorkspace(ws);
    if (!client) return;
    setLoadingWorkspace(true);
    setWorkspaceData(null);
    const thisRequestId = ++requestIdRef.current;
    try {
      const data = await client.getWorkspaceContent(ws.id, ws.companyId);
      if (thisRequestId === requestIdRef.current) setWorkspaceData(data);
      
      const users = await client.getWorkspaceUsers(ws.id);
      if (thisRequestId === requestIdRef.current) setWorkspaceUsers(users);
    } catch (err) {
      if (thisRequestId === requestIdRef.current) console.error(err);
    }
    if (thisRequestId === requestIdRef.current) setLoadingWorkspace(false);
  };

  useEffect(() => { loadCredentials(); }, []);

  const loadCredentials = async () => {
    setLoading(true);
    const session = supabaseClient.getSession();
    if (session?.user?.id) {
      const res = await supabaseClient.getUserIntegration(session.user.id);
      if (res.data) {
        setTokenId(res.data.bluecc_token_id || '');
        setSecretId(res.data.bluecc_secret_id || '');
        setCompanyId(res.data.bluecc_company_id || '');
        if (res.data.bluecc_token_id && res.data.bluecc_secret_id) {
          const c = new BlueCcClient(res.data.bluecc_token_id, res.data.bluecc_secret_id, res.data.bluecc_company_id || undefined);
          setClient(c);
          fetchWorkspaces(c);
          fetchMentions(c);
        } else {
          setShowSettings(true);
        }
      } else {
        setShowSettings(true);
      }
    }
    setLoading(false);
  };

  const handleSaveCredentials = async () => {
    setSaving(true);
    const session = supabaseClient.getSession();
    if (session?.user?.id) {
      const payload = { user_id: session.user.id, bluecc_token_id: tokenId, bluecc_secret_id: secretId, bluecc_company_id: companyId };
      const res = await supabaseClient.upsertUserIntegration(payload);
      if (res.error) {
        alert('Error saving credentials: ' + res.error);
      } else {
        const c = new BlueCcClient(tokenId, secretId, companyId || undefined);
        setClient(c);
        fetchWorkspaces(c);
        fetchMentions(c);
        setShowSettings(false);
      }
    }
    setSaving(false);
  };

  const fetchWorkspaces = async (blueClient: BlueCcClient) => {
    try {
      const data = await blueClient.getWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMentions = async (blueClient: BlueCcClient) => {
    try {
      const result = await blueClient.getMentions(20);
      setMentions(result.items);
    } catch (err) {
      console.error('Failed to fetch mentions:', err);
    }
  };

  const handleTodoClick = async (todo: any) => {
    setSelectedTodo(todo);
    setTodoDetail(null);
    setLoadingDetail(true);
    setNewCommentText('');
    setReplyingToComment(null);
    try {
      if (!client || !selectedWorkspace) return;
      const result = await client.getTodoComments(todo.id, selectedWorkspace.id);
      setTodoDetail({ text: todo.text || '', comments: result?.comments || [] });
    } catch (err) {
      console.error('Failed to load card detail:', err);
      setTodoDetail({ text: todo.text || '', comments: [] });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newCommentText.trim() || !client || !selectedWorkspace || !selectedTodo) return;
    setIsSubmittingComment(true);
    try {
      const category = 'TODO';
      const categoryId = selectedTodo.id;
      const parentId = replyingToComment ? replyingToComment.id : undefined;
      await client.createComment(categoryId, category, newCommentText, selectedWorkspace.id, parentId);
      
      // Refresh comments
      const result = await client.getTodoComments(selectedTodo.id, selectedWorkspace.id);
      setTodoDetail(prev => ({ text: prev?.text || '', comments: result?.comments || [] }));
      
      // Reset input
      setNewCommentText('');
      setReplyingToComment(null);
      setMentionSearch(null);
    } catch (err) {
      console.error('Failed to post comment:', err);
      alert('Failed to post comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewCommentText(val);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    if (match) {
      setMentionSearch({ query: match[1].toLowerCase(), position: cursorPosition });
    } else {
      setMentionSearch(null);
    }
  };

  const insertMention = (user: any) => {
    if (!mentionSearch || !textareaRef.current) return;
    const val = newCommentText;
    const start = val.slice(0, mentionSearch.position - mentionSearch.query.length - 1);
    const end = val.slice(textareaRef.current.selectionStart);
    const nameStr = `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`;
    // Format mention using standard Blue.cc markdown/tagging approach or just raw name
    const newText = `${start}@${nameStr} ${end}`;
    setNewCommentText(newText);
    setMentionSearch(null);
    textareaRef.current.focus();
  };

  const unreadCount = mentions.filter(m => !m.isRead).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading Blue.cc…
      </div>
    );
  }

  return (
    <>
    <style>{`
      @keyframes slideInRight {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .animate-slide-in { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      .animate-fade-in { animation: fadeIn 0.2s ease-out; }
      
      /* Custom scrollbar for a cleaner look */
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: #cbd5e1;
        border-radius: 10px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: #94a3b8;
      }
    `}</style>
    <div className="flex flex-col bg-slate-50" style={{ height: '100%', minHeight: '600px' }}>

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/>
          </svg>
          <span className="text-sm font-semibold text-gray-800">Blue.cc</span>
          {selectedWorkspace && (
            <>
              <svg width="14" height="14" fill="none" stroke="#d1d5db" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              <span className="text-sm text-gray-600">{selectedWorkspace.name}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications bell */}
          {client && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(v => !v)}
                className="relative p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                title="Notifications"
              >
                <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-9 z-50 w-80 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">Mentions</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                    {mentions.length === 0 && (
                      <div className="py-8 text-center text-gray-400 text-xs">No mentions</div>
                    )}
                    {mentions.map(m => (
                      <div
                        key={m.id}
                        className={`flex gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-gray-50 ${!m.isRead ? 'bg-blue-50/60' : ''}`}
                        onClick={() => {
                          const ws = workspaces.find(w => w.id === m.targetWorkspace?.id);
                          if (ws) handleSelectWorkspace(ws);
                          setShowNotifications(false);
                        }}
                      >
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                          {m.mentioner?.firstName?.charAt(0)}{m.mentioner?.lastName?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-800 leading-snug">
                            <span className="font-semibold">{m.mentioner?.firstName} {m.mentioner?.lastName}</span>
                            {' '}mentioned you in{' '}
                            <span className="font-semibold text-blue-600">{m.targetWorkspace?.name}</span>
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(m.createdAt)}</p>
                        </div>
                        {!m.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"/>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-2 border-t border-gray-100">
                    <button
                      onClick={() => { fetchMentions(client!); }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings gear */}
          <button
            onClick={() => setShowSettings(v => !v)}
            title="API Settings"
            className={`p-1.5 rounded-md transition-colors ${showSettings ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-gray-200 bg-white px-5 py-4 shadow-sm flex-shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Token ID</label>
              <input type="text" value={tokenId} onChange={e => setTokenId(e.target.value)} placeholder="Token ID" className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"/>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Secret ID</label>
              <input type="password" value={secretId} onChange={e => setSecretId(e.target.value)} placeholder="••••••••" className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"/>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Company ID <span className="font-normal normal-case text-gray-400">(optional)</span></label>
              <input type="text" value={companyId} onChange={e => setCompanyId(e.target.value)} placeholder="Auto-detected" className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"/>
            </div>
          </div>
          <button onClick={handleSaveCredentials} disabled={saving} className="mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save & Connect'}
          </button>
        </div>
      )}

      {/* ── BODY (sidebar + board) ────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT SIDEBAR */}
        <aside
          className="flex flex-col border-r border-gray-200 bg-white transition-all duration-200 flex-shrink-0"
          style={{ width: sidebarOpen ? '200px' : '44px' }}
        >
          <div className="flex items-center justify-between px-2.5 py-2.5 border-b border-gray-100">
            {sidebarOpen && (
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Workspaces</span>
            )}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="ml-auto p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {sidebarOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>}
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1.5">
            {workspaces.length === 0 && client && (
              <p className="px-3 py-4 text-[11px] text-gray-400 text-center">No workspaces</p>
            )}
            {!client && (
              <p className="px-3 py-4 text-[11px] text-gray-400 text-center">Not connected</p>
            )}
            {workspaces.map((ws, i) => {
              const color = COLUMN_COLORS[i % COLUMN_COLORS.length];
              const isSelected = selectedWorkspace?.id === ws.id;
              const hasMention = mentions.some(m => !m.isRead && m.targetWorkspace?.id === ws.id);
              return (
                <button
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws)}
                  title={ws.name}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors text-sm ${
                    isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: color.dot }}/>
                  {sidebarOpen && (
                    <>
                      <span className="truncate flex-1 text-xs">{ws.name}</span>
                      {hasMention && <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0"/>}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {client && (
            <div className="border-t border-gray-100 p-2">
              <button
                onClick={() => { fetchWorkspaces(client); fetchMentions(client); }}
                title="Refresh"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                {sidebarOpen && 'Refresh'}
              </button>
            </div>
          )}
        </aside>

        {/* MAIN BOARD AREA */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* No client */}
          {!client && (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2zM7 7h.01"/>
                </svg>
                <p className="text-gray-500 text-sm mb-3">Connect your Blue.cc account to get started.</p>
                <button onClick={() => setShowSettings(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded transition-colors">
                  Add API Credentials
                </button>
              </div>
            </div>
          )}

          {/* No workspace selected */}
          {client && !selectedWorkspace && (
            <div className="flex-1 flex items-center justify-center text-gray-300 text-sm select-none">
              ← Select a workspace
            </div>
          )}

          {/* Kanban Board */}
          {client && selectedWorkspace && (
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 custom-scrollbar">
              {loadingWorkspace && (
                <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                  <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Loading board…
                </div>
              )}

              {!loadingWorkspace && workspaceData?.lists && workspaceData.lists.length > 0 && (
                <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
                  {workspaceData.lists
                    .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
                    .map((list: any, idx: number) => {
                      const color = COLUMN_COLORS[idx % COLUMN_COLORS.length];
                      const todos = (list.todos || []).sort((a: any, b: any) => (b.position || 0) - (a.position || 0));
                      return (
                        <div
                          key={list.id}
                          className="flex flex-col rounded-xl flex-shrink-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
                          style={{ width: '260px', background: color.bg, border: `1px solid ${color.border}`, maxHeight: '100%' }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            const todoId = e.dataTransfer.getData('text/plain');
                            if (!todoId || !workspaceData) return;
                            
                            const currentList = workspaceData.lists.find((l: any) => l.todos?.some((t: any) => t.id === todoId));
                            if (currentList && currentList.id === list.id) return;

                            // Optimistically update
                            setWorkspaceData((prev: any) => {
                              if (!prev) return prev;
                              const newLists = prev.lists.map((l: any) => ({ ...l, todos: [...(l.todos || [])] }));
                              
                              let movedTodo = null;
                              for (const l of newLists) {
                                const idx = l.todos.findIndex((t: any) => t.id === todoId);
                                if (idx > -1) {
                                  movedTodo = l.todos[idx];
                                  l.todos.splice(idx, 1);
                                  break;
                                }
                              }
                              if (movedTodo) {
                                const targetList = newLists.find((l: any) => l.id === list.id);
                                if (targetList) targetList.todos.unshift(movedTodo);
                              }
                              return { ...prev, lists: newLists };
                            });

                            // API sync
                            try {
                              if (client && selectedWorkspace) {
                                await client.moveTodo(todoId, list.id, selectedWorkspace.id);
                              }
                            } catch (err) {
                              console.error("Failed to move todo", err);
                              // Refetch to sync state on error
                              if (client && selectedWorkspace) {
                                const result = await client.getWorkspaceContent(selectedWorkspace.id);
                                if (result) setWorkspaceData(result);
                              }
                            }
                          }}
                        >
                          {/* Column header */}
                          <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0 bg-white/40 backdrop-blur-sm" style={{ borderBottom: `1px solid ${color.border}` }}>
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: color.dot }}/>
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider truncate flex-1">{list.title}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 shadow-sm"
                              style={{ background: color.border, color: color.dot }}>
                              {todos.length}
                            </span>
                          </div>

                          {/* Cards */}
                          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar">
                            {todos.length === 0 && (
                              <div className="flex items-center justify-center py-6 text-slate-300 text-[11px] uppercase tracking-widest font-semibold">Empty</div>
                            )}
                            {todos.map((todo: any) => (
                              <div
                                key={todo.id}
                                onClick={() => handleTodoClick(todo)}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', todo.id);
                                  setDraggedTodoId(todo.id);
                                }}
                                onDragEnd={() => setDraggedTodoId(null)}
                                className={`bg-white rounded-xl px-3.5 py-3 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-200 ease-out relative cursor-pointer group ${
                                  draggedTodoId === todo.id ? 'opacity-40 ring-2 ring-blue-400 scale-[0.98]' : ''
                                }`}
                              >
                                {todo.done && (
                                  <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg" style={{ backgroundColor: color.dot }}/>
                                )}
                                {todo.tags && todo.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-1.5">
                                    {todo.tags.map((tag: any) => (
                                      <span
                                        key={tag.id}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                                        style={{ backgroundColor: tag.color ? `${tag.color}22` : '#f3f4f6', color: tag.color || '#6b7280' }}
                                      >
                                        {tag.title}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <p className={`text-[12px] font-medium leading-relaxed mt-0.5 ${todo.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                  {todo.title}
                                </p>
                                {/* Bottom meta row */}
                                <div className="flex items-center justify-between mt-1.5">
                                  <div className="flex-1" />
                                  {(todo.commentCount ?? 0) > 0 && (
                                    <div className="flex items-center gap-0.5 text-gray-300 group-hover:text-blue-400 transition-colors">
                                      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10z"/>
                                      </svg>
                                      <span className="text-[9px] font-semibold">{todo.commentCount}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {!loadingWorkspace && workspaceData && (!workspaceData.lists || workspaceData.lists.length === 0) && (
                <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                  No lists in this workspace.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* ── CARD DETAIL PANEL ─────────────────────────────────────────────── */}
      {selectedTodo && (
        <div className="fixed inset-0 z-50 flex" style={{ fontFamily: 'inherit' }}>
          {/* Backdrop */}
          <div
            className="flex-1 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setSelectedTodo(null)}
          />
          {/* Slide-in panel */}
          <div className="w-[550px] bg-white flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.15)] overflow-hidden border-l border-slate-200 animate-slide-in">

            {/* Header */}
            <div className="flex items-start gap-4 px-6 py-5 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
              {/* Done indicator */}
              <div className={`mt-0.5 w-4 h-4 rounded shadow-sm border-2 flex-shrink-0 flex items-center justify-center transition-colors duration-200 ${
                selectedTodo.done ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white'
              }`}>
                {selectedTodo.done && (
                  <svg width="10" height="10" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className={`text-[15px] font-bold leading-snug tracking-tight ${
                  selectedTodo.done ? 'line-through text-slate-400' : 'text-slate-900'
                }`}>
                  {selectedTodo.title}
                </h2>
                {selectedTodo.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {selectedTodo.tags.map((tag: any) => (
                      <span
                        key={tag.id}
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                        style={{ backgroundColor: tag.color ? `${tag.color}22` : '#f3f4f6', color: tag.color || '#6b7280' }}
                      >
                        {tag.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedTodo(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-md transition-colors flex-shrink-0 ml-2"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">

              {/* Description */}
              {todoDetail?.text && (
                <div className="px-6 py-5 border-b border-slate-100/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7"/></svg>
                    Description
                  </p>
                  <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">{todoDetail.text}</p>
                </div>
              )}

              {/* Comments */}
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10z"/></svg>
                    Comments
                  </p>
                  {!loadingDetail && todoDetail && (
                    <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full shadow-sm">
                      {todoDetail.comments.length}
                    </span>
                  )}
                </div>

                {/* Loading state */}
                {loadingDetail && (
                  <div className="flex items-center gap-2 text-gray-400 text-xs py-6 justify-center">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Loading comments…
                  </div>
                )}

                {/* Comment list */}
                {!loadingDetail && todoDetail && (
                  <div className="space-y-6">
                    {todoDetail.comments.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 rounded-xl border border-slate-100 border-dashed">
                        <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                        <p className="text-[12px] font-medium text-slate-400">No comments yet</p>
                      </div>
                    )}
                    {todoDetail.comments.map((comment: any) => {
                      const initials = `${comment.user?.firstName?.[0] ?? '?'}${comment.user?.lastName?.[0] ?? ''}`;
                      const name = `${comment.user?.firstName ?? ''} ${comment.user?.lastName ?? ''}`.trim();
                      const date = new Date(comment.createdAt).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      });
                      return (
                        <div key={comment.id} className="flex gap-3.5 group">
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-[11px] font-bold text-blue-700 flex-shrink-0 shadow-sm border border-white">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Author + timestamp */}
                            <div className="flex items-baseline gap-2 mb-1.5">
                              <span className="text-[13px] font-bold text-slate-800">{name}</span>
                              <span className="text-[10px] font-medium text-slate-400">{timeAgo(comment.createdAt)}</span>
                            </div>
                            {/* Comment body */}
                            <div className="bg-slate-50/70 border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm inline-block max-w-[95%]">
                              <p className="text-[12.5px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                                {comment.text}
                              </p>
                            </div>
                            <div className="mt-1">
                              <button
                                onClick={() => setReplyingToComment({ id: comment.id, name })}
                                className="text-[11px] font-bold text-slate-400 hover:text-blue-500 transition-colors uppercase tracking-wide opacity-0 group-hover:opacity-100"
                              >
                                Reply
                              </button>
                            </div>
                            {/* Replies */}
                            {comment.replies?.length > 0 && (
                              <div className="mt-4 pl-4 border-l-[3px] border-slate-100 space-y-4 relative">
                                {comment.replies.map((reply: any) => {
                                  const rInitials = `${reply.user?.firstName?.[0] ?? '?'}${reply.user?.lastName?.[0] ?? ''}`;
                                  const rName = `${reply.user?.firstName ?? ''} ${reply.user?.lastName ?? ''}`.trim();
                                  const rDate = new Date(reply.createdAt).toLocaleString(undefined, {
                                    month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  });
                                  return (
                                    <div key={reply.id} className="flex gap-2.5 relative">
                                      <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[9px] font-bold text-slate-500 flex-shrink-0 mt-1 shadow-sm">
                                        {rInitials}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1">
                                          <span className="text-[12px] font-bold text-slate-700">{rName}</span>
                                          <span className="text-[9.5px] font-medium text-slate-400">{timeAgo(reply.createdAt)}</span>
                                        </div>
                                        <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-3.5 py-2.5 shadow-sm inline-block max-w-[95%]">
                                          <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap break-words">{reply.text}</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Comment Input Area */}
            <div className="border-t border-slate-200 bg-slate-50/80 backdrop-blur-md p-5 flex-shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] relative z-10">
              {replyingToComment && (
                <div className="flex items-center justify-between bg-blue-100/50 px-3 py-2 rounded-lg mb-3 border border-blue-200 shadow-sm animate-fade-in">
                  <span className="text-[11px] font-bold text-blue-800 flex items-center gap-1.5">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                    Replying to {replyingToComment.name}
                  </span>
                  <button 
                    onClick={() => setReplyingToComment(null)}
                    className="text-blue-500 hover:text-blue-700 p-1 rounded-md hover:bg-blue-200/50 transition-colors"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              )}
              <div className="flex flex-col gap-2 relative">
                
                {/* Mention Dropdown */}
                {mentionSearch && (
                  <div className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto bg-white border border-gray-200 shadow-xl rounded-lg py-1 z-[60]">
                    {workspaceUsers
                      .filter(u => {
                        const name = `${u.firstName} ${u.lastName || ''}`.toLowerCase();
                        return name.includes(mentionSearch.query);
                      })
                      .map(u => (
                        <button
                          key={u.id}
                          onClick={() => insertMention(u)}
                          className="w-full text-left px-3 py-1.5 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors flex items-center gap-2"
                        >
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold text-blue-700 flex-shrink-0">
                            {u.firstName?.[0]}{u.lastName?.[0]}
                          </div>
                          <span className="text-xs text-gray-800 font-medium">
                            {u.firstName} {u.lastName}
                          </span>
                        </button>
                      ))}
                    {workspaceUsers.filter(u => `${u.firstName} ${u.lastName || ''}`.toLowerCase().includes(mentionSearch.query)).length === 0 && (
                      <div className="px-3 py-2 text-[10px] text-gray-400">No users found</div>
                    )}
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={newCommentText}
                  onChange={handleCommentChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSubmitComment();
                    }
                  }}
                  placeholder={replyingToComment ? "Write your reply..." : "Add a comment..."}
                  className="w-full text-[13px] border border-slate-300 rounded-xl p-3.5 min-h-[90px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none shadow-sm pb-12 transition-all bg-white"
                  disabled={isSubmittingComment}
                />
                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline-block">
                    Cmd + Enter to post
                  </span>
                  <button
                    onClick={handleSubmitComment}
                    disabled={isSubmittingComment || !newCommentText.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold px-4 py-2 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    {isSubmittingComment ? (
                      <span className="flex items-center gap-1.5">
                        <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Posting
                      </span>
                    ) : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
