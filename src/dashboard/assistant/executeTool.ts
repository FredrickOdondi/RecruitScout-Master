import { supabaseClient } from '../../shared/supabase';
import { BlueCcClient } from '../../shared/bluecc';
import { MessageType, type JobData } from '../../shared/types';
import { storage } from '../../shared/storage';
import { specialtyMatches, generateLeadEmail, type LeadJob } from '../../shared/leadEmail';
import { CSVExporter } from '../../lib/export/csv-exporter';
import { JSONExporter } from '../../lib/export/json-exporter';
import { XLSXExporter } from '../../lib/export/xlsx-exporter';
import { APPROVAL_RISKS, getToolDef } from './tools';
import { approvalKey, validateArgs } from './validate';
import type { ApprovalPreview, ToolContext, ToolResult, ToolView } from './types';

const ok = (data: unknown, summary?: string, view?: ToolView): ToolResult => ({ ok: true, data, summary, view });
const fail = (error: string): ToolResult => ({ ok: false, error });

/** The recruiter columns matching and drafting read (the full table is ~34 MB). */
const LEAD_RECRUITER_COLUMNS = [
  'id', 'Name', 'Agency Name', 'status', 'Country', 'Location', 'Primary Specialty',
  'Associated contacts', 'Total leads sent', 'Teaser Threshold', 'Leads Sent before Teaser Mode',
  'Daily Sending Limit',
];
const LEAD_JOB_COLUMNS = 'id,title,company,location,url,category';

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

async function getBlueClient(userId: string): Promise<BlueCcClient | null> {
  const res = await supabaseClient.getUserIntegration(userId);
  if (!res.data?.bluecc_token_id || !res.data?.bluecc_secret_id) return null;
  return new BlueCcClient(res.data.bluecc_token_id, res.data.bluecc_secret_id, res.data.bluecc_company_id || undefined);
}

async function bridge<T = any>(ctx: ToolContext, message: any): Promise<{ data?: T; error?: string }> {
  try {
    const data = await ctx.bridgeSendMessage<T>(message);
    if (data === null || data === undefined) {
      return { error: 'The RecruitScout extension did not answer. Open the dashboard in Chrome with the extension installed.' };
    }
    return { data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'The RecruitScout extension is not reachable.' };
  }
}

const queueCounts = (rows: any[]) => ({
  pending: rows.filter((r) => r.status === 'pending').length,
  running: rows.filter((r) => r.status === 'running').length,
  completed: rows.filter((r) => r.status === 'completed').length,
  failed: rows.filter((r) => r.status === 'failed').length,
});

/** Lead matching, using the same rules as the Leads flow tab. */
async function matchRecruiters() {
  const [jobsRes, recsRes, logsRes] = await Promise.all([
    supabaseClient.getCategorizedJobs(LEAD_JOB_COLUMNS),
    supabaseClient.getRecruiters(undefined, false, LEAD_RECRUITER_COLUMNS),
    supabaseClient.getAllEmailLogs(),
  ]);
  if (jobsRes.error) throw new Error(jobsRes.error);
  if (recsRes.error) throw new Error(recsRes.error);
  const jobs = (jobsRes.data || []) as unknown as LeadJob[];
  const sent = new Map<string, Set<string>>();
  for (const log of logsRes.data || []) {
    const set = sent.get(String(log.recruiter_id)) || new Set<string>();
    for (const j of log.matched_jobs || []) if (j?.id) set.add(String(j.id));
    sent.set(String(log.recruiter_id), set);
  }
  const groups: { recruiter: any; jobs: LeadJob[] }[] = [];
  for (const rec of recsRes.data || []) {
    const status = String(rec.status || '').toLowerCase();
    if (['suspended', 'blacklisted', 'pending'].includes(status)) continue;
    const specialty = rec['Primary Specialty']?.trim();
    if (!specialty) continue;
    const country = rec['Country']?.trim().toLowerCase();
    const location = rec['Location']?.trim().toLowerCase();
    const key = String(rec.id || rec['Agency Name'] || rec['Name']);
    const already = sent.get(key) || new Set<string>();
    const matched = jobs.filter((job) => {
      if (already.has(String(job.id))) return false;
      if (!specialtyMatches(specialty, job.category?.trim() || '')) return false;
      if (!country && !location) return true;
      const loc = (job.location || '').toLowerCase();
      return (country ? loc.includes(country) : false) || (location ? loc.includes(location) : false);
    });
    if (matched.length < 3) continue;
    const limit = Math.min(rec['Daily Sending Limit'] ?? 5, 5);
    groups.push({ recruiter: rec, jobs: matched.slice(0, limit) });
  }
  return groups;
}

