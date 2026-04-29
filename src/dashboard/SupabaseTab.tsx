import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseClient, SupabaseJob } from '../shared/supabase';

// ── Icons ─────────────────────────────────────────────────────────────────────
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);
const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const SheetsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 14H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V7h10v2z"/>
  </svg>
);
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const PowerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
    <line x1="12" y1="2" x2="12" y2="12"/>
  </svg>
);

// ── Column definitions – exact Supabase column names ──────────────────────────
type ColKey = keyof SupabaseJob;

interface ColDef {
  key: ColKey;
  minWidth: string;
  truncate?: boolean;
  isLink?: boolean;
}

const COLUMNS: ColDef[] = [
  { key: 'id',             minWidth: 'min-w-[110px]',  truncate: true },
  { key: 'title',          minWidth: 'min-w-[200px]',  truncate: true },
  { key: 'company',        minWidth: 'min-w-[160px]',  truncate: true },
  { key: 'companydomain',  minWidth: 'min-w-[150px]',  truncate: true },
  { key: 'location',       minWidth: 'min-w-[150px]',  truncate: true },
  { key: 'employmenttype', minWidth: 'min-w-[140px]',  truncate: true },
  { key: 'salary',         minWidth: 'min-w-[140px]',  truncate: true },
  { key: 'source',         minWidth: 'min-w-[110px]',  truncate: false },
  { key: 'dateposted',     minWidth: 'min-w-[120px]',  truncate: false },
  { key: 'extractedat',    minWidth: 'min-w-[160px]',  truncate: false },
  { key: 'created_at',     minWidth: 'min-w-[160px]',  truncate: false },
  { key: 'status',         minWidth: 'min-w-[100px]',  truncate: false },
  { key: 'description',    minWidth: 'min-w-[260px]',  truncate: true },
  { key: 'url',            minWidth: 'min-w-[200px]',  truncate: true, isLink: true },
];

const PAGE_SIZE = 50;
const SHEETS_CONFIG_KEY = 'recruitscout_sheets_config';

// ── Google Sheets helpers ─────────────────────────────────────────────────────
function sanitizeCell(val: string | undefined | null): string {
  if (!val) return '';
  let s = String(val).trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (s.length > 49000) s = s.substring(0, 49000) + '\n...[truncated]';
  return s;
}

// Exact column order and display names for Google Sheets — maps Supabase field → Sheet header
const SHEETS_COLUMNS: { header: string; field: keyof SupabaseJob }[] = [
  { header: 'job_title',       field: 'title' },
  { header: 'company',         field: 'company' },
  { header: 'company_domain',  field: 'companydomain' },
  { header: 'job_location',    field: 'location' },
  { header: 'description',     field: 'description' },
  { header: 'job_post_url',    field: 'url' },
  { header: 'date_posted',     field: 'dateposted' },
  { header: 'employment_type', field: 'employmenttype' },
  { header: 'salary',          field: 'salary' },
  { header: 'status',          field: 'status' },
  { header: 'source',          field: 'source' },
];

function supabaseJobsToSheetRows(jobs: SupabaseJob[]): any[][] {
  const headers = SHEETS_COLUMNS.map(c => c.header);
  const rows = jobs.map(job =>
    SHEETS_COLUMNS.map(col => sanitizeCell(job[col.field] as string | undefined | null))
  );
  return [headers, ...rows];
}

