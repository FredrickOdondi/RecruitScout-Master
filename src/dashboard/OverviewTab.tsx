import React, { useEffect, useState, useCallback } from 'react';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseClient } from '../shared/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  RadialBarChart, RadialBar,
  LineChart, Line,
} from 'recharts';
import {
  Briefcase, Users, UserCheck, Loader2, AlertCircle,
  RefreshCw, Mail, Database, Zap,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const ANON_HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Accept': 'application/json',
};

// Chart series use the six Glacier accent families (mid-tones that read on both
// themes). SVG attributes can't take CSS variables, so these are the token hexes.
const GLACIER_FAMILIES = {
  deepsea: ['#004670', '#1E70A7', '#4590C8', '#8FC4EC', '#DEF0FF'],
  teal:    ['#004D4A', '#0B7A75', '#2A9C96', '#7FCFC9', '#DCF2F0'],
  iris:    ['#421BA1', '#6840E7', '#7A5CFA', '#B1A0FF', '#EBEBFE'],
  saffron: ['#583D00', '#B27F00', '#E0A100', '#F0BE45', '#FAEBD1'],
  fern:    ['#005125', '#00803F', '#39A05E', '#8FD3A6', '#DDF4E2'],
  coral:   ['#742300', '#B23F09', '#D56237', '#F59A79', '#FFE7DF'],
};

const PALETTE = {
  emerald: GLACIER_FAMILIES.fern,
  violet:  GLACIER_FAMILIES.iris,
  sky:     GLACIER_FAMILIES.deepsea,
  rose:    GLACIER_FAMILIES.coral,
  amber:   GLACIER_FAMILIES.saffron,
  indigo:  GLACIER_FAMILIES.iris,
  teal:    GLACIER_FAMILIES.teal,
  pink:    GLACIER_FAMILIES.coral,
  orange:  GLACIER_FAMILIES.saffron,
  cyan:    GLACIER_FAMILIES.teal,
};

const SOURCE_LINE_COLORS = ['#1E70A7', '#2A9C96', '#7A5CFA', '#E0A100', '#39A05E', '#D56237', '#4590C8', '#B27F00'];
const CHART_GRID = 'rgba(110,132,143,0.22)';
const TICK = { fill: '#6E848F', fontSize: 12 };

