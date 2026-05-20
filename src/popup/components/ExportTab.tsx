import React, { useState, useEffect, useCallback } from 'react';
import { MessageType, ExtensionMessage, ExportFormat } from '../../shared/types';
import { DEFAULT_EXPORT_FIELDS } from '../../shared/types';
import { supabaseClient, SupabaseJob } from '../../shared/supabase';
import { CSVExporter } from '../../lib/export/csv-exporter';
import { XLSXExporter } from '../../lib/export/xlsx-exporter';

interface ExportTabProps {
  jobs: any[]; // local cache — kept for backward compat but NOT used for cloud ops
  settings: any;
  sendMessage: <T>(message: ExtensionMessage) => Promise<T>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sanitizeCell(val: string | undefined | null): string {
  if (!val) return '';
  let s = String(val).trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (s.length > 49000) s = s.substring(0, 49000) + '\n...[truncated]';
  return s;
}

// Exact column order and names for Google Sheets export
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

async function sendToGoogleSheets(
  jobs: SupabaseJob[],
  config: { webAppUrl: string; spreadsheetId: string; sheetName: string }
) {
  const rows = [
    SHEETS_COLUMNS.map(c => c.header),
    ...jobs.map(j => SHEETS_COLUMNS.map(c => sanitizeCell(j[c.field] as string | undefined | null))),
  ];
  await fetch(config.webAppUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ spreadsheetId: config.spreadsheetId, sheetName: config.sheetName, data: rows }),
  });
}

