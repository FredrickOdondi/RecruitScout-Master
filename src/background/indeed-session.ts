/**
 * Indeed session manager for queue (swarm) scraping.
 *
 * Leases one of your Indeed accounts from public.indeed_scraper_sessions
 * (through the claim/renew/report/release RPCs), loads its cookies into the
 * browser before the scraper tab opens Indeed, and rotates to the next free
 * account when a page gets blocked.
 *
 * Chrome cookies are shared by the whole browser profile, so applying a
 * session signs that profile into the scraper account. The service worker
 * only calls this in remote polling (swarm) mode.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/supabase';

/** Calls one of the indeed session functions in Supabase. */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `RPC ${fn} failed: HTTP ${res.status}`);
  return data as T;
}

const LEASE_STORAGE_KEY = 'recruitscout_indeed_lease';
const LEASE_MINUTES = 30;
const INDEED_COOKIE_DOMAIN = 'indeed.com';

/** One cookie as exported by chrome.cookies.getAll / Cookie-Editor. */
interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  hostOnly?: boolean;
  session?: boolean;
  sameSite?: string;
  expirationDate?: number;
}

interface ClaimedSession {
  id: string;
  account_label: string | null;
  cookies_payload: unknown;
  leased_until: string;
}

interface ActiveLease {
  id: string;
  label: string | null;
  workerId: string;
}

export interface IndeedSessionStatus {
  active: boolean;
  label: string | null;
}

let currentLease: ActiveLease | null = null;
let leaseLoaded = false;

async function loadLease(): Promise<ActiveLease | null> {
  if (!leaseLoaded) {
    const stored = await chrome.storage.local.get(LEASE_STORAGE_KEY);
    currentLease = (stored[LEASE_STORAGE_KEY] as ActiveLease | undefined) ?? null;
    leaseLoaded = true;
  }
  return currentLease;
}

async function saveLease(lease: ActiveLease | null): Promise<void> {
  currentLease = lease;
  leaseLoaded = true;
  if (lease) {
    await chrome.storage.local.set({ [LEASE_STORAGE_KEY]: lease });
  } else {
    await chrome.storage.local.remove(LEASE_STORAGE_KEY);
  }
}

// ── Cookie handling ──────────────────────────────────────────────────────────

/** Accepts either a JSON array of cookie objects or a "a=b; c=d" header string. */
function parseCookiesPayload(payload: unknown): StoredCookie[] {
  let value = payload;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try { value = JSON.parse(trimmed); } catch { return []; }
    } else {
      return trimmed
        .split(';')
        .map(part => part.trim())
        .filter(part => part.includes('='))
        .map(part => {
          const eq = part.indexOf('=');
          return { name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim(), domain: `.${INDEED_COOKIE_DOMAIN}` };
        });
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is StoredCookie =>
    !!c && typeof c === 'object' && typeof c.name === 'string' && typeof c.value === 'string' && typeof c.domain === 'string'
  );
}

function isIndeedDomain(domain: string): boolean {
  const host = domain.replace(/^\./, '').toLowerCase();
  return host === INDEED_COOKIE_DOMAIN || host.endsWith(`.${INDEED_COOKIE_DOMAIN}`);
}

function toSameSite(value: string | undefined, secure: boolean): chrome.cookies.SameSiteStatus {
  switch (value) {
    case 'no_restriction':
      // Chrome rejects SameSite=None without Secure
      return secure ? 'no_restriction' : 'unspecified';
    case 'lax':
    case 'strict':
      return value;
    default:
      return 'unspecified';
  }
}

/** Cloudflare clearance cookies belong to this browser, not to an account — keep them. */
function isCloudflareCookie(name: string): boolean {
  return name.startsWith('cf_') || name.startsWith('__cf');
}

/** Removes the indeed.com account cookies from the default cookie store. */
export async function clearIndeedCookies(): Promise<number> {
  const existing = (await chrome.cookies.getAll({ domain: INDEED_COOKIE_DOMAIN }))
    .filter(c => !isCloudflareCookie(c.name));
  await Promise.all(existing.map(c => {
    const host = c.domain.replace(/^\./, '');
    return chrome.cookies.remove({ url: `https://${host}${c.path || '/'}`, name: c.name, storeId: c.storeId })
      .catch(() => null);
  }));
  return existing.length;
}