async function sendToSheets(
  jobs: SupabaseJob[],
  config: { webAppUrl: string; spreadsheetId: string; sheetName: string }
) {
  const payload = {
    spreadsheetId: config.spreadsheetId,
    sheetName: config.sheetName,
    data: supabaseJobsToSheetRows(jobs),
  };
  await fetch(config.webAppUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SupabaseTab() {
  // ── Table state ────────────────────────────────────────────────────────────
  const [jobs, setJobs]             = useState<SupabaseJob[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [healthy, setHealthy]       = useState<boolean | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortBy, setSortBy]         = useState<'newest' | 'oldest' | 'title' | 'company'>('newest');
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [deleting, setDeleting]     = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [allSources, setAllSources] = useState<string[]>([]);
  const [workerFilter, setWorkerFilter] = useState('all');
  const [allWorkers, setAllWorkers] = useState<string[]>([]);

  // ── Sheets state ───────────────────────────────────────────────────────────
  const storedConfig = (() => {
    try { return JSON.parse(localStorage.getItem(SHEETS_CONFIG_KEY) || '{}'); } catch { return {}; }
  })();
  const [sheetsConfig, setSheetsConfigState] = useState({
    webAppUrl:     storedConfig.webAppUrl     ?? '',
    spreadsheetId: storedConfig.spreadsheetId ?? '',
    sheetName:     storedConfig.sheetName     ?? 'Sheet1',
  });
  const [showSheetsConfig, setShowSheetsConfig] = useState(!storedConfig.webAppUrl);
  const [filterEmptyDesc, setFilterEmptyDesc] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem('recruitscout_filter_empty_desc') ?? 'false'); }
    catch { return false; }
  });
  const toggleFilterEmptyDesc = () => {
    setFilterEmptyDesc(prev => {
      const next = !prev;
      localStorage.setItem('recruitscout_filter_empty_desc', JSON.stringify(next));
      return next;
    });
  };
  const [syncing, setSyncing]           = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [syncStatus, setSyncStatus]     = useState<{ ok: boolean; msg: string } | null>(null);
  const syncAbort = useRef(false);

  const updateSheetsConfig = (k: string, v: string) => {
    const next = { ...sheetsConfig, [k]: v };
    setSheetsConfigState(next);
    localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify(next));
  };

  // ── Debounce search ────────────────────────────────────────────────────────
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 400);
  };

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabaseClient.healthCheck().then(setHealthy);
    // Load unique sources
    fetch(
      `${(supabaseClient as any).baseUrl}/rest/v1/jobs?select=source&limit=5000`,
      { headers: { apikey: (supabaseClient as any).apiKey, Authorization: `Bearer ${(supabaseClient as any).apiKey}`, Accept: 'application/json' } }
    ).then(r => r.json())
      .then((rows: { source: string }[]) =>
        setAllSources(Array.from(new Set(rows.map(r => (r.source ?? '').toLowerCase()).filter(Boolean))).sort())
      ).catch(() => {});
    // Load unique worker_ids
    supabaseClient.getUniqueWorkers().then(setAllWorkers);
  }, []);

  // ── Fetch page ─────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await supabaseClient.queryJobs({
        search: debouncedSearch || undefined,
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
        workerId: workerFilter !== 'all' ? workerFilter : undefined,
        sortBy,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      if (res.error) setError(res.error);
      else { setJobs(res.data ?? []); setTotal(res.total); setLastRefreshed(new Date()); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sourceFilter, workerFilter, sortBy]);

  useEffect(() => { fetchPage(); }, [fetchPage]);
  useEffect(() => { setPage(1); }, [sourceFilter, workerFilter, sortBy]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end   = Math.min(page * PAGE_SIZE, total);

  // ── Selection ──────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelectedIds(selectedIds.size === jobs.length ? new Set() : new Set(jobs.map(j => j.id)));

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (overrideIds?: string[]) => {
    const ids = overrideIds ?? Array.from(selectedIds);
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} job(s) from Supabase? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await supabaseClient.deleteJobs(ids);
    setDeleting(false);
    if (res.error) { alert('Delete error: ' + res.error); return; }
    setSelectedIds(new Set());
    fetchPage(true);
  };

  // ── Google Sheets sync ─────────────────────────────────────────────────────
  const handleSheetsSync = async () => {
    if (!sheetsConfig.webAppUrl) {
      setSyncStatus({ ok: false, msg: 'Please enter your Apps Script Web App URL first.' });
      setShowSheetsConfig(true);
      return;
    }

    const scope = debouncedSearch || sourceFilter !== 'all'
      ? `filtered results (${total.toLocaleString()} rows)`
      : `all ${total.toLocaleString()} rows`;

    if (!window.confirm(`Send ${scope} to Google Sheets?\n\nSheet: "${sheetsConfig.sheetName || 'Sheet1'}"\n\nThis will fetch all matching rows from Supabase in batches — large datasets may take a moment.`))
      return;

    setSyncing(true);
    setSyncStatus(null);
    syncAbort.current = false;

    try {
      const BATCH = 500; // rows per Supabase fetch
      const totalPages = Math.ceil(total / BATCH);
      let allJobs: SupabaseJob[] = [];

      // Fetch all matching rows from Supabase in batches
      for (let p = 0; p < totalPages; p++) {
        if (syncAbort.current) break;
        setSyncProgress(`Fetching from Supabase… page ${p + 1} of ${totalPages}`);

        const res = await supabaseClient.queryJobs({
          search: debouncedSearch || undefined,
          source: sourceFilter !== 'all' ? sourceFilter : undefined,
          workerId: workerFilter !== 'all' ? workerFilter : undefined,
          sortBy,
          limit: BATCH,
          offset: p * BATCH,
        });

        if (res.error) throw new Error(res.error);
        allJobs = allJobs.concat(res.data ?? []);
      }

      if (syncAbort.current) {
        setSyncStatus({ ok: false, msg: 'Sync cancelled.' });
        setSyncProgress(null);
        return;
      }

      // Drop rows with empty descriptions if the filter is active
      if (filterEmptyDesc) {
        const before = allJobs.length;
        allJobs = allJobs.filter(j => j.description && j.description.trim() !== '');
        const dropped = before - allJobs.length;
        if (dropped > 0) setSyncProgress(`Dropped ${dropped.toLocaleString()} rows with no description. Sending ${allJobs.length.toLocaleString()} rows…`);
        await new Promise(r => setTimeout(r, 600)); // brief pause so user sees the message
      }

      if (allJobs.length === 0) {
        setSyncStatus({ ok: false, msg: 'No rows left to send after filtering empty descriptions.' });
        setSyncing(false);
        setSyncProgress(null);
        return;
      }

      setSyncProgress(`Sending ${allJobs.length.toLocaleString()} rows to Google Sheets…`);

      // Google Sheets Apps Script has a 6-minute execution limit,
      // so we chunk into 1000-row payloads and append each one.
      const SHEET_CHUNK = 1000;
      for (let i = 0; i < allJobs.length; i += SHEET_CHUNK) {
        if (syncAbort.current) break;
        const chunk = allJobs.slice(i, i + SHEET_CHUNK);
        const chunkNum = Math.floor(i / SHEET_CHUNK) + 1;
        const totalChunks = Math.ceil(allJobs.length / SHEET_CHUNK);
        setSyncProgress(`Sending chunk ${chunkNum}/${totalChunks} (${chunk.length} rows)…`);
        await sendToSheets(chunk, {
          ...sheetsConfig,
          sheetName: sheetsConfig.sheetName || 'Sheet1',
        });
      }

      if (!syncAbort.current) {
        setSyncStatus({ ok: true, msg: `✓ Sent ${allJobs.length.toLocaleString()} rows to "${sheetsConfig.sheetName || 'Sheet1'}" successfully!` });
      } else {
        setSyncStatus({ ok: false, msg: 'Sync was cancelled mid-way.' });
      }
    } catch (e) {
      setSyncStatus({ ok: false, msg: `Sync failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setSyncing(false);
      setSyncProgress(null);
      setTimeout(() => setSyncStatus(null), 8000);
    }
  };

  // ── Pagination numbers ─────────────────────────────────────────────────────
  const pageNumbers = (): (number | '…')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4)              return [1, 2, 3, 4, 5, '…', totalPages];
    if (page >= totalPages - 3) return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', page - 1, page, page + 1, '…', totalPages];
  };

  // ── Cell renderer ──────────────────────────────────────────────────────────
  const renderCell = (job: SupabaseJob, col: ColDef) => {
    const raw = job[col.key];
    const val = raw !== null && raw !== undefined ? String(raw) : null;
    if (!val) return <span className="text-gray-700 select-none">—</span>;

    if (col.isLink) {
      return (
        <a href={val} target="_blank" rel="noopener noreferrer" title={val}
          className="flex items-center gap-1 text-cyan-500 hover:text-cyan-300 hover:underline transition-colors max-w-[190px]"
          onClick={e => e.stopPropagation()}>
          <span className="truncate">{val}</span>
          <span className="shrink-0"><ExternalLinkIcon /></span>
        </a>
      );
    }
    if (col.truncate) return <span title={val} className="block truncate max-w-[250px]">{val}</span>;
    return <span>{val}</span>;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
          <div className="text-2xl font-bold text-cyan-400">
            {loading && total === 0
              ? <span className="text-gray-600 text-base animate-pulse">loading…</span>
              : total.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total Rows in Supabase</div>
        </div>
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
          <div className="text-2xl font-bold text-purple-400">{COLUMNS.length}</div>
          <div className="text-xs text-gray-500 mt-1">Columns</div>
        </div>
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className={`text-sm font-semibold ${healthy === true ? 'text-emerald-400' : healthy === false ? 'text-red-400' : 'text-gray-500'}`}>
              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${healthy === true ? 'bg-emerald-400' : healthy === false ? 'bg-red-400' : 'bg-gray-600'}`} />
              {healthy === true ? 'Connected' : healthy === false ? 'Offline' : 'Checking…'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Supabase Status</div>
          </div>
          {lastRefreshed && (
            <div className="text-xs text-gray-600 text-right">Refreshed<br />{lastRefreshed.toLocaleTimeString()}</div>
          )}
        </div>
      </div>

      {/* ── Google Sheets Sync Panel ── */}
      <div className="bg-[#0d1321] border border-green-900/40 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-green-900/30">
          <div className="flex items-center gap-2.5">
            <span className="text-green-500"><SheetsIcon /></span>
            <span className="text-sm font-semibold text-gray-200">Google Sheets Sync</span>
            {(debouncedSearch || sourceFilter !== 'all') && (
              <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full px-2 py-0.5">
                Filtered · {total.toLocaleString()} rows
              </span>
            )}
            {!debouncedSearch && sourceFilter === 'all' && total > 0 && (
              <span className="text-xs bg-gray-700/50 text-gray-400 border border-gray-600/30 rounded-full px-2 py-0.5">
                All {total.toLocaleString()} rows
              </span>
            )}
            {filterEmptyDesc && (
              <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Dropping empty descriptions
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Filter empty descriptions toggle */}
            <button
              onClick={toggleFilterEmptyDesc}
              title={filterEmptyDesc ? 'Click to include all rows (currently dropping empty descriptions)' : 'Click to drop rows with no description before sending'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all
                ${filterEmptyDesc
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                  : 'bg-gray-800/60 text-gray-600 border-gray-700/50 hover:text-gray-400 hover:border-gray-600'}`}
            >
              <span className={filterEmptyDesc ? 'text-amber-400' : 'text-gray-600'}><PowerIcon /></span>
              {filterEmptyDesc ? 'No-desc filter ON' : 'No-desc filter'}
            </button>
            <button
              onClick={() => setShowSheetsConfig(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
            >
              <SettingsIcon />
              {showSheetsConfig ? 'Hide config' : 'Config'}
            </button>
            <button
              onClick={syncing ? () => { syncAbort.current = true; } : handleSheetsSync}
              disabled={total === 0 || (!sheetsConfig.webAppUrl && !syncing)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border
                ${syncing
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                  : 'bg-green-600/20 text-green-400 border-green-500/30 hover:bg-green-600/30 disabled:opacity-40 disabled:cursor-not-allowed'}`}
            >
              {syncing ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <SheetsIcon />
                  Send to Sheets
                </>
              )}
            </button>
          </div>
        </div>

        {/* Config inputs (collapsible) */}
        {showSheetsConfig && (
          <div className="px-5 py-4 bg-black/20 border-b border-green-900/20 space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Apps Script Web App URL <span className="text-red-500">*</span></label>
              <input type="text" placeholder="https://script.google.com/macros/s/…/exec"
                value={sheetsConfig.webAppUrl}
                onChange={e => updateSheetsConfig('webAppUrl', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Spreadsheet ID (optional)</label>
                <input type="text" placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                  value={sheetsConfig.spreadsheetId}
                  onChange={e => updateSheetsConfig('spreadsheetId', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Sheet Name</label>
                <input type="text" placeholder="Sheet1"
                  value={sheetsConfig.sheetName}
                  onChange={e => updateSheetsConfig('sheetName', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all" />
              </div>
            </div>
            <p className="text-xs text-gray-600">Columns sent: {COLUMNS.map(c => c.key).join(', ')}</p>
          </div>
        )}

        {/* Progress / status */}
        {syncProgress && (
          <div className="px-5 py-3 border-b border-green-900/20 bg-amber-500/5">
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {syncProgress}
            </div>
          </div>
        )}
        {syncStatus && !syncProgress && (
          <div className={`px-5 py-3 text-sm border-b ${syncStatus.ok ? 'bg-green-500/5 border-green-900/20 text-green-400' : 'bg-red-500/5 border-red-900/20 text-red-400'}`}>
            {syncStatus.msg}
          </div>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-3 flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><SearchIcon /></span>
          <input type="text" placeholder="Search title, company, location…"
            value={search} onChange={e => handleSearchChange(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-7 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all" />
          {search && (
            <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs">✕</button>
          )}
        </div>

        {/* Source filter */}
        <div className="relative">
          <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
            className="appearance-none bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg pl-3 pr-7 py-2 focus:outline-none focus:border-cyan-500 cursor-pointer">
            <option value="all">All Sources</option>
            {allSources.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"><ChevronDownIcon /></span>
        </div>

        {/* Worker / Extension filter */}
        <div className="relative">
          <select value={workerFilter} onChange={e => { setWorkerFilter(e.target.value); setPage(1); }}
            className="appearance-none bg-gray-900 border border-cyan-900/60 text-gray-300 text-sm rounded-lg pl-3 pr-7 py-2 focus:outline-none focus:border-cyan-500 cursor-pointer">
            <option value="all">🌐 All Nodes</option>
            {allWorkers.map(w => <option key={w} value={w}>🖥 {w}</option>)}
          </select>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"><ChevronDownIcon /></span>
        </div>

        {/* Sort */}
        <div className="relative">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="appearance-none bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg pl-3 pr-7 py-2 focus:outline-none focus:border-cyan-500 cursor-pointer">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">title A–Z</option>
            <option value="company">company A–Z</option>
          </select>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"><ChevronDownIcon /></span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button onClick={() => handleDelete()} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50">
              <TrashIcon />
              {deleting ? 'Deleting…' : `Delete (${selectedIds.size})`}
            </button>
          )}
          <button onClick={() => fetchPage()} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-50">
            <span className={loading ? 'animate-spin' : ''}><RefreshIcon /></span>
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">⚠ {error}</div>
      )}

      {/* Row info */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>
          {loading ? 'Fetching…' : total === 0 ? 'No results'
            : `Rows ${start}–${end} of ${total.toLocaleString()} (page ${page}/${totalPages.toLocaleString()})`}
        </span>
        {selectedIds.size > 0 && <span className="text-cyan-500">{selectedIds.size} selected</span>}
      </div>

      {/* ── Data Table ── */}
      <div className="rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#0d1321] border-b border-gray-700/50">
                <th className="sticky left-0 z-10 bg-[#0d1321] px-3 py-3 border-r border-gray-700/30">
                  <input type="checkbox"
                    checked={jobs.length > 0 && selectedIds.size === jobs.length}
                    onChange={toggleAll}
                    className="rounded border-gray-600 bg-gray-900 accent-cyan-500 cursor-pointer" />
                </th>
                <th className="px-3 py-3 border-r border-gray-700/30 min-w-[44px]" />
                {COLUMNS.map(col => (
                  <th key={col.key}
                    className={`${col.minWidth} px-3 py-3 text-left font-mono text-xs text-gray-400 font-semibold tracking-wide whitespace-nowrap border-r border-gray-700/20 last:border-r-0`}>
                    {col.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-600">
                      <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Loading from Supabase…</span>
                    </div>
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="py-24 text-center text-gray-600 text-sm">
                    No jobs match your filters
                  </td>
                </tr>
              ) : (
                jobs.map((job, rowIdx) => {
                  const isSelected = selectedIds.has(job.id);
                  return (
                    <tr key={job.id}
                      className={`border-b border-gray-800/50 transition-colors
                        ${isSelected ? 'bg-cyan-500/5' : rowIdx % 2 === 0 ? 'bg-transparent' : 'bg-gray-800/10'}
                        hover:bg-gray-800/30`}>
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-2.5 border-r border-gray-700/20">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(job.id)}
                          className="rounded border-gray-600 bg-gray-900 accent-cyan-500 cursor-pointer" />
                      </td>
                      <td className="px-2 py-2.5 border-r border-gray-700/10">
                        <button onClick={() => handleDelete([job.id])}
                          className="text-gray-700 hover:text-red-400 transition-colors p-1" title="Delete row">
                          <TrashIcon />
                        </button>
                      </td>
                      {COLUMNS.map(col => (
                        <td key={col.key}
                          className="px-3 py-2.5 text-gray-300 border-r border-gray-800/30 last:border-r-0 align-top whitespace-nowrap">
                          {renderCell(job, col)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <button onClick={() => setPage(1)} disabled={page === 1 || loading}
            className="px-2.5 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 text-xs hover:text-white disabled:opacity-30 transition-all">
            First
          </button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}
            className="p-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-all">
            <ChevronLeftIcon />
          </button>

          {pageNumbers().map((p, i) =>
            p === '…'
              ? <span key={`e${i}`} className="px-1 text-gray-700 select-none">…</span>
              : (
                <button key={p} onClick={() => setPage(p as number)} disabled={loading}
                  className={`w-9 h-9 rounded-lg text-sm border transition-all disabled:opacity-50
                    ${page === p ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-white'}`}>
                  {p}
                </button>
              )
          )}

          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading}
            className="p-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-all">
            <ChevronRightIcon />
          </button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages || loading}
            className="px-2.5 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 text-xs hover:text-white disabled:opacity-30 transition-all">
            Last
          </button>

          <span className="ml-3 flex items-center gap-2 text-xs text-gray-600">
            Go to
            <input type="number" min={1} max={totalPages} defaultValue={page} key={page}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const v = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!isNaN(v) && v >= 1 && v <= totalPages) setPage(v);
                }
              }}
              className="w-16 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-center text-sm text-gray-300 focus:outline-none focus:border-cyan-500" />
          </span>
        </div>
      )}
    </div>
  );
}
