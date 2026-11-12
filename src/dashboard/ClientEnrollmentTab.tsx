import React, { useState, useEffect } from 'react';
import { SupabaseClientRecord } from '../shared/supabase';
import { storage } from '../shared/storage';
import { listSharedSpreadsheets, listSpreadsheetSheets, SpreadsheetSheetTab } from '../lib/export/google-sheets-api';

// Icons
const TrashIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="3 6 5 6 21 6"></polyline>
 <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
 <path d="M10 11v6"></path>
 <path d="M14 11v6"></path>
 <path d="M9 6V4h6v2"></path>
 </svg>
);

const UserPlusIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
 <circle cx="8.5" cy="7" r="4"></circle>
 <line x1="20" y1="8" x2="20" y2="14"></line>
 <line x1="23" y1="11" x2="17" y2="11"></line>
 </svg>
);

const CopyIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
 <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
 </svg>
);

const AlertTriangleIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
 <line x1="12" y1="9" x2="12" y2="13"></line>
 <line x1="12" y1="17" x2="12.01" y2="17"></line>
 </svg>
);

const CheckIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="20 6 9 17 4 12"></polyline>
 </svg>
);

const RefreshIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="23 4 23 10 17 10"></polyline>
 <polyline points="1 20 1 14 7 14"></polyline>
 <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
 </svg>
);

interface ClientEnrollmentTabProps {
 sendMessage: (msg: any) => Promise<any>;
}