async function applyCookies(cookies: StoredCookie[]): Promise<{ applied: number; skipped: number }> {
  const now = Date.now() / 1000;
  let applied = 0;
  let skipped = 0;

  for (const c of cookies) {
    if (!isIndeedDomain(c.domain) || isCloudflareCookie(c.name)) { skipped++; continue; }
    if (!c.session && c.expirationDate && c.expirationDate < now) { skipped++; continue; }

    const host = c.domain.replace(/^\./, '');
    const path = c.path || '/';
    const isPrefixed = c.name.startsWith('__Secure-') || c.name.startsWith('__Host-');
    const secure = !!c.secure || isPrefixed;

    const details: chrome.cookies.SetDetails = {
      url: `https://${host}${path}`,
      name: c.name,
      value: c.value,
      path,
      secure,
      httpOnly: !!c.httpOnly,
      sameSite: toSameSite(c.sameSite, secure),
    };
    // Host-only and __Host- cookies must not carry a Domain attribute
    if (!c.hostOnly && !c.name.startsWith('__Host-')) details.domain = c.domain;
    if (!c.session && c.expirationDate) details.expirationDate = c.expirationDate;

    try {
      const result = await chrome.cookies.set(details);
      if (result) applied++; else skipped++;
    } catch {
      skipped++;
    }
  }
  return { applied, skipped };
}

// ── Lease lifecycle ──────────────────────────────────────────────────────────

async function claimAndApply(workerId: string, exclude?: string): Promise<boolean> {
  const rows = await rpc<ClaimedSession[]>('claim_indeed_session', {
    p_worker_id: workerId,
    p_lease_minutes: LEASE_MINUTES,
    p_exclude: exclude ?? null,
  });

  const hadLease = !!(await loadLease());
  const claimed = Array.isArray(rows) ? rows[0] : null;

  // Only touch the profile's cookies when we are swapping accounts, so a
  // machine that never got a session keeps its owner's own Indeed login.
  if (claimed || hadLease) await clearIndeedCookies();

  if (!claimed) {
    await saveLease(null);
    console.warn('[RecruitScout Indeed Session] No free Indeed session — scraping logged out.');
    return false;
  }

  const cookies = parseCookiesPayload(claimed.cookies_payload);
  const { applied, skipped } = await applyCookies(cookies);
  await saveLease({ id: claimed.id, label: claimed.account_label, workerId });
  console.log(`[RecruitScout Indeed Session] Using "${claimed.account_label || claimed.id.slice(0, 8)}": ${applied} cookies set, ${skipped} skipped.`);
  return applied > 0;
}

/**
 * Makes sure this worker holds a session before a task: renews the current
 * lease, or claims a new one if there is none or it was lost.
 */
export async function ensureIndeedSession(workerId: string): Promise<boolean> {
  try {
    const lease = await loadLease();
    if (lease && lease.workerId === workerId) {
      const renewed = await rpc<boolean>('renew_indeed_session', {
        p_session_id: lease.id,
        p_worker_id: workerId,
        p_lease_minutes: LEASE_MINUTES,
      });
      if (renewed) return true;
    }
    return await claimAndApply(workerId);
  } catch (err: any) {
    console.warn('[RecruitScout Indeed Session] Could not prepare a session:', err?.message || err);
    return false;
  }
}

/** Marks the current session as healthy and extends its lease after a task. */
export async function markIndeedSessionHealthy(): Promise<void> {
  const lease = await loadLease();
  if (!lease) return;
  try {
    await rpc<boolean>('renew_indeed_session', {
      p_session_id: lease.id,
      p_worker_id: lease.workerId,
      p_lease_minutes: LEASE_MINUTES,
    });
  } catch (err: any) {
    console.warn('[RecruitScout Indeed Session] Renew failed:', err?.message || err);
  }
}

/**
 * Reports the current session as blocked and switches to the next free one.
 * Returns false when there is no session to rotate from or none is free.
 */
export async function rotateIndeedSession(reason: string): Promise<boolean> {
  const lease = await loadLease();
  if (!lease) return false;

  try {
    await rpc<null>('report_indeed_session_error', {
      p_session_id: lease.id,
      p_worker_id: lease.workerId,
      p_message: reason,
    });
  } catch (err: any) {
    console.warn('[RecruitScout Indeed Session] Could not report block:', err?.message || err);
  }

  try {
    return await claimAndApply(lease.workerId, lease.id);
  } catch (err: any) {
    console.warn('[RecruitScout Indeed Session] Rotation failed — scraping logged out:', err?.message || err);
    await clearIndeedCookies();
    await saveLease(null);
    return false;
  }
}

/** Gives the lease back and removes the account's cookies from the browser. */
export async function releaseIndeedSession(): Promise<void> {
  const lease = await loadLease();
  if (!lease) return;

  try {
    await rpc<null>('release_indeed_session', { p_worker_id: lease.workerId });
  } catch (err: any) {
    console.warn('[RecruitScout Indeed Session] Release failed (lease will expire on its own):', err?.message || err);
  }
  await clearIndeedCookies();
  await saveLease(null);
  console.log('[RecruitScout Indeed Session] Session released and Indeed cookies cleared.');
}

export async function getIndeedSessionStatus(): Promise<IndeedSessionStatus> {
  const lease = await loadLease();
  return { active: !!lease, label: lease?.label ?? null };
}
