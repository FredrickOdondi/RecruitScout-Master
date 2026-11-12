import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { supabaseClient } from '../shared/supabase';

/** One row from public.list_indeed_sessions(). No cookie or token values. */
interface IndeedSessionRow {
  id: string;
  account_label: string | null;
  user_email: string | null;
  status: string;
  leased_by: string | null;
  leased_until: string | null;
  last_used_at: string | null;
  error_count: number | null;
  last_error_message: string | null;
  updated_at: string | null;
  cookie_count: number;
  login_cookie_expires_at: string | null;
}

type Health = 'in-use' | 'ready' | 'retrying' | 'blocked' | 'expired' | 'no-login' | 'other';

const REFRESH_MS = 15000;

function getHealth(s: IndeedSessionRow, now: number): Health {
  if (s.status === 'blocked') return 'blocked';
  if (s.status !== 'active') return 'other';
  if (!s.login_cookie_expires_at) return 'no-login';
  if (new Date(s.login_cookie_expires_at).getTime() < now) return 'expired';
  if (s.leased_until && new Date(s.leased_until).getTime() > now) return 'in-use';
  if ((s.error_count ?? 0) > 0) return 'retrying';
  return 'ready';
}

const HEALTH_BADGE: Record<Health, { label: string; className: string }> = {
  'in-use':   { label: 'In use',         className: 'badge-success' },
  ready:      { label: 'Ready',          className: 'bg-neutral-badge text-fg-muted' },
  retrying:   { label: 'Errors',         className: 'badge-warning' },
  blocked:    { label: 'Blocked',        className: 'badge-error' },
  expired:    { label: 'Expired',        className: 'badge-error' },
  'no-login': { label: 'Not signed in',  className: 'badge-warning' },
  other:      { label: '',               className: 'bg-neutral-badge text-fg-muted' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso: string | null, now: number): string {
  if (!iso) return 'Never';
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return formatDate(iso);
}

const StatCard: React.FC<{ label: string; value: number; note: string }> = ({ label, value, note }) => (
  <div className="bg-surface border border-stroke-card shadow-card rounded-xl p-5 min-w-0">
    <p className="text-sm font-medium text-fg-muted">{label}</p>
    <p className="metric text-fg mt-1">{value}</p>
    <p className="text-xs text-fg-subtle mt-1 truncate">{note}</p>
  </div>
);

export default function IndeedSessionsTab() {
  const [rows, setRows] = useState<IndeedSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [lastLoaded, setLastLoaded] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await supabaseClient.callUserRpc<IndeedSessionRow[]>('list_indeed_sessions');
    setNow(Date.now());
    if (res.error) {
      setError(res.error);
    } else {
      setError(null);
      setRows(res.data || []);
      setLastLoaded(Date.now());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const withHealth = useMemo(() => rows.map(r => ({ row: r, health: getHealth(r, now) })), [rows, now]);
  const count = (h: Health[]) => withHealth.filter(x => h.includes(x.health)).length;
  const inUse = withHealth.filter(x => x.health === 'in-use');

  async function act(row: IndeedSessionRow, action: 'reactivate' | 'release') {
    const name = row.account_label || row.user_email || row.id.slice(0, 8);
    const ok = action === 'reactivate'
      ? confirm(`Reactivate ${name}?\n\nIt goes back into rotation and its error count resets.`)
      : confirm(`Release ${name} from ${row.leased_by}?\n\nIf that agent is still running, it keeps these cookies until its next task.`);
    if (!ok) return;

    setBusyId(row.id);
    const res = await supabaseClient.callUserRpc(
      action === 'reactivate' ? 'reactivate_indeed_session' : 'force_release_indeed_session',
      { p_session_id: row.id },
    );
    setBusyId(null);
    if (res.error) {
      alert(`Couldn't ${action === 'reactivate' ? 'reactivate' : 'release'} ${name}. ${res.error}`);
      return;
    }
    load();
  }

  const accessHint = error && /not authorised|42501/i.test(error)
    ? 'Sign in to the dashboard again.'
    : error && /could not find the function|PGRST202|404/i.test(error)
      ? 'The Indeed session functions aren\'t on the database yet. Apply the two Indeed session migrations.'
      : error;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Title + subtitle, primary action on the right */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-fg-muted">
            {inUse.length > 0
              ? `${inUse.map(x => `${x.row.account_label || 'Account'} in use by ${x.row.leased_by}`).join(' · ')}`
              : 'No account is in use right now'}
            {lastLoaded && <span className="text-fg-subtle"> · updated {formatTime(new Date(lastLoaded).toISOString())}</span>}
          </p>
        </div>
        <button onClick={() => { setLoading(true); load(); }} className="btn-secondary" disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Refresh
        </button>
      </div>

      {accessHint && (
        <div className="bg-danger-bg text-danger-fg text-sm rounded-md px-3 py-2.5">
          Indeed accounts didn't load. {accessHint}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="In use" value={count(['in-use'])} note="Leased by an agent now" />
        <StatCard label="Ready" value={count(['ready', 'retrying'])} note="Free to be picked up" />
        <StatCard label="Blocked" value={count(['blocked'])} note="Blocked 3 times in a row" />
        <StatCard label="Dead" value={count(['expired', 'no-login', 'other'])} note="Expired or not signed in" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-stroke-card">
                <th className="px-4 h-10 font-medium">Account</th>
                <th className="px-4 h-10 font-medium">Status</th>
                <th className="px-4 h-10 font-medium">Agent</th>
                <th className="px-4 h-10 font-medium">Last used</th>
                <th className="px-4 h-10 font-medium text-right">Errors</th>
                <th className="px-4 h-10 font-medium">Last error</th>
                <th className="px-4 h-10 font-medium">Sign-in expires</th>
                <th className="px-4 h-10 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-fg-subtle">Loading Indeed accounts…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-fg-subtle">
                  {error ? 'Accounts show here once they load.' : 'No Indeed accounts in indeed_scraper_sessions.'}
                </td></tr>
              ) : withHealth.map(({ row, health }) => {
                const badge = HEALTH_BADGE[health];
                const label = health === 'other' ? row.status : health === 'retrying' ? `${row.error_count} error${row.error_count === 1 ? '' : 's'}` : badge.label;
                return (
                  <tr key={row.id} className="border-b border-stroke-divider last:border-b-0 h-10 hover:bg-hover">
                    <td className="px-4 py-2">
                      <div className="font-medium text-fg">{row.account_label || 'Unnamed account'}</div>
                      <div className="text-xs text-fg-subtle">
                        {row.user_email || '—'} · <span className="mono-id">{row.id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`badge ${badge.className}`} title={health === 'no-login' ? `Only ${row.cookie_count} cookies saved, none of them sign-in cookies` : undefined}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {health === 'in-use' ? (
                        <>
                          <div className="mono-id text-fg">{row.leased_by}</div>
                          <div className="text-xs text-fg-subtle">Lease ends {formatTime(row.leased_until)}</div>
                        </>
                      ) : <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-fg-muted" title={row.last_used_at || undefined}>{timeAgo(row.last_used_at, now)}</td>
                    <td className="px-4 py-2 text-right tabular">{row.error_count ?? 0}</td>
                    <td className="px-4 py-2 max-w-[260px]">
                      <span className="block truncate text-fg-muted" title={row.last_error_message || undefined}>{row.last_error_message || '—'}</span>
                    </td>
                    <td className={`px-4 py-2 whitespace-nowrap ${health === 'expired' ? 'text-danger-fg' : 'text-fg-muted'}`}>
                      {row.login_cookie_expires_at ? formatDate(row.login_cookie_expires_at) : 'No sign-in cookies'}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {(health === 'blocked' || health === 'retrying') && (
                        <button className="btn-secondary" disabled={busyId === row.id} onClick={() => act(row, 'reactivate')}>
                          Reactivate
                        </button>
                      )}
                      {health === 'in-use' && (
                        <button className="btn-ghost" disabled={busyId === row.id} onClick={() => act(row, 'release')}>
                          Release
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-fg-subtle">
        Refreshes every 15 seconds. "Dead" accounts need fresh cookies: sign in to Indeed with that account, export its cookies and save them to its row in indeed_scraper_sessions.
      </p>
    </div>
  );
}
