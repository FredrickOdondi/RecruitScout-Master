import React, { useState, useEffect } from 'react';
import { SupabaseClientRecord } from '../shared/supabase';

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
  const [loading, setLoading] = useState(false);
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

  const fetchClients = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    setTableMissing(false);
    try {
      const res = await sendMessage({ type: 'SUPABASE_GET_CLIENTS' });
      if (res && res.error) {
        if (res.error.includes('404') || res.error.includes('does not exist') || res.error.includes('relation "public.clients" does not exist')) {
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
      if (e.message?.includes('404') || e.message?.includes('does not exist') || e.message?.includes('relation "public.clients" does not exist')) {
        setTableMissing(true);
      } else {
        setError(e.message || 'Error fetching clients');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !appsScriptUrl.trim()) return;

    // Basic URL pattern validation
    if (!appsScriptUrl.startsWith('http://') && !appsScriptUrl.startsWith('https://')) {
      alert('⚠️ Please enter a valid Apps Script Web App URL starting with http:// or https://');
      return;
    }

    setEnrolling(true);
    setSuccessMsg(null);
    try {
      const clientData: SupabaseClientRecord = {
        name: name.trim(),
        apps_script_url: appsScriptUrl.trim(),
        spreadsheet_id: spreadsheetId.trim() || null,
        sheet_name: sheetName.trim() || 'Sheet1'
      };

      const res = await sendMessage({
        type: 'SUPABASE_ENROLL_CLIENT',
        payload: clientData
      });

      if (res && res.error) {
        setError(res.error);
      } else {
        setSuccessMsg(`✅ Enrolled "${name.trim()}" successfully!`);
        setName('');
        setAppsScriptUrl('');
        setSpreadsheetId('');
        setSheetName('Sheet1');
        fetchClients(true);
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err: any) {
      setError(err.message || 'Error enrolling client');
    } finally {
      setEnrolling(false);
    }
  };

  const handleDelete = async (id: string, clientName: string) => {
    if (!confirm(`Are you sure you want to remove "${clientName}"? This client's configuration will be deleted.`)) return;

    try {
      const res = await sendMessage({
        type: 'SUPABASE_DELETE_CLIENT',
        payload: id
      });

      if (res && res.error) {
        alert(`⚠️ Delete failed: ${res.error}`);
      } else {
        fetchClients(true);
      }
    } catch (err: any) {
      alert(`⚠️ Error deleting client: ${err.message}`);
    }
  };

  const sqlSchema = `CREATE TABLE public.clients (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  apps_script_url text NOT NULL,
  spreadsheet_id text,
  sheet_name text DEFAULT 'Sheet1',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable row level security and grant anonymous read/write
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read and write" ON public.clients FOR ALL USING (true);`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto space-y-6">
      
      {/* Table Missing Alert (Self-Healing UI) */}
      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm transition-all duration-300">
          <div className="flex items-start gap-4">
            <div className="bg-amber-100 p-2 rounded-lg text-amber-700 shrink-0">
              <AlertTriangleIcon />
            </div>
            <div className="flex-1 space-y-3">
              <h4 className="text-base font-semibold text-gray-900">Database Configuration Required</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                It looks like the <code className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono text-xs">clients</code> table does not exist in your Supabase database yet. Run the following SQL script in your Supabase project's **SQL Editor** to create it:
              </p>
              
              <div className="relative group bg-gray-950 rounded-lg overflow-hidden border border-gray-800 shadow-inner">
                <button 
                  onClick={copySql}
                  className="absolute right-3 top-3 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded p-1.5 transition-all text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md"
                  title="Copy SQL Schema"
                >
                  {copiedSql ? (
                    <>
                      <span className="text-green-400"><CheckIcon /></span>
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <pre className="p-4 text-xs font-mono text-cyan-400 overflow-x-auto whitespace-pre leading-relaxed select-all">
                  {sqlSchema}
                </pre>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => fetchClients()}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <RefreshIcon />
                  Verify Table Created
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span className="text-green-600"><UserPlusIcon /></span>
              Enroll New Client
            </h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Add a client to assign targeted Google Sheets pipelines for their custom scraped datasets.
            </p>

            <form onSubmit={handleEnroll} className="space-y-4">
              <div>
                <label className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-1.5 block">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corporation"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-1.5 block">
                  Apps Script Web App URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  required
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-1.5 block">
                  Spreadsheet ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1BxiMVs0XRA5nFMd..."
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all shadow-sm"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-1.5 block">
                  Sheet Name
                </label>
                <input
                  type="text"
                  placeholder="Sheet1"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all shadow-sm"
                />
              </div>

              {error && !tableMissing && (
                <div className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg p-3">
                  ⚠️ {error}
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
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
              >
                {enrolling ? 'Enrolling...' : 'Enroll Client'}
              </button>
            </form>
          </div>
        </div>

        {/* Client List */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Enrolled Clients</h3>
                <p className="text-xs text-gray-500 mt-0.5">Manage custom syncing profiles and Sheets outputs.</p>
              </div>
              <button 
                onClick={() => fetchClients()}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition-all"
              >
                <span className={loading ? 'animate-spin' : ''}><RefreshIcon /></span>
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-gray-500">Loading clients...</span>
              </div>
            ) : clients.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                <span className="text-3xl mb-2">👥</span>
                <span className="text-sm font-medium text-gray-900">No Enrolled Clients</span>
                <span className="text-xs text-gray-500 text-center px-4 mt-1">Enroll your first client on the left to set up sync automation.</span>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 flex-1">
                <table className="w-full text-left text-xs text-gray-700 min-w-[600px]">
                  <thead className="text-[10px] font-bold text-gray-600 uppercase tracking-widest bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Sheet Settings</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {clients.map((client) => (
                      <tr key={client.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{client.name}</div>
                          <div className="text-[10px] text-gray-600 truncate max-w-[200px]" title={client.apps_script_url}>
                            URL: {client.apps_script_url}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <div><span className="font-medium text-gray-900">Sheet:</span> {client.sheet_name || 'Sheet1'}</div>
                          <div className="text-[10px] truncate max-w-[180px]" title={client.spreadsheet_id || 'N/A'}>
                            ID: {client.spreadsheet_id || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDelete(client.id!, client.name)}
                            className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 p-2 rounded-lg border border-red-200 transition-all shadow-sm"
                            title="Remove Client"
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