const TT = {
  contentStyle: {
    background: 'rgb(var(--g-bg-surface))',
    border: '1px solid rgb(var(--g-stroke-card))',
    borderRadius: '8px',
    boxShadow: 'var(--g-shadow-dialog)',
    fontSize: '12px',
    color: 'rgb(var(--g-fg))',
    padding: '8px 12px',
  },
  labelStyle: { color: 'rgb(var(--g-fg-muted))', fontWeight: 500, marginBottom: 4 },
  itemStyle: { color: 'rgb(var(--g-fg))' },
  cursor: { fill: 'var(--g-bg-hover)' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** HEAD request — returns total row count via Content-Range header */
async function fetchCount(table: string, filter?: string): Promise<number> {
  // NOTE: select=id is just to make the query valid; we only read the header
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=id${filter ? '&' + filter : ''}&limit=0`;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { ...ANON_HEADERS, 'Prefer': 'count=exact' },
      signal: AbortSignal.timeout(30000),
    });
    const cr = res.headers.get('content-range') ?? '';
    return cr.includes('/') ? parseInt(cr.split('/').pop() ?? '0', 10) : 0;
  } catch { return 0; }
}

/**
 * Fetch rows from a Supabase table.
 * IMPORTANT: Do NOT encode the select string — PostgREST needs plain commas.
 */
async function fetchRows<T>(table: string, select: string, extraParams: string[] = [], maxRows = 10000): Promise<T[]> {
  let allRows: T[] = [];
  let offset = 0;
  const fetchLimit = 10000; // Ask for chunks of up to 10k at a time
  
  while (allRows.length < maxRows) {
    const currentLimit = Math.min(fetchLimit, maxRows - allRows.length);
    const params = [`select=${select}`, `limit=${currentLimit}`, `offset=${offset}`, ...extraParams];
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params.join('&')}`;
    try {
      const res = await fetch(url, { headers: ANON_HEADERS, signal: AbortSignal.timeout(60000) });
      if (!res.ok) {
        console.error(`[Overview] fetchRows failed for ${table}: HTTP ${res.status}`);
        break;
      }
      const chunk: T[] = await res.json();
      if (chunk.length === 0) break; // End of table
      
      allRows = allRows.concat(chunk);
      offset += chunk.length;
      
    } catch (e) {
      console.error(`[Overview] fetchRows error for ${table}:`, e);
      break;
    }
  }
  return allRows;
}

/** Count occurrences of a field value across an array of rows */
function tally<T extends Record<string, any>>(
  rows: T[], key: string, fallback = 'Unknown'
): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  rows.forEach(r => {
    const k = (r[key] as string | null)?.trim() || fallback;
    counts[k] = (counts[k] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Returns the last N calendar days as YYYY-MM-DD strings */
function lastNDays(n = 14): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().split('T')[0];
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string; value: number | string; icon: React.ReactNode;
  gradient?: string; sub?: string;
}> = ({ label, value, icon, sub }) => (
  // Glacier StatCard: surface card, muted label, metric figure, accent-tinted icon tile
  <div className="bg-surface border border-stroke-card shadow-card rounded-xl p-5 flex items-start justify-between gap-3 min-w-0">
    <div className="min-w-0">
      <p className="text-sm font-medium text-fg-muted truncate">{label}</p>
      <p className="metric text-fg mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs text-fg-subtle mt-1 truncate">{sub}</p>}
    </div>
    <div className="w-9 h-9 bg-accent-subtle-2 text-accent-text rounded-lg flex items-center justify-center shrink-0 [&_svg]:text-accent-text">
      {icon}
    </div>
  </div>
);

const ChartCard: React.FC<{
  title: string; subtitle: string; children: React.ReactNode; className?: string;
}> = ({ title, subtitle, children, className = '' }) => (
  <div className={`bg-surface border border-stroke-card rounded-xl p-5 shadow-card ${className}`}>
    <div className="mb-4">
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="text-xs text-fg-subtle mt-0.5">{subtitle}</p>
    </div>
    {children}
  </div>
);

const EmptyState: React.FC<{ height?: string }> = ({ height = 'h-56' }) => (
  <div className={`${height} flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-100 rounded-xl`}>
    <Database size={20} className="text-slate-200" />
    <p className="text-xs text-slate-300 font-medium">No data available</p>
  </div>
);

// ─── Data types ───────────────────────────────────────────────────────────────

interface OverviewData {
  totalJobs: number;
  totalClients: number;
  totalRecruiters: number;
  totalQueueTasks: number;
  totalEmailLogs: number;
  totalActiveAgents: number;

  jobsPerDay: { date: string; jobs: number }[];
  jobsPerSourcePerDay: any[];
  allSources: string[];

  sources: { name: string; value: number }[];
  categories: { name: string; value: number }[];
  employmentTypes: { name: string; value: number }[];
  jobStatus: { name: string; value: number }[];
  clientJobs: { name: string; jobs: number }[];
  topCompanies: { name: string; value: number }[];
  topLocations: { name: string; value: number }[];
  workersActivity: { name: string; value: number }[];
  queueStatus: { name: string; value: number; fill?: string }[];
  recruiterStatus: { name: string; value: number }[];
}

type NameValue = { name: string; value: number };

/** Shape returned by public.overview_stats() (see the overview_stats migration). */
interface OverviewStats {
  totals: { jobs: number; clients: number; recruiters: number; queue_tasks: number; email_logs: number; active_agents: number };
  per_day: { day: string; source: string; n: number }[];
  sources: NameValue[]; categories: NameValue[]; employment_types: NameValue[]; job_status: NameValue[];
  locations: NameValue[]; companies: NameValue[]; workers: NameValue[]; clients: NameValue[];
  queue_status: NameValue[]; recruiter_status: NameValue[];
}

const QUEUE_COLORS: Record<string, string> = {
  Pending: '#E0A100', Running: '#1E70A7', Completed: '#39A05E', Failed: '#C62F2B',
};

function colorQueue(rows: NameValue[]) {
  return rows.map(q => {
    const name = q.name.charAt(0).toUpperCase() + q.name.slice(1);
    return { name, value: q.value, fill: QUEUE_COLORS[name] ?? '#6E848F' };
  });
}

function buildSeries(days: string[], perDay: { day: string; source: string; n: number }[]) {
  const total: Record<string, number> = Object.fromEntries(days.map(d => [d, 0]));
  const bySource: Record<string, Record<string, number>> = {};
  perDay.forEach(({ day, source, n }) => {
    if (!(day in total)) return;
    total[day] += n;
    (bySource[source] ??= Object.fromEntries(days.map(d => [d, 0])))[day] += n;
  });
  const allSources = Object.keys(bySource);
  return {
    jobsPerDay: days.map(d => ({ date: d.slice(5), jobs: total[d] })),
    allSources,
    jobsPerSourcePerDay: days.map(d => {
      const row: any = { date: d.slice(5) };
      allSources.forEach(src => { row[src] = bySource[src][d]; });
      return row;
    }),
  };
}

function fromStats(st: OverviewStats): OverviewData {
  return {
    totalJobs: st.totals.jobs,
    totalClients: st.totals.clients,
    totalRecruiters: st.totals.recruiters,
    totalQueueTasks: st.totals.queue_tasks,
    totalEmailLogs: st.totals.email_logs,
    totalActiveAgents: st.totals.active_agents,
    ...buildSeries(lastNDays(14), st.per_day || []),
    sources: st.sources || [],
    categories: st.categories || [],
    employmentTypes: st.employment_types || [],
    jobStatus: st.job_status || [],
    clientJobs: (st.clients || []).map(c => ({ name: c.name, jobs: c.value })),
    topCompanies: st.companies || [],
    topLocations: st.locations || [],
    workersActivity: st.workers || [],
    queueStatus: colorQueue(st.queue_status || []),
    recruiterStatus: st.recruiter_status || [],
  };
}

const EMPTY_DATA: OverviewData = {
  totalJobs: 0, totalClients: 0, totalRecruiters: 0, totalQueueTasks: 0, totalEmailLogs: 0, totalActiveAgents: 0,
  jobsPerDay: [], jobsPerSourcePerDay: [], allSources: [], sources: [], categories: [], employmentTypes: [],
  jobStatus: [], clientJobs: [], topCompanies: [], topLocations: [], workersActivity: [], queueStatus: [], recruiterStatus: [],
};

/** Rows sampled by the slow fallback, used only until overview_stats() is installed. */
const FALLBACK_SAMPLE = 1000;

// ─── Main Component ───────────────────────────────────────────────────────────

export const OverviewTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  // 'full' = exact numbers from overview_stats(); 'sample' = fallback charts from recent rows
  const [chartSource, setChartSource] = useState<'full' | 'sample' | 'loading'>('full');

  const CACHE_KEY = 'rs_overview_data';
  const CACHE_TIME_KEY = 'rs_overview_time';
  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  const saveCache = (payload: OverviewData, source: 'full' | 'sample') => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      localStorage.setItem(CACHE_KEY + '_source', source);
      localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
    } catch { /* storage full or blocked: the page still works without a cache */ }
  };

  const fetchAndCacheData = useCallback(async (isBackgroundSync = false) => {
    if (!isBackgroundSync) setLoading(true);
    setError(null);
    try {
      // ── Fast path: one aggregate call (a few KB) ─────────────────────────
      const stats = await supabaseClient.callUserRpc<OverviewStats>('overview_stats');
      if (!stats.error && stats.data?.totals) {
        const payload = fromStats(stats.data);
        setData(payload);
        setChartSource('full');
        saveCache(payload, 'full');
        return;
      }
      // Expected until the overview_stats migration is applied; not an error
      console.info('[Overview] overview_stats() not installed yet, using the sampled fallback.');

      // ── Fallback: counts first (fast), then charts from a recent sample ──
      const [
        totalJobs,
        totalClients,
        totalRecruiters,
        totalQueueTasks,
        totalEmailLogs,
        totalActiveAgents,
      ] = await Promise.all([
        fetchCount('jobs'),
        fetchCount('clients'),
        fetchCount('Recruiters'),
        fetchCount('BulkQueue'),
        fetchCount('email_logs'),
        fetchCount('ActiveAgents'),
      ]);

      // Show the stat cards straight away; charts follow when the sample arrives
      setData(prev => ({
        ...(prev ?? EMPTY_DATA),
        totalJobs, totalClients, totalRecruiters, totalQueueTasks, totalEmailLogs, totalActiveAgents,
      }));
      setChartSource('loading');
      if (!isBackgroundSync) setLoading(false);

      const [jobRows, recruiterRows, queueRows] = await Promise.all([
        fetchRows<any>('jobs', 'source,category,employmenttype,status,location,company,client,extractedat,worker_id', ['order=extractedat.desc.nullslast'], FALLBACK_SAMPLE),
        fetchRows<any>('Recruiters', 'status', [], 2000),
        fetchRows<any>('BulkQueue', 'status', [], 1000),
      ]);

      // ── Time-series ───────────────────────────────────────────────────────
      const days = lastNDays(14);
      const daySet = new Set(days);
      const dayCountAll: Record<string, number> = {};
      days.forEach(d => { dayCountAll[d] = 0; });

      const srcDayMap: Record<string, Record<string, number>> = {};
      const uniqueSourcesSet = new Set<string>();

      jobRows.forEach((r: any) => {
        const d = r.extractedat?.split('T')[0];
        if (d && daySet.has(d)) {
          dayCountAll[d] = (dayCountAll[d] || 0) + 1;
          if (r.source) {
            uniqueSourcesSet.add(r.source);
            if (!srcDayMap[r.source]) {
              srcDayMap[r.source] = {};
              days.forEach(day => { srcDayMap[r.source][day] = 0; });
            }
            srcDayMap[r.source][d] = (srcDayMap[r.source][d] || 0) + 1;
          }
        }
      });

      const jobsPerDay = days.map(d => ({ date: d.slice(5), jobs: dayCountAll[d] }));
      const allSources = Array.from(uniqueSourcesSet);

      const jobsPerSourcePerDay: any[] = days.map(d => {
        const obj: any = { date: d.slice(5) };
        allSources.forEach(src => { obj[src] = srcDayMap[src]?.[d] ?? 0; });
        return obj;
      });

      // ── Tally helpers ─────────────────────────────────────────────────────
      const top = (arr: { name: string; value: number }[], n = 10) =>
        arr.sort((a, b) => b.value - a.value).slice(0, n);

      const sources = top(tally(jobRows, 'source'), 12);
      const categories = top(tally(jobRows, 'category'), 20);
      const employmentTypes = top(tally(jobRows, 'employmenttype'), 15);
      const jobStatus = tally(jobRows, 'status');
      const topLocations = top(tally(jobRows, 'location'), 10);
      const topCompanies = top(tally(jobRows, 'company'), 10);
      const workersActivity = top(tally(jobRows, 'worker_id'), 12);

      // Jobs per client
      const clientJobs = top(
        tally(jobRows, 'client').map(({ name, value }) => ({ name, jobs: value } as any)),
        15
      ).map((r: any) => ({ name: r.name, jobs: r.jobs ?? r.value }));

      // Recruiter status
      const recruiterStatus = tally(recruiterRows, 'status');

      const queueStatus = colorQueue(tally(queueRows, 'status'));

      const payload: OverviewData = {
        totalJobs,
        totalClients,
        totalRecruiters,
        totalQueueTasks,
        totalEmailLogs,
        totalActiveAgents,
        jobsPerDay,
        jobsPerSourcePerDay,
        allSources,
        sources,
        categories,
        employmentTypes,
        jobStatus,
        clientJobs,
        topCompanies,
        topLocations,
        workersActivity,
        queueStatus,
        recruiterStatus,
      };

      setData(payload);
      setChartSource('sample');
      saveCache(payload, 'sample');
    } catch (err) {
      console.error('[Overview] Fatal error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics.');
    } finally {
      if (!isBackgroundSync) setLoading(false);
    }
  }, []);


  useEffect(() => {
    let interval: NodeJS.Timeout;

    const init = async () => {
      // Show the last result instantly (any age), then refresh in the background if stale
      let cached: OverviewData | null = null;
      let cacheTime = 0;
      try {
        cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        cacheTime = Number(localStorage.getItem(CACHE_TIME_KEY) || 0);
      } catch { /* no usable cache */ }

      if (cached) {
        setData({ ...EMPTY_DATA, ...cached });
        try { setChartSource(localStorage.getItem(CACHE_KEY + '_source') === 'sample' ? 'sample' : 'full'); } catch { /* ignore */ }
        setLoading(false);
        if (Date.now() - cacheTime >= CACHE_DURATION) fetchAndCacheData(true);
      } else {
        fetchAndCacheData(false);
      }
      
      // Set up periodic sync every 10 minutes (background fetch)
      interval = setInterval(() => {
        fetchAndCacheData(true);
      }, CACHE_DURATION);
    };

    init();

    return () => clearInterval(interval);
  }, [fetchAndCacheData]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-6 pb-10 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded-md"></div>
          <div className="h-3 w-64 bg-slate-100 rounded-md"></div>
        </div>
        <div className="h-8 w-28 bg-slate-200 rounded-xl"></div>
      </div>

      {/* Stat Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-slate-200/60 rounded-xl p-4 flex items-center justify-between h-[84px]">
            <div className="space-y-2 w-full">
              <div className="h-2 w-16 bg-slate-300/50 rounded-sm"></div>
              <div className="h-5 w-12 bg-slate-300/60 rounded-md"></div>
            </div>
            <div className="w-10 h-10 bg-slate-300/50 rounded-xl shrink-0 ml-2"></div>
          </div>
        ))}
      </div>

      {/* Row 1 Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm h-[290px] flex flex-col">
            <div className="mb-4 space-y-2">
              <div className="h-4 w-32 bg-slate-200 rounded-md"></div>
              <div className="h-2.5 w-48 bg-slate-100 rounded-md"></div>
            </div>
            <div className="flex-1 w-full bg-slate-50/50 rounded-xl border border-slate-100"></div>
          </div>
        ))}
      </div>

      {/* Row 2 Skeleton (Categories) */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm h-[320px] flex flex-col">
        <div className="mb-4 space-y-2">
          <div className="h-4 w-32 bg-slate-200 rounded-md"></div>
          <div className="h-2.5 w-48 bg-slate-100 rounded-md"></div>
        </div>
        <div className="flex-1 w-full bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col gap-3 justify-center p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 w-full">
              <div className="h-3 w-20 bg-slate-200 rounded-sm shrink-0"></div>
              <div className="h-4 bg-slate-100 rounded-r-md" style={{ width: `${Math.max(20, 100 - i * 15)}%` }}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !data) return (
    <div className="bg-red-50 p-5 rounded-2xl border border-red-200 flex gap-3 items-start">
      <AlertCircle className="text-red-500 w-5 h-5 mt-0.5 shrink-0" />
      <div>
        <p className="font-bold text-sm text-red-700">Failed to load analytics</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
        <button onClick={() => fetchAndCacheData(false)} className="mt-3 text-xs font-semibold bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors">Retry</button>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">

      {showBanner && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-xl flex items-start justify-between shadow-sm">
          <div className="text-xs leading-relaxed">
            Live RecruitScout data from all your tables. 
            <span className="ml-1 font-medium text-blue-700">Tip: switch between light and dark themes with the button in the top bar.</span>
          </div>
          <button onClick={() => setShowBanner(false)} className="text-blue-500 hover:text-blue-700 font-bold ml-4 text-sm" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-fg">Overview analytics</h2>
          <p className="text-sm text-fg-muted mt-0.5">
            {data.totalJobs.toLocaleString()} jobs · {data.allSources.length} {data.allSources.length === 1 ? 'source' : 'sources'} in the last 14 days
          </p>
          {chartSource !== 'full' && (
            <p className="text-xs text-warning-fg mt-1 flex items-center gap-1.5">
              {chartSource === 'loading' && <Loader2 size={12} className="animate-spin" />}
              {chartSource === 'loading'
                ? 'Charts are loading from a sample of recent jobs.'
                : `Charts show the latest ${FALLBACK_SAMPLE.toLocaleString()} jobs. Apply the overview_stats migration for exact numbers in about a second.`}
            </p>
          )}
        </div>
        <button onClick={() => fetchAndCacheData(true)} className="btn-secondary shrink-0">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total jobs" value={data.totalJobs} icon={<Briefcase className="text-white w-4 h-4" />} sub="jobs table" />
        <StatCard label="Clients" value={data.totalClients} icon={<Users className="text-white w-4 h-4" />} sub="clients table" />
        <StatCard label="Recruiters" value={data.totalRecruiters} icon={<UserCheck className="text-white w-4 h-4" />} sub="Recruiters table" />
        <StatCard label="Queue tasks" value={data.totalQueueTasks} icon={<Database className="text-white w-4 h-4" />} sub="BulkQueue" />
        <StatCard label="Emails sent" value={data.totalEmailLogs} icon={<Mail className="text-white w-4 h-4" />} sub="email_logs" />
        <StatCard label="Active agents" value={data.totalActiveAgents} icon={<Zap className="text-white w-4 h-4" />} sub="ActiveAgents" />
      </div>

      {/* ── Row 1: Total Jobs/Day + Multi-source Line ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <ChartCard title="Daily extraction volume" subtitle="Total jobs collected per day over the last 14 days">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.jobsPerDay} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E70A7" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#1E70A7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={TICK} />
                <YAxis axisLine={false} tickLine={false} tick={TICK} />
                <RTooltip {...TT} />
                <Area type="monotone" dataKey="jobs" stroke="#1E70A7" strokeWidth={2.5} fill="url(#areaGreen)" name="Jobs" dot={false} activeDot={{ r: 5, fill: '#1E70A7', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Jobs per source, last 14 days" subtitle="One line per job board">
          {data.allSources.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.jobsPerSourcePerDay} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={TICK} />
                  <YAxis axisLine={false} tickLine={false} tick={TICK} />
                  <RTooltip {...TT} />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                  {data.allSources.map((src, i) => (
                    <Line key={src} type="monotone" dataKey={src} stroke={SOURCE_LINE_COLORS[i % SOURCE_LINE_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      {/* ── Categories — full width horizontal bar ── */}
      <ChartCard title="Job categories" subtitle={`${data.categories.length} categories · source: category column in the jobs table`}>
        {data.categories.length > 0 ? (
          <div style={{ height: Math.max(260, data.categories.length * 38) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categories} layout="vertical" margin={{ top: 0, right: 70, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={TICK} />
                <YAxis type="category" dataKey="name" width={210} axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 11, fontWeight: 500 }} />
                <RTooltip {...TT} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Jobs" label={{ position: 'right', fill: '#6E848F', fontSize: 11 }}>
                  {data.categories.map((_, i) => (
                    <Cell key={i} fill={[
                      '#1E70A7','#2A9C96','#7A5CFA','#B27F00','#39A05E',
                      '#D56237','#E0A100','#2A9C96','#7A5CFA','#39A05E',
                      '#4590C8','#B23F09','#0B7A75','#6840E7',
                    ][i % 14]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyState />}
      </ChartCard>

      {/* ── Sources donut + Employment Types ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        <ChartCard title="All job sources" subtitle={`${data.sources.length} sites found across all jobs`}>
          {data.sources.length > 0 ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.sources} cx="50%" cy="42%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value">
                    {data.sources.map((_, i) => <Cell key={i} fill={SOURCE_LINE_COLORS[i % SOURCE_LINE_COLORS.length]} />)}
                  </Pie>
                  <RTooltip {...TT} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} layout="horizontal" verticalAlign="bottom" align="center" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Employment types" subtitle="Contract type breakdown from the employmenttype column">
          {data.employmentTypes.length > 0 ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.employmentTypes} margin={{ top: 4, right: 4, left: -20, bottom: 36 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ ...TICK, fontSize: 9 }} angle={-40} textAnchor="end" height={55} />
                  <YAxis axisLine={false} tickLine={false} tick={TICK} />
                  <RTooltip {...TT} />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]} name="Jobs">
                    {data.employmentTypes.map((_, i) => <Cell key={i} fill={PALETTE.teal[i % PALETTE.teal.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartCard>
      </div>

      {/* ── Row 3: Jobs per Client + Top Companies ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <ChartCard title="Jobs per client" subtitle="Jobs in the jobs table grouped by their client field value">
          {data.clientJobs.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.clientJobs} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={TICK} />
                  <YAxis type="category" dataKey="name" width={110} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} />
                  <RTooltip {...TT} />
                  <Bar dataKey="jobs" radius={[0, 5, 5, 0]} name="Jobs">
                    {data.clientJobs.map((_, i) => <Cell key={i} fill={PALETTE.indigo[i % PALETTE.indigo.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState height="h-72" />}
        </ChartCard>

        <ChartCard title="Top 10 companies" subtitle="Companies with the most job listings in the database">
          {data.topCompanies.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topCompanies} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={TICK} />
                  <YAxis type="category" dataKey="name" width={120} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} />
                  <RTooltip {...TT} />
                  <Bar dataKey="value" radius={[0, 5, 5, 0]} name="Jobs">
                    {data.topCompanies.map((_, i) => <Cell key={i} fill={PALETTE.rose[i % PALETTE.rose.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState height="h-72" />}
        </ChartCard>
      </div>

      {/* ── Row 4: Top Locations + Job Status + Worker Activity ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        <ChartCard title="Top job locations" subtitle="Cities and regions with the most postings">
          {data.topLocations.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topLocations.slice(0, 8)} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={TICK} />
                  <YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
                  <RTooltip {...TT} />
                  <Bar dataKey="value" radius={[0, 5, 5, 0]} name="Jobs">
                    {data.topLocations.map((_, i) => <Cell key={i} fill={PALETTE.amber[i % PALETTE.amber.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState height="h-64" />}
        </ChartCard>

        <ChartCard title="Job status breakdown" subtitle="Status field distribution across all jobs">
          {data.jobStatus.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.jobStatus} cx="50%" cy="42%" innerRadius={50} outerRadius={82} paddingAngle={3} dataKey="value">
                    {data.jobStatus.map((_, i) => <Cell key={i} fill={PALETTE.pink[i % PALETTE.pink.length]} />)}
                  </Pie>
                  <RTooltip {...TT} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} layout="horizontal" verticalAlign="bottom" align="center" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState height="h-64" />}
        </ChartCard>

        <ChartCard title="Worker node activity" subtitle="Jobs scraped per extension worker ID">
          {data.workersActivity.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.workersActivity} margin={{ top: 4, right: 4, left: -20, bottom: 36 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ ...TICK, fontSize: 9 }} angle={-35} textAnchor="end" height={50} />
                  <YAxis axisLine={false} tickLine={false} tick={TICK} />
                  <RTooltip {...TT} />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]} name="Jobs">
                    {data.workersActivity.map((_, i) => <Cell key={i} fill={PALETTE.cyan[i % PALETTE.cyan.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState height="h-64" />}
        </ChartCard>
      </div>

      {/* ── Row 5: Queue Status radial + Recruiter Status ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        <ChartCard title="BulkQueue task status" subtitle="Breakdown of all BulkQueue tasks by status">
          {data.queueStatus.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="55%" innerRadius="20%" outerRadius="90%" data={data.queueStatus} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" label={{ position: 'insideStart', fill: '#fff', fontSize: 10, fontWeight: 700 }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} layout="horizontal" verticalAlign="bottom" align="center" />
                  <RTooltip {...TT} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartCard>

        <ChartCard title="Recruiter status distribution" subtitle="All recruiters from the recruiters table grouped by status">
          {data.recruiterStatus.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.recruiterStatus} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={TICK} />
                  <YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} />
                  <RTooltip {...TT} />
                  <Bar dataKey="value" radius={[0, 5, 5, 0]} name="Recruiters">
                    {data.recruiterStatus.map((_, i) => <Cell key={i} fill={PALETTE.orange[i % PALETTE.orange.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState />}
        </ChartCard>
      </div>

    </div>
  );
};