/** Cloud job row → the shape the file exporters expect. */
function toJobData(j: any): JobData {
  return {
    id: j.id, title: j.title, company: j.company, companyDomain: j.companydomain || undefined,
    location: j.location || '', employmentType: j.employmenttype || undefined, url: j.url,
    datePosted: j.dateposted || undefined, source: j.source, extractedAt: j.extractedat,
    status: j.status || undefined, description: j.description || undefined,
    salary: j.salary ? { raw: j.salary } : undefined, client: j.client || undefined,
    category: j.category || undefined,
  } as unknown as JobData;
}

/**
 * What the approval card shows for a risky call. Built from the validated
 * arguments, so the user approves exactly what will run.
 */
function previewFor(name: string, a: Record<string, any>): ApprovalPreview {
  const list = (ids: string[] = []) => ids.slice(0, 10).concat(ids.length > 10 ? [`and ${ids.length - 10} more`] : []);
  switch (name) {
    case 'delete_queue_tasks': return { summary: `Delete ${plural(a.ids.length, 'queue task')}. This can't be undone.`, details: list(a.ids) };
    case 'delete_jobs': return { summary: `Delete ${plural(a.ids.length, 'job')} from the cloud. This can't be undone.`, details: list(a.ids) };
    case 'bulk_update_queue_tasks': {
      const changes = ['status', 'target_site', 'client_id'].filter((k) => a[k] !== undefined).map((k) => `${k} → ${a[k]}`);
      return { summary: `Change ${plural(a.ids.length, 'queue task')}.`, details: [...changes, ...list(a.ids)] };
    }
    case 'reset_queue': return { summary: 'Set every completed, failed and stuck queue task back to pending. Agents will run them again.' };
    case 'apply_queue_location': return { summary: `Set the location of every queue task to "${a.location}".` };
    case 'start_engine': return { summary: 'Turn on swarm polling in this browser and start the next pending task.' };
    case 'start_bulk_search': return { summary: `Start a bulk search in this browser now for ${plural(a.titles.length, 'title')}${a.location ? ` in ${a.location}` : ''}.`, details: a.titles.slice(0, 12) };
    case 'pause_engine': return { summary: 'Pause extraction in this browser.' };
    case 'stop_engine': return { summary: 'Stop extraction in this browser and turn swarm polling off.' };
    case 'force_poll_queue': return { summary: 'Make this browser claim and run the next pending queue task now.' };
    case 'update_settings': return { summary: 'Change this browser\'s engine settings.', details: Object.entries(a).map(([k, v]) => `${k} → ${v}`) };
    case 'sync_local_jobs_to_cloud': return { summary: 'Upload every job stored in this browser to the cloud jobs table.' };
    case 'delete_client': return { summary: `Delete client ${a.id}. Jobs already in its sheet stay.` };
    case 'sync_jobs_to_sheets': return { summary: `Send up to ${a.limit || 200} jobs for "${a.client_name}" to their Google Sheet.` };
    case 'bulk_update_recruiters': return { summary: `Set ${a.field} to "${a.value}" on every recruiter.` };
    case 'sync_recruiter_contacts': return { summary: 'Copy contact emails from RecruiterContact into every matching recruiter.' };
    case 'send_lead_email': return {
      summary: `Email ${a.to}: "${a.subject}".`,
      details: (a.matched_jobs || []).map((j: any) => `${j.title}${j.company ? ` · ${j.company}` : ''}`).slice(0, 10),
    };
    case 'set_email_schedule': return { summary: a.enabled ? 'Turn on automatic lead emails with this schedule.' : 'Change the automatic email schedule.', details: Object.entries(a).map(([k, v]) => `${k} → ${Array.isArray(v) ? v.join(', ') : v}`) };
    case 'archive_blue_workspace': return { summary: `Archive Blue.cc workspace ${a.project_id}.` };
    case 'invite_blue_user': return { summary: `Invite ${a.email} to Blue.cc workspace ${a.project_id}.` };
    case 'remove_blue_user': return { summary: `Remove user ${a.user_id} from Blue.cc workspace ${a.project_id}.` };
    default: return { summary: `Run ${name}.`, details: Object.entries(a).map(([k, v]) => `${k} → ${JSON.stringify(v)}`) };
  }
}

/**
 * Run one tool. Risky tools (APPROVAL_RISKS) only run when ctx.approval holds
 * the key for these exact arguments; that key is created only by the UI's
 * Approve button. Anything the model sends cannot satisfy the gate.
 */
