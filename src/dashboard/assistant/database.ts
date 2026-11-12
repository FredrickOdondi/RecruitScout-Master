import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../shared/supabase';

/**
 * Direct, schema-checked access to RecruitScout's database for the Assistant.
 *
 * The live schema comes from PostgREST's OpenAPI document, so new tables and
 * columns are picked up without code changes. Every table and column name the
 * model sends is checked against that schema before it goes into a URL, and
 * every value is URL-encoded, so nothing the model writes can change the query
 * shape. Writes are filter-based and always go through the approval gate in
 * executeTool.ts.
 */

/** Tables outside RecruitScout's operations (credentials, personal study apps). */
const HIDDEN_TABLES = new Set([
  'user_integrations',
  'study_notes', 'study_pdfs', 'daily_study_logs', 'clinical_retention_logs', 'notifications',
]);

/** Tables the Assistant may change in bulk. Everything else is read-only here. */
export const WRITABLE_TABLES = new Set([
  'Recruiters', 'jobs', 'BulkQueue', 'clients', 'recruiter_contacts', 'RecruiterContact',
  'RecruiterData', 'job_assignments', 'recruiter_grouped_jobs', 'routing_feedback', 'ActiveAgents',
]);

export const FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is', 'not_is'] as const;
export type FilterOp = typeof FILTER_OPS[number];

export interface DbFilter {
  column: string;
  op: FilterOp;
  value?: string;
  values?: string[];
}

export interface TableInfo {
  name: string;
  columns: { name: string; type: string }[];
  writable: boolean;
}

const MAX_ROWS = 200;
const PAGE = 1000;
const MAX_SCAN = 120_000;

let schemaCache: { tables: TableInfo[]; at: number } | null = null;
const SCHEMA_TTL = 10 * 60 * 1000;

const headers = (extra: Record<string, string> = {}) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  ...extra,
});

async function http(path: string, init: RequestInit = {}, timeoutMs = 20000) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = body?.message || body?.hint || body?.details || `HTTP ${res.status}`;
    throw new Error(`Database: ${msg}`);
  }
  const range = res.headers.get('content-range');
  const total = range && range.includes('/') ? parseInt(range.split('/').pop() || '', 10) : NaN;
  return { body, total: Number.isFinite(total) ? total : undefined };
}

