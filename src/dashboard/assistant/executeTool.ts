import { supabaseClient } from '../../shared/supabase';
import { BlueCcClient } from '../../shared/bluecc';
import { MessageType } from '../../shared/types';
import { getToolDef, NEEDS_CONFIRM_RISKS } from './tools';
import type { ToolContext, ToolResult } from './types';

function ok(data: unknown): ToolResult {
  return { ok: true, data };
}

function fail(error: string): ToolResult {
  return { ok: false, error };
}

function needsConfirm(preview: string, risk: ToolResult['risk']): ToolResult {
  return { ok: false, needsConfirmation: true, preview, risk };
}

function extractKeywords(str: string): Set<string> {
  const stopWords = new Set(['and', 'or', 'the', 'of', 'in', 'for', 'a', 'an', 'to']);
  return new Set(
    str
      .toLowerCase()
      .replace(/[^a-z0-9 /]/g, ' ')
      .split(/[\s/]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2 && !stopWords.has(w)),
  );
}

function specialtyMatches(recSpecialty: string, jobCategory: string): boolean {
  const recLow = recSpecialty.trim().toLowerCase();
  const jobLow = jobCategory.trim().toLowerCase();
  if (recLow === jobLow) return true;
  const recKw = extractKeywords(recLow);
  const jobKw = extractKeywords(jobLow);
  for (const kw of recKw) {
    if (jobKw.has(kw)) return true;
  }
  return false;
}

async function getBlueClient(userId: string): Promise<BlueCcClient | null> {
  const res = await supabaseClient.getUserIntegration(userId);
  if (!res.data?.bluecc_token_id || !res.data?.bluecc_secret_id) return null;
  return new BlueCcClient(
    res.data.bluecc_token_id,
    res.data.bluecc_secret_id,
    res.data.bluecc_company_id || undefined,
  );
}