export default function ClientEnrollmentTab({ sendMessage }: ClientEnrollmentTabProps) {
  const [clients, setClients] = useState<SupabaseClientRecord[]>([]);
  const [spreadsheets, setSpreadsheets] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
 const [tableMissing, setTableMissing] = useState(false);
 const [copiedSql, setCopiedSql] = useState(false);

 // Form State
 const [name, setName] = useState('');
 const [appsScriptUrl, setAppsScriptUrl] = useState('');
 const [spreadsheetId, setSpreadsheetId] = useState('');
 const [sheetName, setSheetName] = useState('Sheet1');
 const [enrolling, setEnrolling] = useState(false);
 const [successMsg, setSuccessMsg] = useState<string | null>(null);

 // Available sheet tabs state
 const [availableSheets, setAvailableSheets] = useState<SpreadsheetSheetTab[]>([]);
 const [loadingTabs, setLoadingTabs] = useState(false);
 const [tabsError, setTabsError] = useState<string | null>(null);
 const [manualSheetMode, setManualSheetMode] = useState(false);
 const [activeClient, setActiveClient] = useState<string>('');

 const fetchClients = async (silent = false) => {
 if (!silent) setLoading(true);
 setError(null);
 setTableMissing(false);
 try {
 const res = await sendMessage({ type:'SUPABASE_GET_CLIENTS' });
 if (res && res.error) {
 if (res.error.includes('404') || res.error.includes('does not exist') || res.error.includes('relation"public.clients" does not exist')) {
 setTableMissing(true);
 } else {
 setError(res.error);
 }
 } else if (res && Array.isArray(res.data)) {
 setClients(res.data);
 } else if (Array.isArray(res)) {
 setClients(res);
 }
 } catch (e: any) {
 if (e.message?.includes('404') || e.message?.includes('does not exist') || e.message?.includes('relation"public.clients" does not exist')) {
 setTableMissing(true);
 } else {
 setError(e.message ||'Error fetching clients');
 }
 } finally {
 setLoading(false);
 }
 };

  const [driveError, setDriveError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const extractSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : trimmed;
  };

  const fetchSpreadsheets = async () => {
    setLoadingSheets(true);
    setDriveError(null);
    try {
      const sheets = await listSharedSpreadsheets();
      setSpreadsheets(sheets);
      setIsConnected(true);
      if (sheets.length === 0) {
        setManualMode(true);
      } else if (sheets.length > 0) {
        setSpreadsheetId(prev => prev || sheets[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load spreadsheets from Google:', err);
      const msg = err.message || 'Failed to fetch spreadsheets';
      setDriveError(msg);
      setManualMode(true);
    } finally {
      setLoadingSheets(false);
    }
  };

  const fetchAvailableTabs = async (sheetId: string) => {
    const cleanId = extractSpreadsheetId(sheetId);
    if (!cleanId || cleanId.length < 10) {
      setAvailableSheets([]);
      setTabsError(null);
      return;
    }

    setLoadingTabs(true);
    setTabsError(null);
    try {
      const tabs = await listSpreadsheetSheets(cleanId);
      setAvailableSheets(tabs);
      if (tabs.length > 0) {
        setSheetName(prev => {
          const match = tabs.find(t => t.title.toLowerCase() === prev.trim().toLowerCase());
          return match ? match.title : tabs[0].title;
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch spreadsheet tabs:', err);
      setTabsError(err.message || 'Failed to fetch sheets');
    } finally {
      setLoadingTabs(false);
    }
  };

  useEffect(() => {
    const cleanId = extractSpreadsheetId(spreadsheetId);
    if (!cleanId || cleanId.length < 10) {
      setAvailableSheets([]);
      setTabsError(null);
      return;
    }

    const timer = setTimeout(() => {
      fetchAvailableTabs(cleanId);
    }, 250);

    return () => clearTimeout(timer);
  }, [spreadsheetId]);

  useEffect(() => {
    fetchClients();
    fetchSpreadsheets();
    storage.getSettings().then(s => {
      if (s?.activeClientName) setActiveClient(s.activeClientName);
    }).catch(() => {});
  }, []);

  const handleSetActiveClient = async (clientName: string, clientSheetId?: string, clientSheetName?: string) => {
    setActiveClient(clientName);
    try {
      const cur = await storage.getSettings();
      await storage.setSettings({
        ...cur,
        activeClientName: clientName,
        googleSheetsConfig: {
          webAppUrl: 'https://google.com',
          spreadsheetId: clientSheetId || cur.googleSheetsConfig?.spreadsheetId || '',
          sheetName: clientSheetName || cur.googleSheetsConfig?.sheetName || 'Sheet1'
        }
      });
    } catch (e) {
      console.warn('Could not update active client setting:', e);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
  e.preventDefault();
  const cleanSheetId = extractSpreadsheetId(spreadsheetId);
  if (!name.trim() || !cleanSheetId) return;

  setEnrolling(true);
  setSuccessMsg(null);
  try {
  const clientData: SupabaseClientRecord = {
  name: name.trim(),
  apps_script_url: 'https://google.com',
  spreadsheet_id: cleanSheetId,
  sheet_name: sheetName.trim() ||'Sheet1'
  };

  const res = await sendMessage({
  type:'SUPABASE_ENROLL_CLIENT',
  payload: clientData
  });

  if (res && res.error) {
  setError(res.error);
  } else {
  setSuccessMsg(`Enrolled "${name.trim()}". New jobs for this client now sync to its sheet.`);
  handleSetActiveClient(clientData.name, cleanSheetId, clientData.sheet_name);
  setName('');
  setSpreadsheetId('');
  setAvailableSheets([]);
  setSheetName('Sheet1');
  fetchClients(true);
  setTimeout(() => setSuccessMsg(null), 5000);
  }
  } catch (err: any) {
  setError(err.message ||'Error enrolling client');
  } finally {
  setEnrolling(false);
  }
  };

 const handleDelete = async (id: string, clientName: string) => {
 if (!confirm(`Remove "${clientName}"?\n\nIts sheet settings are deleted. Jobs already synced stay in the sheet.`)) return;

 try {
 const res = await sendMessage({
 type:'SUPABASE_DELETE_CLIENT',
 payload: id
 });

 if (res && res.error) {
 alert(`Couldn't delete the client. ${res.error}`);
 } else {
 fetchClients(true);
 }
 } catch (err: any) {
 alert(`Couldn't delete the client. ${err.message}`);
 }
 };

 const sqlSchema =`CREATE TABLE public.clients (
 id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 name text NOT NULL,
 apps_script_url text NOT NULL,
 spreadsheet_id text,
 sheet_name text DEFAULT'Sheet1',
 created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable row level security and grant anonymous read/write
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY"Allow public read and write" ON public.clients FOR ALL USING (true);`;

 const copySql = () => {
 navigator.clipboard.writeText(sqlSchema);
 setCopiedSql(true);
 setTimeout(() => setCopiedSql(false), 2000);
 };

 return (
 <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto space-y-6">
 
 {/* Table Missing Alert (Self-Healing UI) */}
 {tableMissing && (
 <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm transition-all duration-300">
 <div className="flex items-start gap-4">
 <div className="bg-slate-100 p-2 rounded-lg text-slate-700 shrink-0">
 <AlertTriangleIcon />
 </div>
 <div className="flex-1 space-y-3">
 <h4 className="text-sm font-semibold text-gray-900">Database configuration required</h4>
 <p className="text-xs text-gray-600 leading-relaxed">
 It looks like the <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">clients</code> table does not exist in your Supabase database yet. Run the following SQL script in your Supabase project's **SQL Editor** to create it:
 </p>
 
 <div className="relative group bg-gray-950 rounded-lg overflow-hidden border border-gray-800 shadow-inner">
 <button 
 onClick={copySql}
 className="absolute right-3 top-3 bg-white hover:bg-white active:bg-white text-white rounded p-1.5 transition-all text-xs font-semibold flex items-center gap-1.5"
 title="Copy SQL schema"
 >
 {copiedSql ? (
 <>
 <span className="text-green-400"><CheckIcon /></span>
 <span className="text-success-fg">Copied</span>
 </>
 ) : (
 <>
 <CopyIcon />
 <span>Copy</span>
 </>
 )}
 </button>
 <pre className="p-4 text-xs font-mono text-primary-600 overflow-x-auto whitespace-pre leading-relaxed select-all">
 {sqlSchema}
 </pre>
 </div>

 <div className="flex items-center gap-3 pt-2">
 <button
 onClick={() => fetchClients()}
 className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
 >
 <RefreshIcon />
 Verify table created
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Main Form and Client List Split */}
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
 
 {/* Enrollment Form */}
 <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
 <div className="p-6">
 <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
 <span className="text-green-600"><UserPlusIcon /></span>
 Enroll new client
 </h3>
 <p className="text-xs text-gray-500 mb-6 leading-relaxed">
 Add a client to assign targeted Google Sheets pipelines for their custom scraped datasets.
 </p>

 <form onSubmit={handleEnroll} className="space-y-4">
 <div>
 <label className="text-xs text-gray-600 font-bold mb-1.5 block">
 Client name <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 placeholder="e.g. Acme Corporation"
 required
 value={name}
 onChange={(e) => setName(e.target.value)}
 className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all shadow-sm"
 />
 </div>

 <div>
 <div className="flex items-center justify-between mb-1.5">
   <label className="text-xs text-gray-600 font-bold block">
     Google spreadsheet <span className="text-red-500">*</span>
   </label>
   <button
     type="button"
     onClick={() => setManualMode(!manualMode)}
     className="text-xs text-primary-600 hover:underline font-medium"
   >
     {manualMode ? 'Switch to list from Drive' : 'Paste sheet URL / ID manually'}
   </button>
 </div>

 {driveError && (
   <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 leading-snug">
     <strong>Google Drive didn't respond:</strong> {driveError}.
     <br />
     <span className="text-gray-600">Make sure the <strong>Google Drive API</strong> is enabled in your Google Cloud project, or paste the sheet URL below directly.</span>
   </div>
 )}

 {manualMode ? (
   <div>
     <input
       type="text"
       required
       placeholder="Paste full Google Sheet URL or spreadsheet ID..."
       value={spreadsheetId}
       onChange={(e) => setSpreadsheetId(e.target.value)}
       className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-sm"
     />
     <p className="text-xs text-gray-400 mt-1">
       Paste either the full URL (e.g. <code>https://docs.google.com/spreadsheets/d/...</code>) or the ID.
     </p>
   </div>
 ) : !isConnected ? (
   <button
     type="button"
     onClick={fetchSpreadsheets}
     className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 shadow-sm transition-all"
   >
     Connect Google account / fetch spreadsheets
   </button>
 ) : loadingSheets ? (
   <div className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-500 italic">
     Loading spreadsheets...
   </div>
 ) : (
   <select
     required
     value={spreadsheetId}
     onChange={(e) => setSpreadsheetId(e.target.value)}
     className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-sm"
   >
     <option value="">Select a Spreadsheet ({spreadsheets.length} found)...</option>
     {spreadsheets.map(sheet => (
       <option key={sheet.id} value={sheet.id}>
         {sheet.name}
       </option>
     ))}
   </select>
 )}
 </div>

 <div>
 <div className="flex items-center justify-between mb-1.5">
 <label className="text-xs text-gray-600 font-bold block">
 Sheet name <span className="text-red-500">*</span>
 </label>
 <div className="flex items-center gap-2">
 {availableSheets.length > 0 && (
 <button
 type="button"
 onClick={() => setManualSheetMode(!manualSheetMode)}
 className="text-xs text-primary-600 hover:underline font-medium"
 >
 {manualSheetMode ? 'Select from tabs' : 'Enter tab manually'}
 </button>
 )}
 {extractSpreadsheetId(spreadsheetId) && (
 <button
 type="button"
 onClick={() => fetchAvailableTabs(spreadsheetId)}
 disabled={loadingTabs}
 className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
 title="Refresh sheet tabs"
 >
 <span className={loadingTabs ? 'animate-spin' : ''}><RefreshIcon /></span>
 </button>
 )}
 </div>
 </div>

 {loadingTabs ? (
 <div className="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-500 italic flex items-center gap-2">
 <div className="w-3.5 h-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
 Fetching sheet tabs...
 </div>
 ) : !manualSheetMode && availableSheets.length > 0 ? (
 <select
 required
 value={sheetName}
 onChange={(e) => {
 if (e.target.value === '__custom__') {
 setManualSheetMode(true);
 setSheetName('');
 } else {
 setSheetName(e.target.value);
 }
 }}
 className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 shadow-sm"
 >
 {availableSheets.map(tab => (
 <option key={tab.id} value={tab.title}>
 {tab.title}
 </option>
 ))}
 <option value="__custom__">+ Enter custom sheet name...</option>
 </select>
 ) : (
 <input
 type="text"
 placeholder="e.g. Sheet1"
 required
 value={sheetName}
 onChange={(e) => setSheetName(e.target.value)}
 className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all shadow-sm"
 />
 )}

 {tabsError && (
 <p className="text-xs text-amber-700 mt-1.5 flex items-center gap-1">
 Sheet tabs didn't load: {tabsError}. Type the sheet name above instead.
 </p>
 )}
 </div>

 {error && !tableMissing && (
 <div className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg p-3">
 {error}
 </div>
 )}

 {successMsg && (
 <div className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg p-3">
 {successMsg}
 </div>
 )}

 <button
 type="submit"
 disabled={enrolling || tableMissing}
 className="w-full bg-accent hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-on-accent py-2.5 rounded-lg font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
 >
 {enrolling ?'Enrolling...' :'Enroll client'}
 </button>
 </form>
 </div>
 </div>

 {/* Client List */}
 <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
 <div className="p-6 flex-1 flex flex-col">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-base font-semibold text-gray-900">Enrolled clients</h3>
 <p className="text-xs text-gray-500 mt-0.5">Manage custom syncing profiles and Sheets outputs.</p>
 </div>
 <button 
 onClick={() => fetchClients()}
 disabled={loading}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition-all"
 >
 <span className={loading ?'animate-spin' :''}><RefreshIcon /></span>
 Refresh
 </button>
 </div>

 {loading ? (
 <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
 <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
 <span className="text-xs text-gray-500">Loading clients...</span>
 </div>
 ) : clients.length === 0 ? (
 <div className="flex-1 flex flex-col items-center justify-center py-20 border border-dashed border-gray-200 rounded-lg bg-gray-50">
  <span className="text-sm font-medium text-gray-900">No clients yet</span>
 <span className="text-xs text-gray-500 text-center px-4 mt-1">Enroll your first client on the left to set up sync automation.</span>
 </div>
 ) : (
 <div className="flex-1 flex flex-col space-y-3">
 <div className="p-3 bg-accent-subtle border border-stroke-card rounded-xl flex items-start gap-2.5">
  <div className="text-xs text-blue-900 leading-relaxed">
 <strong className="font-semibold">Live sync is on for every client.</strong> All clients with a connected Google Sheet have live sync active simultaneously. When tasks are bulk queued across multiple clients in the Command Center, scraped jobs are dynamically routed to each client's specific Google Sheet in real-time.
 </div>
 </div>

 <div className="overflow-x-auto rounded-lg border border-gray-200 flex-1">
 <table className="w-full text-left text-xs text-gray-700 min-w-[600px]">
 <thead className="text-xs font-bold text-gray-600 bg-gray-50 border-b border-gray-200">
 <tr>
 <th className="px-4 py-3">Client</th>
 <th className="px-4 py-3">Sheet settings</th>
 <th className="px-4 py-3 text-right">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 bg-white">
 {clients.map((client) => {
 const hasSheet = Boolean(client.spreadsheet_id && client.spreadsheet_id.trim() !== '');
 const isDefault = activeClient ? activeClient === client.name : (clients.length === 1);
 return (
 <tr key={client.id} className="hover:bg-gray-50">
 <td className="px-4 py-3">
 <div className="flex items-center gap-2 flex-wrap">
 <div className="font-semibold text-gray-900">{client.name}</div>
 {hasSheet ? (
 <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
 Live sync active
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
 No sheet linked
 </span>
 )}
 {isDefault && (
 <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-medium" title="Default target for manual popup scrapes">
 Popup default
 </span>
 )}
 </div>
 </td>
 <td className="px-4 py-3 text-gray-600">
 <div><span className="font-medium text-gray-900">Sheet:</span> {client.sheet_name ||'Sheet1'}</div>
 <div className="text-xs truncate max-w-[180px]" title={client.spreadsheet_id ||'N/A'}>
 ID: {client.spreadsheet_id ||'—'}
 </div>
 </td>
 <td className="px-4 py-3 text-right">
 <div className="flex items-center justify-end gap-2">
 {hasSheet && !isDefault && (
 <button
 type="button"
 onClick={() => handleSetActiveClient(client.name, client.spreadsheet_id || undefined, client.sheet_name || undefined)}
 className="text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2 py-1 rounded transition-colors"
 title="Make this client the default for manual popup extractions"
 >
 Set popup default
 </button>
 )}
 <button
 onClick={() => handleDelete(client.id!, client.name)}
 className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 p-2 rounded-lg border border-red-200 transition-all shadow-sm"
 title="Remove client"
 >
 <TrashIcon />
 </button>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 </div>

 </div>

 </div>
 );
}