export async function getSchema(): Promise<TableInfo[]> {
  if (schemaCache && Date.now() - schemaCache.at < SCHEMA_TTL) return schemaCache.tables;
  const { body } = await http('', { headers: headers({ Accept: 'application/openapi+json' }) });
  const defs: Record<string, any> = body?.definitions || {};
  const tables: TableInfo[] = Object.entries(defs)
    .filter(([name]) => !HIDDEN_TABLES.has(name))
    .map(([name, def]) => ({
      name,
      writable: WRITABLE_TABLES.has(name),
      columns: Object.entries<any>(def.properties || {}).map(([col, p]) => ({
        name: col,
        type: String(p.format || p.type || 'unknown'),
      })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  schemaCache = { tables, at: Date.now() };
  return tables;
}

async function table(name: string): Promise<TableInfo> {
  const tables = await getSchema();
  const t = tables.find((x) => x.name === name) || tables.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!t) throw new Error(`There is no table "${name}". Tables: ${tables.map((x) => x.name).join(', ')}.`);
  return t;
}

function column(t: TableInfo, name: string): string {
  const c = t.columns.find((x) => x.name === name) || t.columns.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!c) throw new Error(`Table ${t.name} has no column "${name}". Columns: ${t.columns.map((x) => x.name).join(', ')}.`);
  return c.name;
}

/** Quote a column for PostgREST when it has spaces or punctuation. */
const q = (col: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(col) ? col : `"${col.replace(/"/g, '')}"`);
/** Quote a value inside in.(...) lists. */
const qv = (v: string) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function filterParams(t: TableInfo, filters: DbFilter[] = []): string[] {
  return filters.map((f) => {
    const col = encodeURIComponent(q(column(t, f.column)));
    const v = f.value ?? '';
    switch (f.op) {
      case 'in': {
        const vals = f.values?.length ? f.values : v.split(',').map((s) => s.trim()).filter(Boolean);
        if (!vals.length) throw new Error(`Filter "in" on ${f.column} needs values.`);
        return `${col}=in.${encodeURIComponent(`(${vals.map(qv).join(',')})`)}`;
      }
      case 'is':
      case 'not_is': {
        const lv = v.toLowerCase();
        if (!['null', 'true', 'false'].includes(lv)) throw new Error(`Filter "${f.op}" takes null, true or false.`);
        return `${col}=${f.op === 'is' ? 'is' : 'not.is'}.${lv}`;
      }
      case 'like':
      case 'ilike': {
        const pattern = v.includes('%') || v.includes('*') ? v.replace(/%/g, '*') : `*${v}*`;
        return `${col}=${f.op}.${encodeURIComponent(pattern)}`;
      }
      default:
        return `${col}=${f.op}.${encodeURIComponent(v)}`;
    }
  });
}

export interface QueryArgs {
  table: string;
  columns?: string[];
  filters?: DbFilter[];
  order_by?: string;
  descending?: boolean;
  limit?: number;
  offset?: number;
  count_only?: boolean;
}

export async function queryRows(a: QueryArgs): Promise<{ table: string; total?: number; rows: any[]; columns: string[] }> {
  const t = await table(a.table);
  const cols = a.columns?.length ? a.columns.map((c) => column(t, c)) : t.columns.map((c) => c.name);
  const params = filterParams(t, a.filters);
  if (a.count_only) {
    const { total } = await http(`${encodeURIComponent(t.name)}?${['select=' + encodeURIComponent(q(cols[0] || 'id')), ...params, 'limit=1'].join('&')}`, {
      headers: headers({ Prefer: 'count=exact' }),
    });
    return { table: t.name, total, rows: [], columns: [] };
  }
  const limit = Math.min(Math.max(1, a.limit || 50), MAX_ROWS);
  const parts = [
    'select=' + cols.map((c) => encodeURIComponent(q(c))).join(','),
    ...params,
    ...(a.order_by ? [`order=${encodeURIComponent(q(column(t, a.order_by)))}.${a.descending ? 'desc' : 'asc'}.nullslast`] : []),
    `limit=${limit}`,
    `offset=${Math.max(0, a.offset || 0)}`,
  ];
  const { body, total } = await http(`${encodeURIComponent(t.name)}?${parts.join('&')}`, {
    headers: headers({ Prefer: 'count=exact' }),
  });
  return { table: t.name, total, rows: Array.isArray(body) ? body : [], columns: cols };
}

/** Group counts for one column, e.g. recruiters by status. Scans up to MAX_SCAN rows. */
export async function countBy(a: { table: string; column: string; filters?: DbFilter[]; top?: number }) {
  const t = await table(a.table);
  const col = column(t, a.column);
  const params = filterParams(t, a.filters);
  const base = `${encodeURIComponent(t.name)}?${['select=' + encodeURIComponent(q(col)), ...params].join('&')}`;
  const first = await http(`${base}&limit=${PAGE}&offset=0`, { headers: headers({ Prefer: 'count=exact' }) }, 30000);
  const total = first.total ?? (first.body?.length || 0);
  const scanned = Math.min(total, MAX_SCAN);
  const offsets: number[] = [];
  for (let o = PAGE; o < scanned; o += PAGE) offsets.push(o);
  const pages: any[][] = [first.body || []];
  for (let i = 0; i < offsets.length; i += 8) {
    const batch = await Promise.all(offsets.slice(i, i + 8).map((o) => http(`${base}&limit=${PAGE}&offset=${o}`, { headers: headers() }, 30000)));
    pages.push(...batch.map((b) => b.body || []));
  }
  const counts = new Map<string, number>();
  for (const page of pages) for (const r of page) {
    const v = r[col];
    const key = v === null || v === undefined || v === '' ? '(empty)' : String(v);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const groups = [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([value, count]) => ({ value, count }));
  return {
    table: t.name, column: col, total, scanned,
    groups: groups.slice(0, a.top || 50),
    distinct_values: groups.length,
    partial: total > MAX_SCAN,
  };
}

async function ensureWritable(name: string, filters: DbFilter[] | undefined) {
  const t = await table(name);
  if (!t.writable) throw new Error(`${t.name} can't be changed from the Assistant. Writable tables: ${[...WRITABLE_TABLES].join(', ')}.`);
  if (!filters?.length) throw new Error('Give at least one filter, so a change never hits a whole table by accident.');
  return t;
}

/** How many rows a filter matches, for approval cards. */
export async function countMatching(tableName: string, filters: DbFilter[]): Promise<number | undefined> {
  return (await queryRows({ table: tableName, filters, count_only: true })).total;
}

export async function updateRows(a: { table: string; filters: DbFilter[]; updates: Record<string, unknown> }) {
  const t = await ensureWritable(a.table, a.filters);
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a.updates || {})) body[column(t, k)] = v;
  if (!Object.keys(body).length) throw new Error('Nothing to change: updates is empty.');
  const key = t.columns.some((c) => c.name === 'id') ? 'id' : t.columns[0].name;
  const { body: rows } = await http(`${encodeURIComponent(t.name)}?${[...filterParams(t, a.filters), `select=${encodeURIComponent(q(key))}`].join('&')}`, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(body),
  }, 60000);
  return { table: t.name, updated: Array.isArray(rows) ? rows.length : 0 };
}

export async function deleteRows(a: { table: string; filters: DbFilter[] }) {
  const t = await ensureWritable(a.table, a.filters);
  const key = t.columns.some((c) => c.name === 'id') ? 'id' : t.columns[0].name;
  const { body: rows } = await http(`${encodeURIComponent(t.name)}?${[...filterParams(t, a.filters), `select=${encodeURIComponent(q(key))}`].join('&')}`, {
    method: 'DELETE',
    headers: headers({ Prefer: 'return=representation' }),
  }, 60000);
  return { table: t.name, deleted: Array.isArray(rows) ? rows.length : 0 };
}

export async function insertRows(a: { table: string; rows: Record<string, unknown>[] }) {
  const t = await table(a.table);
  if (!t.writable) throw new Error(`${t.name} can't be changed from the Assistant.`);
  const rows = a.rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) out[column(t, k)] = v;
    return out;
  });
  const { body } = await http(encodeURIComponent(t.name), {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(rows),
  }, 60000);
  return { table: t.name, inserted: Array.isArray(body) ? body.length : 0, rows: Array.isArray(body) ? body.slice(0, 20) : [] };
}

/** Plain-language filter text for approval cards. */
export function describeFilters(filters: DbFilter[] = []): string {
  const opText: Record<FilterOp, string> = {
    eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', like: 'contains', ilike: 'contains', in: 'is one of', is: 'is', not_is: 'is not',
  };
  return filters.map((f) => `${f.column} ${opText[f.op]} ${f.op === 'in' ? (f.values || [f.value]).join(', ') : f.value}`).join(' and ');
}
