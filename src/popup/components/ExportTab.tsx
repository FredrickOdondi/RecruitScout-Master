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

  // ── Load unique workers from Supabase on mount ──────────────────────────────
  useEffect(() => {
    setLoadingWorkers(true);
    supabaseClient.getUniqueWorkers().then(list => {
      setWorkers(list);
      setLoadingWorkers(false);
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

      const cloudJobs = await fetchAllFromSupabase(selectedWorker, setExportProgress);
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
    if (!sheetsConfig.webAppUrl) {
      setSheetsSyncStatus({ ok: false, msg: 'Please enter your Apps Script Web App URL first.' });
      return;
    }
    try {
      setIsSheetsSyncing(true);
      setSheetsSyncStatus(null);
      setSheetsProgress('Connecting to Supabase…');

      const cloudJobs = await fetchAllFromSupabase(selectedWorker, setSheetsProgress);
      if (cloudJobs.length === 0) {
        setSheetsSyncStatus({ ok: false, msg: 'No jobs found in Supabase for the selected filter.' });
        return;
      }

      // Chunk into 1000-row payloads (Apps Script execution limit)
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
    <div className="grid grid-cols-2 gap-6">

      {/* ── LEFT COLUMN ─────────────────────────────────────────────────────── */}
      <div className="space-y-5">

        {/* Cloud Stats */}
        <div className="bg-[#0d1321] border border-gray-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-4xl font-bold text-gray-100 font-mono">
                {workerCount === null
                  ? <span className="text-gray-600 text-2xl animate-pulse">—</span>
                  : workerCount.toLocaleString()}
              </div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-widest mt-1">
                {selectedWorker === 'all' ? 'Total Cloud Jobs' : `Jobs by "${selectedWorker}"`}
              </div>
            </div>
            <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            </div>
          </div>
          {totalCloudCount !== null && selectedWorker !== 'all' && (
            <div className="text-xs text-gray-600 font-mono">
              {workerCount?.toLocaleString()} / {totalCloudCount.toLocaleString()} total cloud jobs
            </div>
          )}
          <button
            onClick={refreshCount}
            disabled={busy}
            className="mt-3 text-xs text-gray-600 hover:text-cyan-400 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh count
          </button>
        </div>

        {/* Extension Node Filter */}
        <div className="bg-[#0d1321] border border-gray-800 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
              Filter by Extension Node
            </h2>
            {loadingWorkers && (
              <span className="text-xs text-gray-600 animate-pulse">Loading…</span>
            )}
          </div>

          <select
            value={selectedWorker}
            onChange={e => setSelectedWorker(e.target.value)}
            disabled={busy || loadingWorkers}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all appearance-none font-mono"
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
            <p className="text-xs text-gray-600 leading-relaxed">
              Extension nodes appear here once each laptop scrapes its first job with a <span className="text-gray-400 font-mono">friendName</span> configured in Engine Settings.
            </p>
          )}
        </div>

        {/* Google Sheets Sync */}
        <div className="bg-[#0d1321] border border-gray-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
            <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 14H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Google Sheets Sync</h2>
          </div>

          <div className="space-y-2.5">
            <input type="text" placeholder="Apps Script Web App URL"
              value={sheetsConfig.webAppUrl}
              onChange={e => updateSheetsConfig('webAppUrl', e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all outline-none"
            />
            <div className="flex gap-3">
              <input type="text" placeholder="Spreadsheet ID (optional)"
                value={sheetsConfig.spreadsheetId}
                onChange={e => updateSheetsConfig('spreadsheetId', e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all outline-none"
              />
              <input type="text" placeholder="Sheet1"
                value={sheetsConfig.sheetName}
                onChange={e => updateSheetsConfig('sheetName', e.target.value)}
                className="w-1/3 bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-300 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all outline-none"
              />
            </div>
          </div>

          {sheetsProgress && (
            <div className="text-xs font-mono text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 flex items-center gap-2">
              <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {sheetsProgress}
            </div>
          )}

          <button
            onClick={handleSyncToSheets}
            disabled={busy || workerCount === 0 || !sheetsConfig.webAppUrl}
            className="w-full bg-green-600/90 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-500/10 border border-green-500/30 disabled:border-transparent"
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
            <div className={`text-xs font-mono p-3 rounded-lg text-center font-medium ${sheetsSyncStatus.ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {sheetsSyncStatus.msg}
            </div>
          )}
        </div>

      </div>

      {/* ── RIGHT COLUMN ────────────────────────────────────────────────────── */}
      <div className="space-y-5">

        {/* Format + Download */}
        <div className="bg-[#0d1321] border border-gray-800 rounded-xl p-5 shadow-lg space-y-4">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest border-b border-gray-800 pb-2">Download Format</h2>
          <div className="grid grid-cols-3 gap-3">
            {(['csv', 'json', 'xlsx'] as ExportFormat[]).map(fmt => (
              <button key={fmt} onClick={() => setFormat(fmt)}
                className={`px-4 py-3 rounded-lg text-sm font-bold tracking-wider transition-all border
                  ${format === fmt
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                    : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700 hover:bg-gray-800'}`}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>

          {exportProgress && (
            <div className="text-xs font-mono text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 flex items-center gap-2">
              <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {exportProgress}
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={busy || workerCount === 0 || selectedJobsCount === 0}
            className="w-full bg-purple-600/90 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-purple-500/20 border border-purple-500/30 disabled:border-transparent"
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
            <div className={`text-xs font-mono p-3 rounded-lg text-center font-medium ${exportStatus.ok ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              {exportStatus.msg}
            </div>
          )}
        </div>

        {/* Field selection */}
        <div className="bg-[#0d1321] border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col h-[380px]">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest border-b border-gray-800 pb-2 mb-4 flex justify-between">
            <span>Fields Matrix</span>
            <span className="text-purple-400 font-mono text-xs bg-purple-500/10 px-2 py-0.5 rounded">{selectedJobsCount} Included</span>
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {fields.map(field => (
              <label key={field.key} className="flex items-center gap-3 cursor-pointer group hover:bg-gray-800/50 p-2 rounded-lg transition-colors">
                <input type="checkbox" checked={field.enabled} onChange={() => toggleField(field.key)}
                  className="form-checkbox h-5 w-5 text-purple-500 rounded bg-gray-900 border-gray-700 hover:border-purple-500 transition-colors cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-400 group-hover:text-gray-200 transition-colors">{field.label}</span>
              </label>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