async function safeBridge<T>(ctx: ToolContext, message: any): Promise<{ data?: T; error?: string }> {
  try {
    const data = await ctx.bridgeSendMessage<T>(message);
    return { data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Extension bridge unavailable. Is RecruitScout loaded?' };
  }
}

function gateConfirm(name: string, args: Record<string, any>, preview: string): ToolResult | null {
  const def = getToolDef(name);
  if (!def) return fail(`Unknown tool: ${name}`);
  if (NEEDS_CONFIRM_RISKS.has(def.risk) && !args.confirm) {
    return needsConfirm(preview, def.risk);
  }
  return null;
}

export async function executeTool(
  name: string,
  rawArgs: Record<string, any>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const args = rawArgs || {};

  try {
    switch (name) {
      case 'get_overview_stats': {
        const res = await supabaseClient.callUserRpc('overview_stats');
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'get_queue': {
        const res = await supabaseClient.getQueueStatus();
        if (res.error) return fail(res.error);
        let rows = res.data || [];
        if (args.status) rows = rows.filter((r: any) => r.status === args.status);
        const limit = Math.min(Number(args.limit) || 100, 500);
        return ok({
          total: rows.length,
          tasks: rows.slice(0, limit),
          counts: {
            pending: rows.filter((r: any) => r.status === 'pending').length,
            running: rows.filter((r: any) => r.status === 'running').length,
            completed: rows.filter((r: any) => r.status === 'completed').length,
            failed: rows.filter((r: any) => r.status === 'failed').length,
          },
        });
      }

      case 'get_active_agents': {
        const res = await supabaseClient.getActiveAgents();
        if (res.error) return fail(res.error);
        return ok(res.data || []);
      }

      case 'enqueue_tasks': {
        const titles: string[] = Array.isArray(args.titles) ? args.titles.map(String).filter(Boolean) : [];
        const location = args.location ? String(args.location) : undefined;
        if (titles.length === 0 && !location) {
          return fail('Provide at least one job title or a location.');
        }
        const preview = `Enqueue ${titles.length || 1} task(s)${location ? ` in ${location}` : ''}${args.client_id ? ` for client ${args.client_id}` : ''} on ${args.target_site || 'indeed'}.`;
        const blocked = gateConfirm(name, args, preview);
        if (blocked) return blocked;

        const site = args.target_site || 'indeed';
        const res = await supabaseClient.enqueueTasks(
          titles.length ? titles : [''],
          args.assigned_to || undefined,
          location,
          args.client_id || undefined,
          site,
          args.date_filter || undefined,
        );
        if (res.error) return fail(res.error);
        return ok({ inserted: res.data?.inserted ?? 0, preview });
      }

      case 'update_queue_task': {
        if (!args.id) return fail('id is required');
        const updates: Record<string, any> = {};
        for (const key of ['status', 'job_title', 'location', 'assigned_to', 'target_site', 'client_id', 'date_filter']) {
          if (args[key] !== undefined) updates[key] = args[key];
        }
        const blocked = gateConfirm(name, args, `Update queue task ${args.id}: ${JSON.stringify(updates)}`);
        if (blocked) return blocked;
        const res = await supabaseClient.updateQueueTask(args.id, updates);
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'delete_queue_tasks': {
        const ids: string[] = Array.isArray(args.ids) ? args.ids : [];
        if (!ids.length) return fail('ids required');
        const blocked = gateConfirm(name, args, `Delete ${ids.length} queue task(s): ${ids.slice(0, 8).join(', ')}${ids.length > 8 ? '…' : ''}`);
        if (blocked) return blocked;
        const results = [];
        for (const id of ids) {
          const res = await supabaseClient.deleteQueueTask(id);
          results.push({ id, ok: !res.error, error: res.error });
        }
        return ok({ results });
      }

      case 'reset_queue': {
        const blocked = gateConfirm(name, args, 'Reset ALL completed/failed queue tasks to pending so agents re-run them.');
        if (blocked) return blocked;
        const res = await supabaseClient.resetCompletedTasks();
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'apply_queue_location': {
        const location = String(args.location || '').trim();
        if (!location) return fail('location required');
        const blocked = gateConfirm(name, args, `Set location="${location}" on all queue tasks.`);
        if (blocked) return blocked;
        const res = await supabaseClient.updateQueueLocation(location);
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'stop_engine': {
        const blocked = gateConfirm(name, args, 'Stop extraction on this node and disable swarm polling.');
        if (blocked) return blocked;
        const stop = await safeBridge(ctx, { type: MessageType.STOP_EXTRACTION });
        if (stop.error) return fail(stop.error);
        const settings = await safeBridge<any>(ctx, { type: MessageType.GET_SETTINGS });
        if (!settings.error && settings.data) {
          await safeBridge(ctx, {
            type: MessageType.UPDATE_SETTINGS,
            payload: { ...settings.data, pollingEnabled: false },
          });
        }
        return ok({ stopped: true });
      }

      case 'force_poll_queue': {
        const res = await safeBridge(ctx, { type: 'FORCE_POLL_QUEUE' });
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'get_settings': {
        const res = await safeBridge(ctx, { type: MessageType.GET_SETTINGS });
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'update_settings': {
        const payload = { ...args };
        delete payload.confirm;
        const blocked = gateConfirm(name, args, `Update settings: ${JSON.stringify(payload)}`);
        if (blocked) return blocked;
        const res = await safeBridge(ctx, { type: MessageType.UPDATE_SETTINGS, payload });
        if (res.error) return fail(res.error);
        return ok({ updated: Object.keys(payload) });
      }

      case 'get_job_count': {
        const res = await supabaseClient.getJobCount();
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'query_jobs': {
        const categories = args.category ? [String(args.category)] : undefined;
        const res = await supabaseClient.queryJobs({
          search: args.search,
          source: args.source,
          client: args.client,
          workerId: args.worker_id,
          categories,
          limit: Math.min(Number(args.limit) || 25, 100),
          offset: Number(args.offset) || 0,
        });
        if (res.error) return fail(res.error);
        return ok({ total: res.total, jobs: res.data });
      }

      case 'delete_jobs': {
        const ids: string[] = Array.isArray(args.ids) ? args.ids : [];
        if (!ids.length) return fail('ids required');
        const blocked = gateConfirm(name, args, `Permanently delete ${ids.length} cloud job(s).`);
        if (blocked) return blocked;
        const res = await supabaseClient.deleteJobs(ids);
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'get_clients': {
        const res = await supabaseClient.getClients();
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'enroll_client': {
        if (!args.name || !args.apps_script_url) return fail('name and apps_script_url required');
        const blocked = gateConfirm(
          name,
          args,
          `Enroll client "${args.name}"${args.set_active ? ' and set active' : ''}.`,
        );
        if (blocked) return blocked;
        const res = await supabaseClient.enrollClient({
          name: String(args.name),
          apps_script_url: String(args.apps_script_url),
          spreadsheet_id: args.spreadsheet_id || null,
          sheet_name: args.sheet_name || 'Sheet1',
        });
        if (res.error) return fail(res.error);
        if (args.set_active) {
          await safeBridge(ctx, {
            type: MessageType.UPDATE_SETTINGS,
            payload: {
              activeClientName: args.name,
              googleSheetsConfig: {
                webAppUrl: args.apps_script_url,
                spreadsheetId: args.spreadsheet_id || '',
                sheetName: args.sheet_name || 'Sheet1',
              },
            },
          });
        }
        return ok(res.data);
      }

      case 'delete_client': {
        if (!args.id) return fail('id required');
        const blocked = gateConfirm(name, args, `Delete client ${args.id}.`);
        if (blocked) return blocked;
        const res = await supabaseClient.deleteClient(args.id);
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'list_indeed_sessions': {
        const res = await supabaseClient.callUserRpc('list_indeed_sessions');
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'reactivate_indeed_session': {
        const blocked = gateConfirm(name, args, `Reactivate Indeed session ${args.session_id}.`);
        if (blocked) return blocked;
        const res = await supabaseClient.callUserRpc('reactivate_indeed_session', {
          p_session_id: args.session_id,
        });
        if (res.error) return fail(res.error);
        return ok({ reactivated: args.session_id });
      }

      case 'force_release_indeed_session': {
        const blocked = gateConfirm(name, args, `Force-release Indeed session lease ${args.session_id}.`);
        if (blocked) return blocked;
        const res = await supabaseClient.callUserRpc('force_release_indeed_session', {
          p_session_id: args.session_id,
        });
        if (res.error) return fail(res.error);
        return ok({ released: args.session_id });
      }

      case 'get_recruiters': {
        const page = Number(args.page) || 1;
        const pageSize = Math.min(Number(args.page_size) || 20, 100);
        const filters: { country?: string; specialty?: string } = {};
        if (args.country) filters.country = String(args.country);
        if (args.status) filters.specialty = String(args.status);
        const res = await supabaseClient.getRecruitersPaginated(
          page,
          pageSize,
          args.search ? String(args.search) : '',
          filters,
        );
        if (res.error) return fail(res.error);
        return ok({ data: res.data, totalCount: res.totalCount, page, pageSize });
      }

      case 'update_recruiter': {
        const blocked = gateConfirm(
          name,
          args,
          `Update recruiter "${args.agency_name}": ${JSON.stringify(args.updates)}`,
        );
        if (blocked) return blocked;
        const res = await supabaseClient.updateRecruiter(String(args.agency_name), args.updates || {});
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'bulk_update_recruiters': {
        const field = String(args.field);
        const blocked = gateConfirm(name, args, `Bulk set all recruiters ${field}=${args.value}`);
        if (blocked) return blocked;
        let res;
        switch (field) {
          case 'status':
            res = await supabaseClient.updateAllRecruitersStatus(String(args.value));
            break;
          case 'leads_sent':
            res = await supabaseClient.updateAllRecruitersLeadsSent(Number(args.value));
            break;
          case 'teaser_threshold':
            res = await supabaseClient.updateAllRecruitersTeaserThreshold(Number(args.value));
            break;
          case 'min_leads':
            res = await supabaseClient.updateAllRecruitersMinLeads(Number(args.value));
            break;
          case 'max_leads':
            res = await supabaseClient.updateAllRecruitersMaxLeads(Number(args.value));
            break;
          default:
            return fail(`Unknown field: ${field}`);
        }
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'sync_recruiter_contacts': {
        const blocked = gateConfirm(name, args, 'Sync recruiter contact emails into the Recruiters table.');
        if (blocked) return blocked;
        const res = await supabaseClient.syncRecruiterContactEmails();
        if (res.error) return fail(res.error);
        return ok(res.data);
      }

      case 'match_recruiters_to_jobs': {
        const [jobsRes, recsRes, contactsRes] = await Promise.all([
          supabaseClient.getCategorizedJobs(),
          supabaseClient.getRecruiters(),
          supabaseClient.getRecruiterContacts(),
        ]);
        if (jobsRes.error) return fail(jobsRes.error);
        if (recsRes.error) return fail(recsRes.error);
        const jobs = jobsRes.data || [];
        const recruiters = recsRes.data || [];
        const contacts = contactsRes.data || [];
        const contactByName = new Map<string, any>();
        for (const c of contacts) {
          const key = String(c.agency_name || c['Agency Name'] || c.name || '').toLowerCase();
          if (key) contactByName.set(key, c);
        }

        const groups: any[] = [];
        for (const rec of recruiters) {
          const specialty = String(rec.Specialty || rec.specialty || '');
          const name = String(rec['Agency Name'] || rec.agency_name || rec.name || '');
          if (!specialty || !name) continue;
          const matchedJobs = jobs.filter((j) => j.category && specialtyMatches(specialty, j.category));
          if (!matchedJobs.length) continue;
          const contact = contactByName.get(name.toLowerCase());
          groups.push({
            recruiter: name,
            specialty,
            status: rec.Status || rec.status,
            job_count: matchedJobs.length,
            jobs: matchedJobs.slice(0, 5).map((j) => ({
              id: j.id,
              title: j.title,
              company: j.company,
              category: j.category,
            })),
            email: contact?.email || contact?.Email || null,
          });
        }
        groups.sort((a, b) => b.job_count - a.job_count);
        const limit = Math.min(Number(args.limit_groups) || 20, 50);
        return ok({
          total_groups: groups.length,
          groups: groups.slice(0, limit),
          contacts_available: contacts.length,
        });
      }

      case 'get_email_schedule': {
        // Prefer chrome.storage when available in extension options context
        try {
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            const stored = await chrome.storage.local.get([
              'recruitscout_email_schedule_config',
              'recruitscout_email_schedule_state',
            ]);
            return ok({
              config: stored.recruitscout_email_schedule_config || null,
              state: stored.recruitscout_email_schedule_state || null,
            });
          }
        } catch {
          /* fall through */
        }
        const raw = localStorage.getItem('recruitscout_email_schedule_config');
        const stateRaw = localStorage.getItem('recruitscout_email_schedule_state');
        return ok({
          config: raw ? JSON.parse(raw) : null,
          state: stateRaw ? JSON.parse(stateRaw) : null,
          note: 'Read from localStorage (extension storage unavailable).',
        });
      }

      case 'set_email_schedule': {
        const blocked = gateConfirm(name, args, `Update email schedule: ${JSON.stringify(args)}`);
        if (blocked) return blocked;
        let existing: any = {};
        try {
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            const stored = await chrome.storage.local.get('recruitscout_email_schedule_config');
            existing = stored.recruitscout_email_schedule_config || {};
          } else {
            existing = JSON.parse(localStorage.getItem('recruitscout_email_schedule_config') || '{}');
          }
        } catch {
          existing = {};
        }
        const next = { ...existing };
        for (const key of ['enabled', 'startTime', 'endTime', 'intervalMinutes', 'maxDailyEmails', 'daysOfWeek']) {
          if (args[key] !== undefined) next[key] = args[key];
        }
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ recruitscout_email_schedule_config: next });
        } else {
          localStorage.setItem('recruitscout_email_schedule_config', JSON.stringify(next));
        }
        return ok(next);
      }

      case 'send_lead_email': {
        const preview = `Send email to ${args.to}\nSubject: ${args.subject}\nJobs: ${(args.matched_jobs || []).length}`;
        const blocked = gateConfirm(name, args, preview);
        if (blocked) return blocked;
        const res = await safeBridge<any>(ctx, {
          type: MessageType.SEND_GMAIL_MESSAGE,
          payload: {
            to: args.to,
            subject: args.subject,
            bodyHtml: args.body_html,
          },
        });
        if (res.error) return fail(res.error);
        if (res.data?.error || res.data?.success === false) {
          return fail(res.data?.error || 'Send failed');
        }
        if (args.recruiter_id) {
          await supabaseClient.logEmailSent({
            recruiter_id: args.recruiter_id,
            recruiter_name: args.recruiter_name || '',
            matched_jobs: args.matched_jobs || [],
            email_content: args.body_html,
            email_address: args.to,
          });
        }
        return ok({ sent: true, to: args.to });
      }

      case 'sync_jobs_to_sheets': {
        const clientName = String(args.client_name);
        const blocked = gateConfirm(name, args, `Sync jobs for client "${clientName}" to Google Sheets.`);
        if (blocked) return blocked;
        const clientsRes = await supabaseClient.getClients();
        if (clientsRes.error) return fail(clientsRes.error);
        const client = (clientsRes.data || []).find(
          (c: any) => c.name?.toLowerCase() === clientName.toLowerCase(),
        );
        if (!client) return fail(`Client not found: ${clientName}`);
        if (!client.apps_script_url) return fail(`Client ${clientName} has no apps_script_url`);

        const limit = Math.min(Number(args.limit) || 200, 500);
        const jobsRes = await supabaseClient.queryJobs({
          client: client.name,
          limit,
          offset: 0,
        });
        if (jobsRes.error) return fail(jobsRes.error);
        const jobs = jobsRes.data || [];
        if (!jobs.length) return ok({ synced: 0, message: 'No jobs for this client' });

        const payload = {
          action: 'append',
          sheetName: client.sheet_name || 'Sheet1',
          spreadsheetId: client.spreadsheet_id,
          rows: jobs.map((j) => [
            j.title,
            j.company,
            j.companydomain || '',
            j.location || '',
            j.employmenttype || '',
            j.url,
            j.dateposted || '',
            j.salary || '',
            j.source,
            j.extractedat,
            j.status || '',
            j.category || '',
            j.client || '',
          ]),
        };

        const response = await fetch(client.apps_script_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120000),
        });
        const text = await response.text();
        if (!response.ok) return fail(`Sheets sync HTTP ${response.status}: ${text.slice(0, 300)}`);
        return ok({ synced: jobs.length, response: text.slice(0, 500) });
      }

      case 'get_blue_workspaces': {
        const blue = await getBlueClient(ctx.userId);
        if (!blue) return fail('Blue.cc is not connected. Add credentials in the Blue.cc workspaces tab.');
        const workspaces = await blue.getWorkspaces();
        return ok(workspaces);
      }

      case 'get_blue_workspace_content': {
        const blue = await getBlueClient(ctx.userId);
        if (!blue) return fail('Blue.cc is not connected.');
        const content = await blue.getWorkspaceContent(String(args.project_id));
        return ok(content);
      }

      case 'blue_create_comment': {
        const blocked = gateConfirm(name, args, `Comment on Blue todo ${args.todo_id}: ${args.text}`);
        if (blocked) return blocked;
        const blue = await getBlueClient(ctx.userId);
        if (!blue) return fail('Blue.cc is not connected.');
        await blue.createComment(String(args.todo_id), 'TODO', String(args.text), String(args.project_id));
        return ok({ commented: true });
      }

      case 'blue_move_todo': {
        const blocked = gateConfirm(
          name,
          args,
          `Move Blue todo ${args.todo_id} to list ${args.todo_list_id}`,
        );
        if (blocked) return blocked;
        const blue = await getBlueClient(ctx.userId);
        if (!blue) return fail('Blue.cc is not connected.');
        await blue.moveTodo(String(args.todo_id), String(args.todo_list_id), String(args.project_id));
        return ok({ moved: true });
      }

      case 'diagnose_swarm': {
        const [queueRes, agentsRes, sessionsRes, settingsBridge] = await Promise.all([
          supabaseClient.getQueueStatus(),
          supabaseClient.getActiveAgents(),
          supabaseClient.callUserRpc('list_indeed_sessions'),
          safeBridge(ctx, { type: MessageType.GET_SETTINGS }),
        ]);
        const queue = queueRes.data || [];
        const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
        return ok({
          queue_counts: {
            pending: queue.filter((r: any) => r.status === 'pending').length,
            running: queue.filter((r: any) => r.status === 'running').length,
            completed: queue.filter((r: any) => r.status === 'completed').length,
            failed: queue.filter((r: any) => r.status === 'failed').length,
          },
          agents: agentsRes.data || [],
          indeed: {
            total: sessions.length,
            active: sessions.filter((s: any) => s.status === 'active').length,
            blocked: sessions.filter((s: any) => s.status === 'blocked').length,
            leased: sessions.filter((s: any) => s.leased_by).length,
          },
          local_settings: settingsBridge.error
            ? { bridge_error: settingsBridge.error }
            : {
                pollingEnabled: (settingsBridge.data as any)?.pollingEnabled,
                friendName: (settingsBridge.data as any)?.friendName,
                indeedCookieMode: (settingsBridge.data as any)?.indeedCookieMode,
              },
        });
      }

      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
