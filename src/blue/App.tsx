import React, { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '../shared/supabase';
import { BlueCcClient } from '../shared/bluecc';

// ── Column colour palette (cycles through for unlabelled lists) ─────────────
const COLUMN_COLORS = [
  { bg: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6' },
  { bg: '#FFF7ED', border: '#FED7AA', dot: '#F97316' },
  { bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  { bg: '#FDF4FF', border: '#E9D5FF', dot: '#A855F7' },
  { bg: '#FFF1F2', border: '#FECDD3', dot: '#F43F5E' },
  { bg: '#F0F9FF', border: '#BAE6FD', dot: '#0EA5E9' },
];

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
  const requestIdRef = useRef(0);

  const handleSelectWorkspace = async (ws: any) => {
    setSelectedWorkspace(ws);
    if (!client) return;
    setLoadingWorkspace(true);
    setWorkspaceData(null);
    const thisRequestId = ++requestIdRef.current;
    try {
      const data = await client.getWorkspaceContent(ws.id, ws.companyId);
      if (thisRequestId === requestIdRef.current) setWorkspaceData(data);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        Loading Blue.cc…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-gray-50" style={{ minHeight: '600px' }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
      <aside
        className="flex flex-col border-r border-gray-200 bg-white transition-all duration-200 flex-shrink-0"
        style={{ width: sidebarOpen ? '220px' : '52px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
          {sidebarOpen && (
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Workspaces</span>
          )}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="ml-auto p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            title={sidebarOpen ? 'Collapse' : 'Expand'}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {sidebarOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                : <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>}
            </svg>
          </button>
        </div>

        {/* Workspace list */}
        <div className="flex-1 overflow-y-auto py-2">
          {workspaces.length === 0 && client && (
            <p className="px-3 py-4 text-xs text-gray-400 text-center">No workspaces</p>
          )}
          {workspaces.map((ws, i) => {
            const color = COLUMN_COLORS[i % COLUMN_COLORS.length];
            const isSelected = selectedWorkspace?.id === ws.id;
            return (
              <button
                key={ws.id}
                onClick={() => handleSelectWorkspace(ws)}
                title={ws.name}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors text-sm ${
                  isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: color.dot }} />
                {sidebarOpen && (
                  <span className="truncate">{ws.name}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Refresh + Settings */}
        <div className="border-t border-gray-100 p-2 space-y-1">
          {client && (
            <button
              onClick={() => fetchWorkspaces(client)}
              title="Refresh workspaces"
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              {sidebarOpen && 'Refresh'}
            </button>
          )}
          <button
            onClick={() => setShowSettings(v => !v)}
            title="API Settings"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            {sidebarOpen && 'API Settings'}
          </button>
        </div>
      </aside>

      {/* ── MAIN AREA ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Settings panel (overlay) */}
        {showSettings && (
          <div className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">Blue.cc API Credentials</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
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

        {/* No client yet */}
        {!client && !showSettings && (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
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
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            ← Select a workspace
          </div>
        )}

        {/* Kanban Board */}
        {client && selectedWorkspace && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Board header */}
            <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-gray-900 text-base truncate">{selectedWorkspace.name}</h2>
              {loadingWorkspace && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Loading…
                </span>
              )}
              {workspaceData?.lists && (
                <span className="text-xs text-gray-400">{workspaceData.lists.length} lists</span>
              )}
            </div>

            {/* Columns scroll area */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
              {loadingWorkspace && (
                <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                  <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Fetching board…
                </div>
              )}

              {!loadingWorkspace && workspaceData?.lists && workspaceData.lists.length > 0 && (
                <div className="flex gap-3 h-full" style={{ minWidth: 'max-content' }}>
                  {workspaceData.lists
                    .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
                    .map((list: any, idx: number) => {
                      const color = COLUMN_COLORS[idx % COLUMN_COLORS.length];
                      const todos = (list.todos || []).sort((a: any, b: any) => (b.position || 0) - (a.position || 0));
                      return (
                        <div
                          key={list.id}
                          className="flex flex-col rounded-xl flex-shrink-0 overflow-hidden"
                          style={{
                            width: '240px',
                            background: color.bg,
                            border: `1px solid ${color.border}`,
                            maxHeight: '100%',
                          }}
                        >
                          {/* Column header */}
                          <div className="px-3 py-2.5 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${color.border}` }}>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color.dot }}/>
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide truncate flex-1">{list.title}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: color.border, color: color.dot }}>
                              {todos.length}
                            </span>
                          </div>

                          {/* Cards */}
                          <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {todos.length === 0 && (
                              <div className="flex items-center justify-center py-6 text-gray-300 text-xs">
                                Empty
                              </div>
                            )}
                            {todos.map((todo: any) => (
                              <div
                                key={todo.id}
                                className="bg-white rounded-lg px-3 py-2.5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative"
                              >
                                {/* Done indicator */}
                                {todo.done && (
                                  <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg" style={{ backgroundColor: color.dot }}/>
                                )}

                                {/* Tags */}
                                {todo.tags && todo.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-1.5">
                                    {todo.tags.map((tag: any) => (
                                      <span
                                        key={tag.id}
                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                                        style={{
                                          backgroundColor: tag.color ? `${tag.color}22` : '#f3f4f6',
                                          color: tag.color || '#6b7280',
                                        }}
                                      >
                                        {tag.title}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Title */}
                                <p className={`text-xs leading-snug ${todo.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                  {todo.title}
                                </p>
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
          </div>
        )}
      </div>
    </div>
  );
}