// ── Fetch ALL matching jobs from Supabase (paginated) ─────────────────────────
async function fetchAllFromSupabase(
  workerId: string,
  clientName?: string,
  onProgress?: (msg: string) => void
): Promise<SupabaseJob[]> {
  const BATCH = 1000;
  let all: SupabaseJob[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    onProgress?.(`Fetching from Supabase… (${all.length} rows loaded)`);
    const res = await supabaseClient.queryJobs({
      workerId: workerId === 'all' ? undefined : workerId,
      client: clientName || undefined,
      limit: BATCH,
      offset,
    });
    if (res.error) throw new Error(res.error);
    all = all.concat(res.data ?? []);
    total = res.total;
    if (!res.data || res.data.length < BATCH) break;
    offset += BATCH;
  }
  return all;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExportTab({ settings, sendMessage }: ExportTabProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [fields, setFields] = useState(DEFAULT_EXPORT_FIELDS);

  // Worker / extension selection
  const [workers, setWorkers] = useState<string[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<string>('all');
  const [workerCount, setWorkerCount] = useState<number | null>(null);
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  // Action states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const [isSheetsSyncing, setIsSheetsSyncing] = useState(false);
  const [sheetsProgress, setSheetsProgress] = useState<string | null>(null);
  const [sheetsSyncStatus, setSheetsSyncStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sheetsConfig, setSheetsConfig] = useState(
    settings?.googleSheetsConfig || { webAppUrl: '', spreadsheetId: '', sheetName: 'Sheet1' }
  );

  // Total job count in cloud (for selected worker)
  const [totalCloudCount, setTotalCloudCount] = useState<number | null>(null);

  // Enrolled clients selection
  const [allEnrolledClients, setAllEnrolledClients] = useState<any[]>([]);
  const [selectedClientSync, setSelectedClientSync] = useState<string>('all');

  // ── Load unique workers from Supabase on mount ──────────────────────────────
  useEffect(() => {
    setLoadingWorkers(true);
    supabaseClient.getUniqueWorkers().then(list => {
      setWorkers(list);
      setLoadingWorkers(false);
    });
    // Load enrolled clients
    supabaseClient.getClients().then(res => {
      if (res.data) {
        setAllEnrolledClients(res.data);
      }
    });
  }, []);

  // ── Fetch job count for selected worker ─────────────────────────────────────
  const refreshCount = useCallback(async () => {
    setWorkerCount(null);
    setTotalCloudCount(null);
    try {
      const res = await supabaseClient.queryJobs({
        workerId: selectedWorker === 'all' ? undefined : selectedWorker,
        limit: 1,
        offset: 0,
      });
      setWorkerCount(res.total);
    } catch {
      setWorkerCount(null);
    }

    // Also load overall total
    const all = await supabaseClient.queryJobs({ limit: 1, offset: 0 });
    setTotalCloudCount(all.total);
  }, [selectedWorker]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  useEffect(() => {
    if (settings?.googleSheetsConfig) setSheetsConfig(settings.googleSheetsConfig);
  }, [settings?.googleSheetsConfig]);

  const updateSheetsConfig = (key: string, value: string) => {
    const next = { ...sheetsConfig, [key]: value };
    setSheetsConfig(next);
    sendMessage({ type: MessageType.UPDATE_SETTINGS, payload: { googleSheetsConfig: next } });
  };

  function toggleField(key: any) {
    setFields(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  }

  // ── Download (fetch cloud → compile → download file) ────────────────────────
  async function handleExport() {
    try {
      setIsExporting(true);
      setExportStatus(null);
      setExportProgress('Connecting to Supabase…');

      const cloudJobs = await fetchAllFromSupabase(selectedWorker, undefined, setExportProgress);
      if (cloudJobs.length === 0) {
        setExportStatus({ ok: false, msg: 'No jobs found in Supabase for the selected filter.' });
        return;
      }

      setExportProgress(`Compiling ${cloudJobs.length} jobs…`);

      const enabledFields = fields.filter(f => f.enabled);
      const fieldKeys = enabledFields.map(f => f.key as keyof SupabaseJob);
      const headers = enabledFields.map(f => f.label || f.key);

      let content = '';
      let mimeType = '';

      if (format === 'json') {
        content = JSON.stringify({ exportedAt: new Date().toISOString(), totalJobs: cloudJobs.length, jobs: cloudJobs }, null, 2);
        mimeType = 'application/json;charset=utf-8;';
      } else if (format === 'csv') {
        // Map to plain objects with only selected fields
        const rows = cloudJobs.map(j => {
          const obj: any = {};
          fieldKeys.forEach(k => { obj[k] = (j as any)[k] ?? ''; });
          return obj;
        });
        content = CSVExporter.export(rows, { fields: fieldKeys as any, headers, includeMetadata: false });
        mimeType = 'text/csv;charset=utf-8;';
      } else if (format === 'xlsx') {
        const rows = cloudJobs.map(j => {
          const obj: any = {};
          fieldKeys.forEach(k => { obj[k] = (j as any)[k] ?? ''; });
          return obj;
        });
        content = XLSXExporter.exportAsExcelXML(rows, { fields: fieldKeys as any, headers, includeHeaders: true });
        mimeType = 'application/xml';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const tag = selectedWorker !== 'all' ? `-${selectedWorker}` : '';
      a.download = `recruitscout-jobs${tag}-${new Date().toISOString().split('T')[0]}.${format === 'xlsx' ? 'xls' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus({ ok: true, msg: `Downloaded ${cloudJobs.length} jobs successfully!` });
    } catch (err) {
      setExportStatus({ ok: false, msg: `Export failed: ${(err as Error).message}` });
    } finally {
      setIsExporting(false);
      setExportProgress(null);
      setTimeout(() => setExportStatus(null), 6000);
    }
  }

  // ── Google Sheets Sync (fetch cloud → send) ──────────────────────────────────
  async function handleSyncToSheets() {
    try {
      setIsSheetsSyncing(true);
      setSheetsSyncStatus(null);
      setSheetsProgress('Starting Google Sheets Sync…');

      if (selectedClientSync === 'custom') {
        if (!sheetsConfig.webAppUrl) {
          setSheetsSyncStatus({ ok: false, msg: 'Please enter your Apps Script Web App URL first.' });
          return;
        }
        setSheetsProgress('Connecting to Supabase…');
        const rawJobs = await fetchAllFromSupabase(selectedWorker, undefined, setSheetsProgress);
        const cloudJobs = rawJobs.filter(j => j.description && j.description.trim() !== '');
        if (cloudJobs.length === 0) {
          setSheetsSyncStatus({ ok: false, msg: 'No jobs found in Supabase with non-empty descriptions.' });
          return;
        }

        const CHUNK = 1000;
        const totalChunks = Math.ceil(cloudJobs.length / CHUNK);
        for (let i = 0; i < cloudJobs.length; i += CHUNK) {
          const chunkNum = Math.floor(i / CHUNK) + 1;
          setSheetsProgress(`Sending chunk ${chunkNum}/${totalChunks} to Sheets…`);
          await sendToGoogleSheets(cloudJobs.slice(i, i + CHUNK), {
            ...sheetsConfig,
            sheetName: sheetsConfig.sheetName || 'Sheet1',
          });
        }
        setSheetsSyncStatus({ ok: true, msg: `✓ Sent ${cloudJobs.length} jobs to "${sheetsConfig.sheetName || 'Sheet1'}" successfully!` });
      } else if (selectedClientSync === 'all') {
        if (allEnrolledClients.length === 0) {
          setSheetsSyncStatus({ ok: false, msg: 'No enrolled clients found to sync.' });
          return;
        }

        let totalSynced = 0;
        for (const client of allEnrolledClients) {
          setSheetsProgress(`Syncing jobs for client "${client.name}"…`);
          const rawJobs = await fetchAllFromSupabase(selectedWorker, client.name, setSheetsProgress);
          const clientJobs = rawJobs.filter(j => j.description && j.description.trim() !== '');
          if (clientJobs.length > 0) {
            const CHUNK = 1000;
            const totalChunks = Math.ceil(clientJobs.length / CHUNK);
            for (let i = 0; i < clientJobs.length; i += CHUNK) {
              const chunkNum = Math.floor(i / CHUNK) + 1;
              setSheetsProgress(`Sending client "${client.name}" chunk ${chunkNum}/${totalChunks}…`);
              await sendToGoogleSheets(clientJobs.slice(i, i + CHUNK), {
                webAppUrl: client.apps_script_url,
                spreadsheetId: client.spreadsheet_id || '',
                sheetName: client.sheet_name || 'Sheet1',
              });
            }
            totalSynced += clientJobs.length;
          }
        }
        setSheetsSyncStatus({ ok: true, msg: `✓ Successfully synced ${totalSynced} jobs across all enrolled client sheets!` });
      } else {
        const client = allEnrolledClients.find(c => c.name === selectedClientSync);
        if (!client) {
          setSheetsSyncStatus({ ok: false, msg: 'Selected client not found.' });
          return;
        }
        setSheetsProgress(`Fetching jobs for "${client.name}"…`);
        const rawJobs = await fetchAllFromSupabase(selectedWorker, client.name, setSheetsProgress);
        const clientJobs = rawJobs.filter(j => j.description && j.description.trim() !== '');
        if (clientJobs.length === 0) {
          setSheetsSyncStatus({ ok: false, msg: `No jobs found in Supabase with non-empty descriptions for client "${client.name}".` });
          return;
        }

        const CHUNK = 1000;
        const totalChunks = Math.ceil(clientJobs.length / CHUNK);
        for (let i = 0; i < clientJobs.length; i += CHUNK) {
          const chunkNum = Math.floor(i / CHUNK) + 1;
          setSheetsProgress(`Sending chunk ${chunkNum}/${totalChunks} to "${client.name}" Sheet…`);
          await sendToGoogleSheets(clientJobs.slice(i, i + CHUNK), {
            webAppUrl: client.apps_script_url,
            spreadsheetId: client.spreadsheet_id || '',
            sheetName: client.sheet_name || 'Sheet1',
          });
        }
        setSheetsSyncStatus({ ok: true, msg: `✓ Sent ${clientJobs.length} jobs to client "${client.name}" Sheet successfully!` });
      }
    } catch (err) {
      setSheetsSyncStatus({ ok: false, msg: `Sync failed: ${(err as Error).message}` });
    } finally {
      setIsSheetsSyncing(false);
      setSheetsProgress(null);
      setTimeout(() => setSheetsSyncStatus(null), 8000);
    }
  }

  const selectedJobsCount = fields.filter(f => f.enabled).length;
  const busy = isExporting || isSheetsSyncing;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

      {/* ── LEFT COLUMN ─────────────────────────────────────────────────────── */}
      <div className="space-y-5">

        {/* Cloud Stats */}
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-3xl font-medium text-gray-900 font-mono">
                {workerCount === null
                  ? <span className="text-gray-500 text-2xl animate-pulse">—</span>
                  : workerCount.toLocaleString()}
              </div>
              <div className="text-[11px] font-medium text-gray-600 uppercase tracking-widest mt-1">
                {selectedWorker === 'all' ? 'Total Cloud Jobs' : `Jobs by "${selectedWorker}"`}
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center border border-gray-200">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
          </div>
          {totalCloudCount !== null && selectedWorker !== 'all' && (
            <div className="text-[12px] text-gray-600 font-mono">
              {workerCount?.toLocaleString()} / {totalCloudCount.toLocaleString()} total cloud jobs
            </div>
          )}
          <button
            onClick={refreshCount}
            disabled={busy}
            className="mt-3 text-[12px] text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh count
          </button>
        </div>

        {/* Extension Node Filter */}
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-[11px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
              Filter by Extension Node
            </h2>
            {loadingWorkers && (
              <span className="text-[11px] text-gray-500 animate-pulse">Loading…</span>
            )}
          </div>

          <select
            value={selectedWorker}
            onChange={e => setSelectedWorker(e.target.value)}
            disabled={busy || loadingWorkers}
            className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 text-[13px] text-gray-900 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-all appearance-none font-mono"
          >
            <option value="all">🌐 All Extensions (full cloud)</option>
            {workers.length === 0 && !loadingWorkers && (
              <option disabled>No extension nodes found yet</option>
            )}
            {workers.map(w => (
              <option key={w} value={w}>🖥 {w}</option>
            ))}
          </select>

          {workers.length === 0 && !loadingWorkers && (
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Extension nodes appear here once each laptop scrapes its first job with a <span className="font-mono text-gray-700">friendName</span> configured in Engine Settings.
            </p>
          )}
        </div>

        {/* Google Sheets Sync */}
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
            <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 14H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            <h2 className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">Google Sheets Sync</h2>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-gray-700 font-bold uppercase tracking-wider block">Target Client Sheet</label>
              <select
                value={selectedClientSync}
                onChange={e => setSelectedClientSync(e.target.value)}
                disabled={busy}
                className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 text-[13px] text-gray-900 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all appearance-none cursor-pointer"
              >
                <option value="all">🔁 All Enrolled Clients (Automatic Grouping)</option>
                <option value="custom">✏️ Custom Sheet Settings (Manual)</option>
                {allEnrolledClients.map(c => (
                  <option key={c.id} value={c.name}>💼 {c.name}</option>
                ))}
              </select>
            </div>

            {selectedClientSync === 'custom' ? (
              <div className="space-y-2.5 pt-1">
                <input type="text" placeholder="Apps Script Web App URL"
                  value={sheetsConfig.webAppUrl}
                  onChange={e => updateSheetsConfig('webAppUrl', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 text-[13px] text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all outline-none"
                />
                <div className="flex gap-2">
                  <input type="text" placeholder="Spreadsheet ID (optional)"
                    value={sheetsConfig.spreadsheetId}
                    onChange={e => updateSheetsConfig('spreadsheetId', e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-md p-2 text-[13px] text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all outline-none"
                  />
                  <input type="text" placeholder="Sheet1"
                    value={sheetsConfig.sheetName}
                    onChange={e => updateSheetsConfig('sheetName', e.target.value)}
                    className="w-1/3 bg-gray-50 border border-gray-200 rounded-md p-2 text-[13px] text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all outline-none"
                  />
                </div>
              </div>
            ) : selectedClientSync === 'all' ? (
              <div className="bg-green-50 border border-green-100 rounded-md p-3 text-[12px] text-green-800 leading-relaxed">
                🚀 This will automatically group your jobs by client and sync them to each enrolled client's Google Sheet in parallel.
              </div>
            ) : (
              (() => {
                const client = allEnrolledClients.find(c => c.name === selectedClientSync);
                return client ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-[12px] text-gray-700 space-y-1">
                    <div><span className="font-semibold text-gray-900">Enrolled Client:</span> {client.name}</div>
                    <div className="truncate"><span className="font-semibold text-gray-900">Script URL:</span> {client.apps_script_url || '—'}</div>
                    <div className="truncate"><span className="font-semibold text-gray-900">Spreadsheet ID:</span> {client.spreadsheet_id || '—'}</div>
                    <div><span className="font-semibold text-gray-900">Sheet Name:</span> {client.sheet_name || 'Sheet1'}</div>
                  </div>
                ) : null;
              })()
            )}
          </div>

          {sheetsProgress && (
            <div className="text-[12px] font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-center gap-2">
              <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {sheetsProgress}
            </div>
          )}

          <button
            onClick={handleSyncToSheets}
            disabled={busy || workerCount === 0 || (selectedClientSync === 'custom' && !sheetsConfig.webAppUrl)}
            className="w-full bg-white hover:bg-gray-50 text-gray-800 disabled:bg-gray-100 disabled:text-gray-500 font-medium py-2 rounded-md transition-all flex items-center justify-center gap-2 border border-gray-200 shadow-sm text-[13px]"
          >
            {isSheetsSyncing ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Syncing…
              </>
            ) : (
              <>
                <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Sync {workerCount !== null ? workerCount.toLocaleString() : '…'} Jobs to Sheets
              </>
            )}
          </button>

          {sheetsSyncStatus && !sheetsProgress && (
            <div className={`text-[12px] font-mono p-2 rounded-md text-center font-medium ${sheetsSyncStatus.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {sheetsSyncStatus.msg}
            </div>
          )}
        </div>

      </div>

      {/* ── RIGHT COLUMN ────────────────────────────────────────────────────── */}
      <div className="space-y-5">

        {/* Format + Download */}
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm space-y-4">
          <h2 className="text-[11px] font-bold text-gray-600 uppercase tracking-widest border-b border-gray-200 pb-2">Download Format</h2>
          <div className="grid grid-cols-3 gap-2">
            {(['csv', 'json', 'xlsx'] as ExportFormat[]).map(fmt => (
              <button key={fmt} onClick={() => setFormat(fmt)}
                className={`px-3 py-2 rounded-md text-[12px] font-bold tracking-wider transition-all border
                  ${format === fmt
                    ? 'bg-gray-100 text-gray-900 border-gray-300 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:text-gray-700 hover:bg-gray-50'}`}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>

          {exportProgress && (
            <div className="text-[12px] font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-center gap-2">
              <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {exportProgress}
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={busy || workerCount === 0 || selectedJobsCount === 0}
            className="w-full bg-white hover:bg-gray-50 text-gray-800 disabled:bg-gray-100 disabled:text-gray-500 font-medium py-2 rounded-md transition-all flex items-center justify-center gap-2 border border-gray-200 shadow-sm text-[13px]"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Fetching & Compiling…
              </>
            ) : (
              <>
                <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download {workerCount !== null ? workerCount.toLocaleString() : '…'} Jobs as {format.toUpperCase()}
              </>
            )}
          </button>

          {exportStatus && !exportProgress && (
            <div className={`text-[12px] font-mono p-2 rounded-md text-center font-medium ${exportStatus.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {exportStatus.msg}
            </div>
          )}
        </div>

        {/* Field selection */}
        <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm flex flex-col h-[380px]">
          <h2 className="text-[11px] font-bold text-gray-600 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3 flex justify-between">
            <span>Fields Matrix</span>
            <span className="text-gray-600 font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">{selectedJobsCount} Included</span>
          </h2>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {fields.map(field => (
              <label key={field.key} className="flex items-center gap-2.5 cursor-pointer group hover:bg-gray-50 p-1.5 rounded-md transition-colors">
                <input type="checkbox" checked={field.enabled} onChange={() => toggleField(field.key)}
                  className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer"
                />
                <span className="text-[13px] font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{field.label}</span>
              </label>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
