import React, { useEffect, useState, useCallback } from 'react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/supabase';
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

const PALETTE = {
  emerald:  ['#059669','#10b981','#34d399','#6ee7b7','#a7f3d0'],
  violet:   ['#7c3aed','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe'],
  sky:      ['#0284c7','#0ea5e9','#38bdf8','#7dd3fc','#bae6fd'],
  rose:     ['#be123c','#e11d48','#fb7185','#fda4af','#fecdd3'],
  amber:    ['#b45309','#d97706','#f59e0b','#fbbf24','#fde68a'],
  indigo:   ['#4338ca','#4f46e5','#6366f1','#818cf8','#a5b4fc'],
  teal:     ['#0f766e','#0d9488','#14b8a6','#2dd4bf','#99f6e4'],
  pink:     ['#be185d','#db2777','#ec4899','#f472b6','#fbcfe8'],
  orange:   ['#c2410c','#ea580c','#f97316','#fb923c','#fdba74'],
  cyan:     ['#0e7490','#0891b2','#06b6d4','#22d3ee','#a5f3fc'],
};

const SOURCE_LINE_COLORS = ['#10b981','#6366f1','#f59e0b','#e11d48','#06b6d4','#f97316','#8b5cf6','#ec4899'];
const CHART_GRID = '#f1f5f9';
const TICK = { fill: '#94a3b8', fontSize: 10 };

const TT = {
  contentStyle: {
    background: '#0f172a',
    border: 'none',
    borderRadius: '10px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    fontSize: '11px',
    color: '#f8fafc',
    padding: '10px 14px',
  },
  labelStyle: { color: '#94a3b8', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: '#f8fafc' },
  cursor: { fill: 'rgba(148,163,184,0.06)' },
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
  gradient: string; sub?: string;
}> = ({ label, value, icon, gradient, sub }) => (
  <div className={`${gradient} rounded-xl p-4 flex items-center justify-between relative overflow-hidden group hover:scale-[1.02] transition-transform duration-200 cursor-default`}>
    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle at 80% 20%, white, transparent 70%)' }} />
    <div className="relative min-w-0">
      <p className="text-[10px] font-extrabold text-white/70 uppercase tracking-widest mb-1 truncate">{label}</p>
      <h3 className="text-2xl font-black text-white tracking-tighter leading-none">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </h3>
      {sub && <p className="text-[10px] text-white/55 mt-1">{sub}</p>}
    </div>
    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-white/30 transition-colors ml-2">
      {icon}
    </div>
  </div>
);