export async function executeTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  const def = getToolDef(name);
  if (!def) return fail(`There is no tool called "${name}".`);

  const checked = validateArgs(def.parameters, rawArgs);
  if ('error' in checked) return fail(checked.error);
  const args = checked.args;

  if (APPROVAL_RISKS.has(def.risk) && ctx.approval?.key !== approvalKey(name, args)) {
    return { ok: false, needsApproval: true, preview: previewFor(name, args) };
  }

  try {
    switch (name) {
      // ── Overview ─────────────────────────────────────────────────────────
      case 'get_overview_stats': {
        const res = await supabaseClient.callUserRpc<any>('overview_stats');
        if (res.error) return fail(res.error);
        const t = res.data?.totals || {};
        return ok(res.data, 'Read the platform overview', {
          kind: 'stats',
          items: [
            { label: 'Jobs', value: (t.jobs ?? 0).toLocaleString() },
            { label: 'Clients', value: t.clients ?? 0 },
            { label: 'Recruiters', value: (t.recruiters ?? 0).toLocaleString() },
            { label: 'Queue tasks', value: t.queue_tasks ?? 0 },
            { label: 'Emails sent', value: t.email_logs ?? 0 },
            { label: 'Agents', value: t.active_agents ?? 0 },
          ],
        });
      }

      case 'diagnose_swarm': {
        const [queueRes, agentsRes, sessionsRes, settings, counts] = await Promise.all([
          supabaseClient.getQueueStatus(),
          supabaseClient.getActiveAgents(),
          supabaseClient.callUserRpc<any[]>('list_indeed_sessions'),
          bridge(ctx, { type: MessageType.GET_SETTINGS }),
          supabaseClient.getQueueCounts(),
        ]);
        const queue = queueCounts(queueRes.data || []);
        const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
        const agents = agentsRes.data || [];
        const recent = agents.filter((a: any) => a.last_ping && Date.now() - new Date(a.last_ping).getTime() < 5 * 60 * 1000);
        return ok({
          queue: { ...queue, pending_total: counts.pending, running_total: counts.running },
          agents: { total: agents.length, seen_last_5_min: recent.length, recent: recent.map((a: any) => a.worker_id || a.id) },
          indeed: {
            total: sessions.length,
            active: sessions.filter((s: any) => s.status === 'active').length,
            blocked: sessions.filter((s: any) => s.status === 'blocked').length,
            leased: sessions.filter((s: any) => s.leased_until && new Date(s.leased_until) > new Date()).length,
          },
          this_browser: settings.error
            ? { extension: settings.error }
            : { pollingEnabled: settings.data?.pollingEnabled, worker: settings.data?.friendName, indeedCookieMode: settings.data?.indeedCookieMode ?? 'stored' },
        }, 'Checked the swarm', {
          kind: 'stats',
          items: [
            { label: 'Pending', value: counts.pending, tone: counts.pending ? 'warning' : 'neutral' },
            { label: 'Running', value: counts.running },
            { label: 'Agents online', value: recent.length, tone: recent.length ? 'success' : 'danger' },
            { label: 'Indeed blocked', value: sessions.filter((s: any) => s.status === 'blocked').length },
          ],
        });
      }

      case 'open_dashboard_view': {
        if (!ctx.navigate) return fail('Navigation is not available here.');
        ctx.navigate(args.view);
        return ok({ opened: args.view }, `Opened ${args.view}`);
      }

      // ── Queue ────────────────────────────────────────────────────────────
      case 'get_queue_counts': {
        const c = await supabaseClient.getQueueCounts();
        return ok(c, `${c.pending} pending, ${c.running} running`);
      }

      case 'get_queue': {
        const res = await supabaseClient.getQueueStatus();
        if (res.error) return fail(res.error);
        let rows = res.data || [];
        const counts = queueCounts(rows);
        if (args.status) rows = rows.filter((r: any) => r.status === args.status);
        const offset = args.offset || 0;
        const page = rows.slice(offset, offset + (args.limit || 50));
        return ok({ total: rows.length, offset, counts, tasks: page }, `Listed ${plural(page.length, 'task')}`, {
          kind: 'table',
          columns: ['Title', 'Location', 'Site', 'Status', 'Worker'],
          rows: page.slice(0, 12).map((r: any) => [r.job_title || '(all jobs)', r.location || '', r.target_site || '', r.status, r.assigned_to || '']),
          total: rows.length,
        });
      }

      case 'enqueue_tasks': {
        const titles: string[] = (args.titles || []).map((t: string) => t.trim()).filter(Boolean);
        if (!titles.length && !args.location) return fail('Give at least one job title or a location.');
        const res = await supabaseClient.enqueueTasks(
          titles.length ? titles : [''], args.assigned_to, args.location, args.client_id, args.target_site || 'indeed', args.date_filter,
        );
        if (res.error) return fail(res.error);
        const n = res.data?.inserted ?? titles.length;
        return ok({ inserted: n }, `Queued ${plural(n, 'task')}`);
      }

      case 'update_queue_task': {
        const { id, ...updates } = args;
        if (!Object.keys(updates).length) return fail('Nothing to change.');
        const res = await supabaseClient.updateQueueTask(id, updates);
        if (res.error) return fail(res.error);
        return ok({ id, updates }, 'Updated a queue task');
      }

      case 'bulk_update_queue_tasks': {
        const { ids, ...updates } = args;
        if (!Object.keys(updates).length) return fail('Nothing to change.');
        let failed = 0;
        for (const id of ids) if ((await supabaseClient.updateQueueTask(id, updates)).error) failed++;
        return ok({ updated: ids.length - failed, failed }, `Updated ${plural(ids.length - failed, 'task')}`);
      }

      case 'delete_queue_tasks': {
        const results = [];
        for (const id of args.ids) {
          const res = await supabaseClient.deleteQueueTask(id);
          results.push({ id, ok: !res.error, error: res.error || undefined });
        }
        const done = results.filter((r) => r.ok).length;
        return ok({ results }, `Deleted ${plural(done, 'task')}`);
      }

      case 'reset_queue': {
        const res = await supabaseClient.resetCompletedTasks();
        if (res.error) return fail(res.error);
        return ok(res.data, 'Reset the queue');
      }

      case 'apply_queue_location': {
        const res = await supabaseClient.updateQueueLocation(args.location);
        if (res.error) return fail(res.error);
        return ok(res.data, `Set every task to ${args.location}`);
      }

      // ── Engine ───────────────────────────────────────────────────────────
      case 'get_active_agents': {
        const res = await supabaseClient.getActiveAgents();
        if (res.error) return fail(res.error);
        const rows = res.data || [];
        return ok(rows.slice(0, 50), `Found ${plural(rows.length, 'agent')}`, {
          kind: 'table',
          columns: ['Agent', 'Last check-in'],
          rows: rows.slice(0, 12).map((a: any) => [a.worker_name || a.worker_id || a.id, a.last_ping ? new Date(a.last_ping).toLocaleString('en-GB') : '']),
          total: rows.length,
        });
      }

      case 'get_engine_status': {
        const [state, progress] = await Promise.all([
          bridge(ctx, { type: MessageType.GET_STATE }),
          bridge(ctx, { type: MessageType.GET_PROGRESS }),
        ]);
        if (state.error) return fail(state.error);
        return ok({ state: state.data, progress: progress.data }, `Engine is ${state.data?.status || 'unknown'}`);
      }

      case 'get_settings': {
        const res = await bridge(ctx, { type: MessageType.GET_SETTINGS });
        if (res.error) return fail(res.error);
        return ok(res.data, 'Read engine settings');
      }

      case 'start_engine': {
        const set = await bridge(ctx, { type: MessageType.UPDATE_SETTINGS, payload: { pollingEnabled: true } });
        if (set.error) return fail(set.error);
        const poll = await bridge<any>(ctx, { type: 'FORCE_POLL_QUEUE' });
        if (poll.error) return fail(poll.error);
        return ok(poll.data, poll.data?.foundTask ? 'Started a queue task' : `Engine on; ${poll.data?.reason || 'no pending task'}`);
      }

      case 'start_bulk_search': {
        const res = await bridge(ctx, {
          type: MessageType.START_BULK_EXTRACTION,
          payload: { titles: args.titles, options: { location: args.location, target_site: args.target_site, date_filter: args.date_filter, client_name: args.client_name } },
        });
        if (res.error) return fail(res.error);
        return ok(res.data, `Started a search for ${plural(args.titles.length, 'title')}`);
      }

      case 'pause_engine': {
        const res = await bridge(ctx, { type: MessageType.PAUSE_EXTRACTION });
        if (res.error) return fail(res.error);
        return ok(res.data, 'Paused the engine');
      }

      case 'stop_engine': {
        const res = await bridge(ctx, { type: MessageType.STOP_EXTRACTION });
        if (res.error) return fail(res.error);
        await bridge(ctx, { type: MessageType.UPDATE_SETTINGS, payload: { pollingEnabled: false } });
        return ok({ stopped: true }, 'Stopped the engine');
      }

      case 'force_poll_queue': {
        const res = await bridge<any>(ctx, { type: 'FORCE_POLL_QUEUE' });
        if (res.error) return fail(res.error);
        return ok(res.data, res.data?.foundTask ? 'Claimed a queue task' : `No task started: ${res.data?.reason || 'none pending'}`);
      }

      case 'update_settings': {
        const res = await bridge(ctx, { type: MessageType.UPDATE_SETTINGS, payload: args });
        if (res.error) return fail(res.error);
        return ok({ updated: Object.keys(args) }, `Changed ${plural(Object.keys(args).length, 'setting')}`);
      }

      // ── Jobs ─────────────────────────────────────────────────────────────
      case 'get_job_count': {
        const res = await supabaseClient.getJobCount();
        if (res.error) return fail(res.error);
        return ok(res.data, `${(res.data?.count ?? 0).toLocaleString()} jobs`);
      }

      case 'query_jobs': {
        const res = await supabaseClient.queryJobs({
          search: args.search, source: args.source, client: args.client, workerId: args.worker_id,
          categories: args.category ? [args.category] : undefined, sortBy: args.sort,
          limit: args.limit || 25, offset: args.offset || 0,
        });
        if (res.error) return fail(res.error);
        const jobs = (res.data || []).map((j: any) => ({
          id: j.id, title: j.title, company: j.company, location: j.location, source: j.source,
          client: j.client, category: j.category, status: j.status, url: j.url, extractedat: j.extractedat,
        }));
        return ok({ total: res.total, offset: args.offset || 0, jobs }, `Found ${plural(res.total ?? jobs.length, 'job')}`, {
          kind: 'table',
          columns: ['Title', 'Company', 'Location', 'Source'],
          rows: jobs.slice(0, 12).map((j) => [j.title, j.company, j.location || '', j.source]),
          total: res.total,
        });
      }

      case 'get_local_jobs': {
        const res = await bridge<any[]>(ctx, { type: MessageType.GET_JOBS });
        if (res.error) return fail(res.error);
        const all = res.data || [];
        const offset = args.offset || 0;
        const page = all.slice(offset, offset + (args.limit || 25)).map((j: any) => ({
          id: j.id, title: j.title, company: j.company, location: j.location, source: j.source, client: j.client,
        }));
        return ok({ total: all.length, offset, jobs: page }, `${plural(all.length, 'job')} in this browser`);
      }

      case 'update_job': {
        const res = await bridge(ctx, { type: MessageType.UPDATE_JOB, payload: { id: args.id, updates: args.updates } });
        if (res.error) return fail(res.error);
        return ok({ id: args.id }, 'Updated a job');
      }

      case 'delete_jobs': {
        const res = await supabaseClient.deleteJobs(args.ids);
        if (res.error) return fail(res.error);
        return ok(res.data, `Deleted ${plural(args.ids.length, 'job')}`);
      }

      case 'sync_local_jobs_to_cloud': {
        const res = await bridge<any>(ctx, { type: 'SUPABASE_SYNC_ALL' });
        if (res.error) return fail(res.error);
        return ok(res.data, 'Uploaded browser jobs');
      }

      case 'export_jobs': {
        const limit = args.limit || 1000;
        const rows: any[] = [];
        for (let offset = 0; offset < limit; offset += 500) {
          const res = await supabaseClient.queryJobs({
            search: args.search, source: args.source, client: args.client,
            categories: args.category ? [args.category] : undefined,
            limit: Math.min(500, limit - offset), offset,
          });
          if (res.error) return fail(res.error);
          rows.push(...(res.data || []));
          if ((res.data || []).length < 500) break;
        }
        if (!rows.length) return fail('No jobs match those filters.');
        const jobs = rows.map(toJobData);
        const stamp = new Date().toISOString().slice(0, 10);
        const file = `recruitscout-jobs-${stamp}`;
        if (args.format === 'csv') CSVExporter.download(jobs, `${file}.csv`);
        else if (args.format === 'json') JSONExporter.download(jobs, `${file}.json`);
        else XLSXExporter.download(jobs, `${file}.xls`);
        return ok({ exported: jobs.length, format: args.format }, `Downloaded ${plural(jobs.length, 'job')} as ${args.format.toUpperCase()}`);
      }

      case 'resolve_company_domain': {
        const res = await bridge<any>(ctx, { type: MessageType.RESOLVE_DOMAIN, payload: { companyName: args.company } });
        if (res.error) return fail(res.error);
        return ok(res.data, res.data?.domain ? `${args.company}: ${res.data.domain}` : `No website found for ${args.company}`);
      }

      // ── Clients ──────────────────────────────────────────────────────────
      case 'get_clients': {
        const res = await supabaseClient.getClients();
        if (res.error) return fail(res.error);
        const rows = res.data || [];
        return ok(rows, `${plural(rows.length, 'client')}`, {
          kind: 'table',
          columns: ['Client', 'Sheet', 'Tab', 'Enrolled'],
          rows: rows.map((c: any) => [c.name, c.spreadsheet_id ? 'Connected' : 'None', c.sheet_name || '', c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '']),
        });
      }

      case 'enroll_client': {
        const res = await supabaseClient.enrollClient({
          name: args.name, apps_script_url: args.apps_script_url || '', spreadsheet_id: args.spreadsheet_id || null, sheet_name: args.sheet_name || 'Sheet1',
        });
        if (res.error) return fail(res.error);
        return ok(res.data, `Enrolled ${args.name}`);
      }

      case 'update_client_sheet': {
        const { id, ...updates } = args;
        if (!Object.keys(updates).length) return fail('Nothing to change.');
        const res = await supabaseClient.updateClient(id, updates);
        if (res.error) return fail(res.error);
        return ok(res.data, `Updated ${res.data?.name || 'the client'}`);
      }

      case 'set_active_client': {
        const clients = await supabaseClient.getClients();
        const client = (clients.data || []).find((c: any) => c.name?.toLowerCase() === args.name.toLowerCase());
        if (!client) return fail(`No client called "${args.name}".`);
        const res = await bridge(ctx, { type: MessageType.UPDATE_SETTINGS, payload: { activeClientName: client.name } });
        if (res.error) return fail(res.error);
        return ok({ activeClientName: client.name }, `${client.name} is now the default client`);
      }

      case 'delete_client': {
        const res = await supabaseClient.deleteClient(args.id);
        if (res.error) return fail(res.error);
        return ok(res.data, 'Deleted the client');
      }

      case 'sync_jobs_to_sheets': {
        const clientsRes = await supabaseClient.getClients();
        if (clientsRes.error) return fail(clientsRes.error);
        const client = (clientsRes.data || []).find((c: any) => c.name?.toLowerCase() === args.client_name.toLowerCase());
        if (!client) return fail(`No client called "${args.client_name}".`);
        if (!client.apps_script_url) return fail(`${client.name} has no Apps Script URL. Its sheet syncs automatically while scraping instead.`);
        const jobsRes = await supabaseClient.queryJobs({ client: client.name, limit: args.limit || 200, offset: 0 });
        if (jobsRes.error) return fail(jobsRes.error);
        const jobs = jobsRes.data || [];
        if (!jobs.length) return ok({ synced: 0 }, `No jobs for ${client.name}`);
        const response = await fetch(client.apps_script_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'append', sheetName: client.sheet_name || 'Sheet1', spreadsheetId: client.spreadsheet_id,
            rows: jobs.map((j) => [j.title, j.company, j.companydomain || '', j.location || '', j.employmenttype || '', j.url, j.dateposted || '', j.salary || '', j.source, j.extractedat, j.status || '', j.category || '', j.client || '']),
          }),
          signal: AbortSignal.timeout(120000),
        });
        if (!response.ok) return fail(`Google Sheets returned HTTP ${response.status}.`);
        return ok({ synced: jobs.length }, `Sent ${plural(jobs.length, 'job')} to ${client.name}`);
      }

      // ── Indeed accounts ──────────────────────────────────────────────────
      case 'list_indeed_sessions': {
        const res = await supabaseClient.callUserRpc<any[]>('list_indeed_sessions');
        if (res.error) return fail(res.error);
        const rows = res.data || [];
        return ok(rows, `${plural(rows.length, 'Indeed account')}`, {
          kind: 'table',
          columns: ['Account', 'Status', 'Agent', 'Errors'],
          rows: rows.map((s: any) => [s.account_label || s.id.slice(0, 8), s.status, s.leased_by || '', s.error_count ?? 0]),
        });
      }

      case 'reactivate_indeed_session': {
        const res = await supabaseClient.callUserRpc('reactivate_indeed_session', { p_session_id: args.session_id });
        if (res.error) return fail(res.error);
        return ok({ reactivated: args.session_id }, 'Reactivated the account');
      }

      case 'force_release_indeed_session': {
        const res = await supabaseClient.callUserRpc('force_release_indeed_session', { p_session_id: args.session_id });
        if (res.error) return fail(res.error);
        return ok({ released: args.session_id }, 'Released the account');
      }

      // ── Recruiters and leads ─────────────────────────────────────────────
      case 'get_recruiters': {
        const page = args.page || 1;
        const res = await supabaseClient.getRecruitersPaginated(page, args.page_size || 20, args.search || '', {
          country: args.country, location: args.location, specialty: args.specialty, industry: args.industry,
        });
        if (res.error) return fail(res.error);
        const rows = res.data || [];
        return ok({ total: res.totalCount, page, recruiters: rows }, `Found ${plural(res.totalCount, 'recruiter')}`, {
          kind: 'table',
          columns: ['Agency', 'Specialty', 'Country', 'Status'],
          rows: rows.slice(0, 12).map((r: any) => [r['Agency Name'] || r.Name, r['Primary Specialty'] || '', r.Country || '', r.status || '']),
          total: res.totalCount,
        });
      }

      case 'get_recruiter_countries': {
        const countries = await supabaseClient.getUniqueRecruiterCountries();
        return ok(countries, `${countries.length} ${countries.length === 1 ? 'country' : 'countries'}`);
      }

      case 'get_recruiter_email_history': {
        const res = await supabaseClient.getEmailLogsByRecruiter(args.recruiter_id);
        if (res.error) return fail(res.error);
        const rows = (res.data || []).map((l: any) => ({ sent_at: l.sent_at, to: l.email_address, jobs: (l.matched_jobs || []).length }));
        return ok(rows, `${plural(rows.length, 'email')} sent`);
      }

      case 'update_recruiter': {
        const res = await supabaseClient.updateRecruiter(args.agency_name, args.updates);
        if (res.error) return fail(res.error);
        return ok(res.data, `Updated ${args.agency_name}`);
      }

      case 'set_recruiter_status': {
        const res = await supabaseClient.updateRecruiterStatus(args.agency_name, args.status);
        if (res.error) return fail(res.error);
        return ok(res.data, `${args.agency_name} is now ${args.status}`);
      }

      case 'bulk_update_recruiters': {
        const n = Number(args.value);
        const needsNumber = args.field !== 'status';
        if (needsNumber && Number.isNaN(n)) return fail(`${args.field} needs a number.`);
        const res = args.field === 'status' ? await supabaseClient.updateAllRecruitersStatus(String(args.value))
          : args.field === 'leads_sent' ? await supabaseClient.updateAllRecruitersLeadsSent(n)
          : args.field === 'teaser_threshold' ? await supabaseClient.updateAllRecruitersTeaserThreshold(n)
          : args.field === 'min_leads' ? await supabaseClient.updateAllRecruitersMinLeads(n)
          : await supabaseClient.updateAllRecruitersMaxLeads(n);
        if (res.error) return fail(res.error);
        return ok(res.data, `Set ${args.field} on every recruiter`);
      }

      case 'sync_recruiter_contacts': {
        const res = await supabaseClient.syncRecruiterContactEmails();
        if (res.error) return fail(res.error);
        return ok(res.data, `Synced contacts (${res.data?.updated ?? 0} updated)`);
      }

      case 'match_recruiters_to_jobs': {
        const groups = await matchRecruiters();
        const top = groups.slice(0, args.limit_groups || 20).map((g) => ({
          recruiter_id: String(g.recruiter.id || g.recruiter['Agency Name']),
          agency: g.recruiter['Agency Name'] || g.recruiter.Name,
          specialty: g.recruiter['Primary Specialty'],
          contact: g.recruiter['Associated contacts'] || null,
          jobs: g.jobs.map((j) => ({ id: j.id, title: j.title, company: j.company, location: j.location })),
        }));
        return ok({ total_groups: groups.length, groups: top }, `${plural(groups.length, 'recruiter')} have matches`, {
          kind: 'table',
          columns: ['Agency', 'Specialty', 'Jobs', 'Contact'],
          rows: top.slice(0, 12).map((g) => [g.agency, g.specialty, g.jobs.length, g.contact ? 'Yes' : 'No']),
          total: groups.length,
        });
      }

      case 'draft_lead_email': {
        const groups = await matchRecruiters();
        const g = groups.find((x) => String(x.recruiter['Agency Name'] || x.recruiter.Name).toLowerCase() === args.agency_name.toLowerCase());
        if (!g) return fail(`${args.agency_name} has no unsent matching jobs right now.`);
        const contacts = (await supabaseClient.getRecruiterContacts()).data || [];
        const to = args.to || String(g.recruiter['Associated contacts'] || '').split(/[,;\s]+/)[0] || '';
        const { subject, bodyHtml } = generateLeadEmail(g.recruiter, g.jobs, to || undefined, contacts);
        return ok({
          to, subject, body_html: bodyHtml,
          recruiter_id: String(g.recruiter.id || g.recruiter['Agency Name']),
          recruiter_name: g.recruiter.Name || g.recruiter['Agency Name'],
          matched_jobs: g.jobs.map((j) => ({ id: j.id, title: j.title, company: j.company })),
        }, `Drafted an email to ${g.recruiter['Agency Name'] || g.recruiter.Name}`);
      }

      case 'send_lead_email': {
        const res = await bridge<any>(ctx, { type: MessageType.SEND_GMAIL_MESSAGE, payload: { to: args.to, subject: args.subject, bodyHtml: args.body_html } });
        if (res.error) return fail(res.error);
        if (!res.data?.success) return fail(res.data?.error || 'The email was not sent.');
        if (args.recruiter_id) {
          await supabaseClient.logEmailSent({
            recruiter_id: args.recruiter_id, recruiter_name: args.recruiter_name || '', matched_jobs: args.matched_jobs || [],
            email_content: args.body_html, email_address: args.to,
          });
        }
        return ok({ sent: true, to: args.to }, `Emailed ${args.to}`);
      }

      case 'get_email_schedule': {
        const [config, state] = await Promise.all([storage.getEmailScheduleConfig(), storage.getEmailScheduleState()]);
        return ok({ config, state }, config.enabled ? 'Schedule is on' : 'Schedule is off');
      }

      case 'set_email_schedule': {
        await storage.setEmailScheduleConfig(args);
        const config = await storage.getEmailScheduleConfig();
        return ok(config, config.enabled ? 'Turned the schedule on' : 'Updated the schedule');
      }

      // ── Blue.cc ──────────────────────────────────────────────────────────
      default: {
        if (!name.includes('blue')) return fail(`"${name}" is not implemented.`);
        const blue = await getBlueClient(ctx.userId);
        if (!blue) return fail('Blue.cc is not connected. Add API credentials in the Blue.cc workspaces tab.');
        switch (name) {
          case 'get_blue_workspaces': {
            const ws = await blue.getWorkspaces();
            return ok(ws.map((w: any) => ({ id: w.id, name: w.name, archived: w.archived })), `${plural(ws.length, 'workspace')}`);
          }
          case 'get_blue_workspace_content': {
            const content = await blue.getWorkspaceContent(args.project_id);
            const lists = (content.lists || []).map((l: any) => ({
              id: l.id, title: l.title,
              cards: (l.todos || []).map((t: any) => ({ id: t.id, title: t.title, done: t.done, comments: t.commentCount, tags: (t.tags || []).map((x: any) => x.title) })),
            }));
            return ok({ lists }, `Read ${plural(lists.length, 'list')}`, {
              kind: 'table', columns: ['List', 'Cards'], rows: lists.map((l: any) => [l.title, l.cards.length]),
            });
          }
          case 'get_blue_comments': {
            const res = await blue.getTodoComments(args.todo_id, args.project_id);
            return ok(res, `${plural(res.totalCount, 'comment')}`);
          }
          case 'get_blue_mentions': {
            const res = await blue.getMentions(20);
            return ok(res, `${plural(res.items.length, 'mention')}`);
          }
          case 'blue_create_comment': {
            await blue.createComment(args.todo_id, 'TODO', args.text, args.project_id, args.parent_id);
            return ok({ commented: true }, 'Posted a comment');
          }
          case 'blue_move_todo': {
            await blue.moveTodo(args.todo_id, args.todo_list_id, args.project_id);
            return ok({ moved: true }, 'Moved the card');
          }
          case 'create_blue_workspace': {
            const ws = await blue.createWorkspace(args.name, args.description);
            return ok(ws, `Created ${args.name}`);
          }
          case 'rename_blue_workspace': {
            const ws = await blue.updateWorkspace(args.project_id, args.name);
            return ok(ws, `Renamed to ${args.name}`);
          }
          case 'archive_blue_workspace': {
            await blue.archiveWorkspace(args.project_id);
            return ok({ archived: args.project_id }, 'Archived the workspace');
          }
          case 'invite_blue_user': {
            await blue.inviteUser(args.project_id, args.email);
            return ok({ invited: args.email }, `Invited ${args.email}`);
          }
          case 'remove_blue_user': {
            await blue.removeUser(args.project_id, args.user_id);
            return ok({ removed: args.user_id }, 'Removed the user');
          }
          default:
            return fail(`"${name}" is not implemented.`);
        }
      }
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