const ChartCard: React.FC<{
  title: string; subtitle: string; children: React.ReactNode; className?: string;
}> = ({ title, subtitle, children, className = '' }) => (
  <div className={`bg-white border border-slate-100 rounded-2xl p-5 shadow-sm ${className}`}>
    <div className="mb-4 pb-3 border-b border-slate-50">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export const OverviewTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  const CACHE_KEY = 'rs_overview_data';
  const CACHE_TIME_KEY = 'rs_overview_time';
  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  const fetchAndCacheData = useCallback(async (isBackgroundSync = false) => {
    if (!isBackgroundSync) setLoading(true);
    setError(null);
    try {
      // ── Parallel fetches ──────────────────────────────────────────────────
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

      // Fetch rows needed for charts (limit to keep it fast)
      const [jobRows, recruiterRows, queueRows] = await Promise.all([
        fetchRows<any>('jobs', 'source,category,employmenttype,status,location,company,client,extractedat,worker_id', [], 50000),
        fetchRows<any>('Recruiters', 'status', [], 10000),
        fetchRows<any>('BulkQueue', 'status', [], 10000),
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

      // Queue status with colors
      const QCOLORS: Record<string, string> = {
        Pending: '#f59e0b', Running: '#3b82f6', Completed: '#059669', Failed: '#ef4444',
      };
      const queueStatus = tally(queueRows, 'status').map(q => {
        const name = q.name.charAt(0).toUpperCase() + q.name.slice(1);
        return { name, value: q.value, fill: QCOLORS[name] ?? '#94a3b8' };
      });

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

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [CACHE_KEY]: payload, [CACHE_TIME_KEY]: Date.now() });
      }
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
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([CACHE_KEY, CACHE_TIME_KEY], (res) => {
          const cachedData = res[CACHE_KEY];
          const cacheTime = res[CACHE_TIME_KEY] || 0;
          
          if (cachedData && (Date.now() - cacheTime < CACHE_DURATION)) {
            // Use cache, no loading spinner needed
            setData(cachedData);
            setLoading(false);
          } else {
            // Cache expired or missing, fetch fresh data
            fetchAndCacheData(false);
          }
        });
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
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200 px-4 py-3 rounded-xl flex items-start justify-between shadow-sm">
          <div className="text-xs leading-relaxed">
            <span className="font-bold">Notice:</span> This dashboard displays live RecruitScout data across all your tables. 
            <span className="ml-1 font-medium text-blue-700 dark:text-blue-300">Tip: You can switch between <strong>Obsidian Dark</strong> theme and <strong>Light Mode</strong> anytime using the toggle button in the top-right header!</span>
          </div>
          <button onClick={() => setShowBanner(false)} className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 font-bold ml-4 text-sm">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Overview Analytics</h2>
          <p className="text-xs text-slate-400 mt-1">
            Live data · {data.totalJobs.toLocaleString()} jobs · {data.allSources.length} sources: {data.allSources.join(', ')}
          </p>
        </div>
        <button onClick={() => fetchAndCacheData(false)} className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all shadow-sm">
          <RefreshCw size={12} /> Refresh All
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Jobs" value={data.totalJobs} icon={<Briefcase className="text-white w-4 h-4" />} gradient="bg-gradient-to-br from-emerald-500 to-teal-600" sub="jobs table" />
        <StatCard label="Clients" value={data.totalClients} icon={<Users className="text-white w-4 h-4" />} gradient="bg-gradient-to-br from-violet-500 to-purple-700" sub="clients table" />
        <StatCard label="Recruiters" value={data.totalRecruiters} icon={<UserCheck className="text-white w-4 h-4" />} gradient="bg-gradient-to-br from-sky-500 to-blue-700" sub="Recruiters table" />
        <StatCard label="Queue Tasks" value={data.totalQueueTasks} icon={<Database className="text-white w-4 h-4" />} gradient="bg-gradient-to-br from-amber-500 to-orange-600" sub="BulkQueue" />
        <StatCard label="Emails Sent" value={data.totalEmailLogs} icon={<Mail className="text-white w-4 h-4" />} gradient="bg-gradient-to-br from-rose-500 to-pink-700" sub="email_logs" />
        <StatCard label="Active Agents" value={data.totalActiveAgents} icon={<Zap className="text-white w-4 h-4" />} gradient="bg-gradient-to-br from-cyan-500 to-indigo-600" sub="ActiveAgents" />
      </div>

      {/* ── Row 1: Total Jobs/Day + Multi-source Line ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <ChartCard title="Daily Extraction Volume" subtitle="Total jobs collected per day over the last 14 days">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.jobsPerDay} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={TICK} />
                <YAxis axisLine={false} tickLine={false} tick={TICK} />
                <RTooltip {...TT} />
                <Area type="monotone" dataKey="jobs" stroke="#10b981" strokeWidth={2.5} fill="url(#areaGreen)" name="Jobs" dot={false} activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title={`Jobs per Source · Last 14 Days (${data.allSources.length} sources)`} subtitle="One line per job board — shows individual extraction activity over time">
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
      <ChartCard title="Job Categories" subtitle={`${data.categories.length} categories · source: category column in the jobs table`}>
        {data.categories.length > 0 ? (
          <div style={{ height: Math.max(260, data.categories.length * 38) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categories} layout="vertical" margin={{ top: 0, right: 70, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={TICK} />
                <YAxis type="category" dataKey="name" width={210} axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 11, fontWeight: 500 }} />
                <RTooltip {...TT} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Jobs" label={{ position: 'right', fill: '#94a3b8', fontSize: 11 }}>
                  {data.categories.map((_, i) => (
                    <Cell key={i} fill={[
                      '#7c3aed','#6366f1','#0ea5e9','#059669','#f59e0b',
                      '#e11d48','#f97316','#06b6d4','#8b5cf6','#10b981',
                      '#3b82f6','#ec4899','#14b8a6','#a855f7',
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

        <ChartCard title="All Job Sources" subtitle={`${data.sources.length} sites found across all jobs`}>
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

        <ChartCard title="Employment Types" subtitle="Contract type breakdown from the employmenttype column">
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

        <ChartCard title="Jobs per Client" subtitle="Jobs in the jobs table grouped by their client field value">
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

        <ChartCard title="Top 10 Companies" subtitle="Companies with the most job listings in the database">
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

        <ChartCard title="Top Job Locations" subtitle="Cities and regions with the most postings">
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

        <ChartCard title="Job Status Breakdown" subtitle="Status field distribution across all jobs">
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

        <ChartCard title="Worker Node Activity" subtitle="Jobs scraped per extension worker ID">
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

        <ChartCard title="BulkQueue Task Status" subtitle="Breakdown of all BulkQueue tasks by status">
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

        <ChartCard title="Recruiter Status Distribution" subtitle="All recruiters from the Recruiters table grouped by status">
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
