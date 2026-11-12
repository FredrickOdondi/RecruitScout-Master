import type { JsonSchema, ToolDefinition, ToolRisk } from './types';

/**
 * Every task a person does in RecruitScout, as tools the Assistant can call.
 * Executors live in executeTool.ts.
 *
 * There is deliberately no "confirm" argument: only an Approve click in the UI
 * can authorise a risky call (see APPROVAL_RISKS and executeTool.ts).
 */

const obj = (properties: Record<string, JsonSchema> = {}, required: string[] = []): JsonSchema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const str = (description?: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'string', description, ...extra });
const num = (description?: string, extra: Partial<JsonSchema> = {}): JsonSchema => ({ type: 'number', description, ...extra });
const bool = (description?: string): JsonSchema => ({ type: 'boolean', description });
const strList = (description?: string): JsonSchema => ({ type: 'array', items: { type: 'string' }, description });

const SITES = ['indeed', 'spanish-indeed', 'trovolavoro'];
const QUEUE_STATUSES = ['pending', 'running', 'completed', 'failed'];

const FILTERS: JsonSchema = {
  type: 'array',
  description: 'Conditions, all must match. like/ilike match a substring; in takes values; is/not_is take null, true or false.',
  items: obj({
    column: str(),
    op: str(undefined, { enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is', 'not_is'] }),
    value: str('Value as text'),
    values: strList('For op "in"'),
  }, ['column', 'op']),
};

export const ASSISTANT_TOOLS: ToolDefinition[] = [
  // ── Overview and diagnosis ──────────────────────────────────────────────
  {
    name: 'get_overview_stats', label: 'Read overview stats', risk: 'read',
    description: 'Exact totals and breakdowns: jobs, clients, recruiters, queue, emails, agents, sources, categories, 14-day volume.',
    parameters: obj(),
  },
  {
    name: 'diagnose_swarm', label: 'Diagnose the swarm', risk: 'read',
    description: 'One-shot health check: queue counts, online agents, Indeed account health and this browser\'s engine settings.',
    parameters: obj(),
  },
  {
    name: 'open_dashboard_view', label: 'Open a dashboard view', risk: 'read',
    description: 'Switch the dashboard to a tab so the user can see it.',
    parameters: obj({
      view: str('Tab to open', { enum: ['overview', 'search', 'indeed-sessions', 'jobs', 'export', 'graph', 'supabase', 'clients', 'leads', 'leads-flow', 'blue', 'settings'] }),
    }, ['view']),
  },

  // ── Database (any table, schema-checked) ────────────────────────────────
  {
    name: 'describe_database', label: 'Read the database schema', risk: 'read',
    description: 'Every RecruitScout table with its columns and types, and which tables can be changed. Call this before query_database when you are unsure of a table or column name.',
    parameters: obj({ table: str('Only this table') }),
  },
  {
    name: 'query_database', label: 'Query the database', risk: 'read',
    description: 'Read rows from any RecruitScout table with filters, sorting and paging, or just count them. Use it for any question no specific tool answers, e.g. blacklisted recruiters (Recruiters, status eq Blacklisted), jobs from one company, emails sent last week. Column names are exact and case-sensitive, e.g. "Primary Specialty".',
    parameters: obj({
      table: str('Table name, e.g. Recruiters, jobs, BulkQueue, clients, email_logs'),
      columns: strList('Columns to return; omit for all. Prefer a few columns on wide tables.'),
      filters: FILTERS,
      order_by: str('Column to sort by'),
      descending: bool(),
      limit: num('Rows to return, default 50, max 200', { minimum: 1, maximum: 200 }),
      offset: num('Rows to skip for paging', { minimum: 0 }),
      count_only: bool('Return only the number of matching rows'),
    }, ['table']),
  },
  {
    name: 'count_by', label: 'Break down by a column', risk: 'read',
    description: 'Count rows per value of one column (e.g. recruiters by status, jobs by source or client, queue by status), optionally filtered.',
    parameters: obj({
      table: str(), column: str(), filters: FILTERS,
      top: num('Groups to return, default 50', { minimum: 1, maximum: 200 }),
    }, ['table', 'column']),
  },
  {
    name: 'update_records', label: 'Update records', risk: 'bulk',
    description: 'Change fields on every row of a table that matches the filters (at least one filter). The user approves after seeing how many rows match. Use specific tools first when one fits.',
    parameters: obj({
      table: str(), filters: FILTERS,
      updates: { type: 'object', additionalProperties: true, description: 'Column → new value' },
    }, ['table', 'filters', 'updates']),
  },
  {
    name: 'insert_records', label: 'Add records', risk: 'bulk',
    description: 'Insert new rows into a table. The user approves first.',
    parameters: obj({
      table: str(),
      rows: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'Rows as column → value' },
    }, ['table', 'rows']),
  },
  {
    name: 'delete_records', label: 'Delete records', risk: 'destructive',
    description: 'Delete every row of a table that matches the filters (at least one filter). The user approves after seeing how many rows match. This can\'t be undone.',
    parameters: obj({ table: str(), filters: FILTERS }, ['table', 'filters']),
  },

  // ── Queue ────────────────────────────────────────────────────────────────
  {
    name: 'get_queue_counts', label: 'Count queue tasks', risk: 'read',
    description: 'Number of pending and running BulkQueue tasks.',
    parameters: obj(),
  },
  {
    name: 'get_queue', label: 'List queue tasks', risk: 'read',
    description: 'List BulkQueue tasks (newest first) with status, title, location, client, worker and site.',
    parameters: obj({
      status: str('Filter by status', { enum: QUEUE_STATUSES }),
      limit: num('Max rows, default 50', { minimum: 1, maximum: 200 }),
      offset: num('Rows to skip for paging', { minimum: 0 }),
    }),
  },
  {
    name: 'enqueue_tasks', label: 'Queue scrape tasks', risk: 'write',
    description: 'Add scrape tasks to the queue: one task per job title, or no titles plus a location for a location-only scrape.',
    parameters: obj({
      titles: strList('Job titles to search'),
      location: str('City or country'),
      client_id: str('Client UUID, omit for general'),
      target_site: str('Site to scrape', { enum: SITES }),
      assigned_to: str('Worker ID, omit for any agent'),
      date_filter: str('Indeed date filter', { enum: ['last', '1', '3', '7', '14'] }),
    }),
  },
  {
    name: 'update_queue_task', label: 'Edit a queue task', risk: 'write',
    description: 'Change fields on one queue task.',
    parameters: obj({
      id: str('Task ID'),
      status: str(undefined, { enum: QUEUE_STATUSES }),
      job_title: str(), location: str(), assigned_to: str(),
      target_site: str(undefined, { enum: SITES }),
      client_id: str(),
      date_filter: str(undefined, { enum: ['last', '1', '3', '7', '14'] }),
    }, ['id']),
  },
  {
    name: 'bulk_update_queue_tasks', label: 'Edit several queue tasks', risk: 'bulk',
    description: 'Set the same status, site or client on a specific list of queue task IDs the user picked. To reset all finished or failed tasks use reset_queue instead.',
    parameters: obj({
      ids: strList('Task IDs'),
      status: str(undefined, { enum: QUEUE_STATUSES }),
      target_site: str(undefined, { enum: SITES }),
      client_id: str(),
    }, ['ids']),
  },
  {
    name: 'delete_queue_tasks', label: 'Delete queue tasks', risk: 'destructive',
    description: 'Permanently delete queue tasks by ID.',
    parameters: obj({ ids: strList('Task IDs') }, ['ids']),
  },
  {
    name: 'reset_queue', label: 'Reset the queue', risk: 'bulk',
    description: 'Reset finished work: sets every completed, failed and stuck (running over 3 hours) queue task back to pending in one step. Use this whenever the user asks to reset, re-run or restart finished or failed tasks; never page through tasks to do it.',
    parameters: obj(),
  },
  {
    name: 'apply_queue_location', label: 'Set location on all tasks', risk: 'bulk',
    description: 'Overwrite the location on every queue task.',
    parameters: obj({ location: str() }, ['location']),
  },

  // ── Engine and agents (this browser\'s extension) ─────────────────────────
  {
    name: 'get_active_agents', label: 'List agents', risk: 'read',
    description: 'Scraping agents that have checked in recently.',
    parameters: obj(),
  },
  {
    name: 'get_engine_status', label: 'Read engine status', risk: 'read',
    description: 'This browser\'s scraping engine: running, idle or error, current progress and page.',
    parameters: obj(),
  },
  {
    name: 'get_settings', label: 'Read engine settings', risk: 'read',
    description: 'This browser\'s extension settings: polling, worker ID, Indeed sign-in mode, filters, crawl delay.',
    parameters: obj(),
  },
  {
    name: 'start_engine', label: 'Start the engine', risk: 'extension',
    description: 'Turn on swarm polling in this browser and claim the next pending queue task now.',
    parameters: obj(),
  },
  {
    name: 'start_bulk_search', label: 'Start a bulk search', risk: 'extension',
    description: 'Run a bulk Indeed search in this browser right away, without the queue.',
    parameters: obj({
      titles: strList('Job titles'),
      location: str(),
      target_site: str(undefined, { enum: SITES }),
      date_filter: str(undefined, { enum: ['last', '1', '3', '7', '14'] }),
      client_name: str('Client to stamp on the jobs'),
    }, ['titles']),
  },
  {
    name: 'pause_engine', label: 'Pause the engine', risk: 'extension',
    description: 'Pause extraction in this browser.',
    parameters: obj(),
  },
  {
    name: 'stop_engine', label: 'Stop the engine', risk: 'extension',
    description: 'Stop extraction in this browser and turn swarm polling off.',
    parameters: obj(),
  },
  {
    name: 'force_poll_queue', label: 'Check the queue now', risk: 'extension',
    description: 'Make this browser claim the next pending queue task immediately. Returns why nothing ran if it finds no task.',
    parameters: obj(),
  },
  {
    name: 'update_settings', label: 'Change engine settings', risk: 'extension',
    description: 'Change this browser\'s extension settings. Pass only the fields to change.',
    parameters: obj({
      pollingEnabled: bool(), friendName: str('Worker ID'),
      indeedCookieMode: str('Indeed sign-in: this browser or stored accounts', { enum: ['browser', 'stored'] }),
      activeClientName: str(), filterRecruitersEnabled: bool(), spanishWhitelistEnabled: bool(),
      maxJobsPerPage: num(undefined, { minimum: 1 }), paginationLimit: num(undefined, { minimum: 1 }),
      crawlDelay: num('Milliseconds', { minimum: 0 }), autoExtract: bool(),
    }),
  },

  // ── Jobs ─────────────────────────────────────────────────────────────────
  {
    name: 'get_job_count', label: 'Count jobs', risk: 'read',
    description: 'Total jobs in the cloud jobs table.',
    parameters: obj(),
  },
  {
    name: 'query_jobs', label: 'Search jobs', risk: 'read',
    description: 'Search and filter cloud jobs.',
    parameters: obj({
      search: str('Matches title, company or location'),
      client: str(), source: str(), category: str(), worker_id: str(),
      sort: str(undefined, { enum: ['newest', 'oldest', 'title', 'company'] }),
      limit: num('Default 25', { minimum: 1, maximum: 100 }),
      offset: num(undefined, { minimum: 0 }),
    }),
  },
  {
    name: 'get_local_jobs', label: 'List jobs in this browser', risk: 'read',
    description: 'Jobs stored in this browser\'s extension (not yet or already synced).',
    parameters: obj({ limit: num('Default 25', { minimum: 1, maximum: 200 }), offset: num(undefined, { minimum: 0 }) }),
  },
  {
    name: 'update_job', label: 'Edit a job', risk: 'write',
    description: 'Change fields on a job stored in this browser.',
    parameters: obj({
      id: str('Job ID'),
      updates: { type: 'object', description: 'Fields to set, e.g. status, client, companyDomain', additionalProperties: true },
    }, ['id', 'updates']),
  },
  {
    name: 'delete_jobs', label: 'Delete jobs', risk: 'destructive',
    description: 'Permanently delete cloud jobs by ID. Also how a job is rejected from lead matches.',
    parameters: obj({ ids: strList('Job IDs') }, ['ids']),
  },
  {
    name: 'sync_local_jobs_to_cloud', label: 'Upload browser jobs', risk: 'bulk',
    description: 'Upload every job stored in this browser to the cloud jobs table.',
    parameters: obj(),
  },
  {
    name: 'export_jobs', label: 'Export jobs', risk: 'read',
    description: 'Download matching cloud jobs as a CSV, JSON or Excel file in the user\'s browser.',
    parameters: obj({
      format: str(undefined, { enum: ['csv', 'json', 'xlsx'] }),
      search: str(), client: str(), source: str(), category: str(),
      limit: num('Default 1000', { minimum: 1, maximum: 5000 }),
    }, ['format']),
  },
  {
    name: 'resolve_company_domain', label: 'Find a company website', risk: 'read',
    description: 'Look up a company\'s website domain.',
    parameters: obj({ company: str() }, ['company']),
  },

  // ── Clients and Sheets ───────────────────────────────────────────────────
  {
    name: 'get_clients', label: 'List clients', risk: 'read',
    description: 'Enrolled clients with their Google Sheet settings.',
    parameters: obj(),
  },
  {
    name: 'enroll_client', label: 'Enroll a client', risk: 'write',
    description: 'Add a client and its Google Sheet. apps_script_url may be empty when the sheet uses Google sign-in sync.',
    parameters: obj({
      name: str(), apps_script_url: str(), spreadsheet_id: str('Sheet URL or ID'), sheet_name: str('Tab name, default Sheet1'),
    }, ['name']),
  },
  {
    name: 'update_client_sheet', label: 'Change a client\'s sheet', risk: 'write',
    description: 'Change the spreadsheet, tab or Apps Script URL for a client.',
    parameters: obj({ id: str('Client ID'), spreadsheet_id: str(), sheet_name: str(), apps_script_url: str(), name: str('New name') }, ['id']),
  },
  {
    name: 'set_active_client', label: 'Set the default client', risk: 'write',
    description: 'Make a client the default for jobs scraped from this browser.',
    parameters: obj({ name: str('Client name') }, ['name']),
  },
  {
    name: 'delete_client', label: 'Delete a client', risk: 'destructive',
    description: 'Delete an enrolled client. Jobs already in its sheet stay.',
    parameters: obj({ id: str('Client ID') }, ['id']),
  },
  {
    name: 'sync_jobs_to_sheets', label: 'Sync jobs to Google Sheets', risk: 'external',
    description: 'Send a client\'s jobs to their Google Sheet through its Apps Script URL.',
    parameters: obj({ client_name: str(), limit: num('Default 200', { minimum: 1, maximum: 500 }) }, ['client_name']),
  },

  // ── Indeed accounts ──────────────────────────────────────────────────────
  {
    name: 'list_indeed_sessions', label: 'List Indeed accounts', risk: 'read',
    description: 'Indeed scraper accounts (never cookie values): status, which agent holds them, errors, sign-in expiry.',
    parameters: obj(),
  },
  {
    name: 'reactivate_indeed_session', label: 'Reactivate an Indeed account', risk: 'write',
    description: 'Put a blocked Indeed account back into rotation.',
    parameters: obj({ session_id: str() }, ['session_id']),
  },
  {
    name: 'force_release_indeed_session', label: 'Release an Indeed account', risk: 'write',
    description: 'Free an Indeed account an agent left leased.',
    parameters: obj({ session_id: str() }, ['session_id']),
  },

  // ── Recruiters and leads ─────────────────────────────────────────────────
  {
    name: 'get_recruiters', label: 'Search recruiters', risk: 'read',
    description: 'Search the recruiter directory, paged. For any other filter use query_database on Recruiters.',
    parameters: obj({
      search: str('Name or domain'), country: str(), location: str(), specialty: str(), industry: str(),
      status: str(undefined, { enum: ['Active', 'Suspended', 'Blacklisted', 'Pending'] }),
      page: num(undefined, { minimum: 1 }), page_size: num('Default 20', { minimum: 1, maximum: 100 }),
    }),
  },
  {
    name: 'get_recruiter_countries', label: 'List recruiter countries', risk: 'read',
    description: 'Countries present in the recruiter directory.',
    parameters: obj(),
  },
  {
    name: 'get_recruiter_email_history', label: 'Read a recruiter\'s emails', risk: 'read',
    description: 'Lead emails already sent to one recruiter.',
    parameters: obj({ recruiter_id: str() }, ['recruiter_id']),
  },
  {
    name: 'update_recruiter', label: 'Edit a recruiter', risk: 'write',
    description: 'Change fields on one recruiter, found by agency name. Field names match the Recruiters table, e.g. "Primary Specialty", "Daily Sending Limit".',
    parameters: obj({
      agency_name: str(),
      updates: { type: 'object', additionalProperties: true },
    }, ['agency_name', 'updates']),
  },
  {
    name: 'set_recruiter_status', label: 'Change a recruiter\'s status', risk: 'write',
    description: 'Set one recruiter\'s status.',
    parameters: obj({ agency_name: str(), status: str(undefined, { enum: ['Active', 'Suspended', 'Blacklisted', 'Pending'] }) }, ['agency_name', 'status']),
  },
  {
    name: 'bulk_update_recruiters', label: 'Change all recruiters', risk: 'bulk',
    description: 'Set one value on every recruiter: status, leads sent before teaser, teaser threshold, min leads or max leads per email.',
    parameters: obj({
      field: str(undefined, { enum: ['status', 'leads_sent', 'teaser_threshold', 'min_leads', 'max_leads'] }),
      value: str('Status text, or a number for the others'),
    }, ['field', 'value']),
  },
  {
    name: 'sync_recruiter_contacts', label: 'Sync recruiter contacts', risk: 'bulk',
    description: 'Copy contact emails from the RecruiterContact table into recruiters.',
    parameters: obj(),
  },
  {
    name: 'match_recruiters_to_jobs', label: 'Match recruiters to jobs', risk: 'read',
    description: 'Match categorized jobs to active recruiters by specialty and location, as the Leads flow does.',
    parameters: obj({ limit_groups: num('Default 20', { minimum: 1, maximum: 50 }) }),
  },
  {
    name: 'draft_lead_email', label: 'Draft a lead email', risk: 'read',
    description: 'Build the standard lead email (same templates as Leads flow) for a recruiter and their matched jobs. Returns subject and HTML; does not send.',
    parameters: obj({ agency_name: str(), to: str('Recipient email, optional') }, ['agency_name']),
  },
  {
    name: 'send_lead_email', label: 'Send a lead email', risk: 'external',
    description: 'Send a lead email to a recruiter. Use draft_lead_email first.',
    parameters: obj({
      to: str(), subject: str(), body_html: str(), recruiter_id: str(), recruiter_name: str(),
      matched_jobs: { type: 'array', items: { type: 'object', properties: { id: str(), title: str(), company: str() } } },
    }, ['to', 'subject', 'body_html']),
  },
  {
    name: 'get_email_schedule', label: 'Read the email schedule', risk: 'read',
    description: 'Leads flow automatic email schedule and today\'s progress.',
    parameters: obj(),
  },
  {
    name: 'set_email_schedule', label: 'Change the email schedule', risk: 'external',
    description: 'Change the automatic lead email schedule. Turning it on sends emails to recruiters automatically.',
    parameters: obj({
      enabled: bool(), startTime: str('HH:MM'), endTime: str('HH:MM'),
      intervalMinutes: num(undefined, { minimum: 1 }), maxDailyEmails: num(undefined, { minimum: 1 }),
      daysOfWeek: { type: 'array', items: { type: 'number' }, description: '0 = Sunday … 6 = Saturday' },
    }),
  },

  // ── Blue.cc ──────────────────────────────────────────────────────────────
  {
    name: 'get_blue_workspaces', label: 'List Blue.cc workspaces', risk: 'read',
    description: 'Blue.cc workspaces for the signed-in user.',
    parameters: obj(),
  },
  {
    name: 'get_blue_workspace_content', label: 'Read a Blue.cc board', risk: 'read',
    description: 'Lists and cards of one Blue.cc workspace.',
    parameters: obj({ project_id: str() }, ['project_id']),
  },
  {
    name: 'get_blue_comments', label: 'Read Blue.cc comments', risk: 'read',
    description: 'Comments and replies on one Blue.cc card.',
    parameters: obj({ todo_id: str(), project_id: str() }, ['todo_id', 'project_id']),
  },
  {
    name: 'get_blue_mentions', label: 'Read Blue.cc mentions', risk: 'read',
    description: 'Recent Blue.cc mentions of the user.',
    parameters: obj(),
  },
  {
    name: 'blue_create_comment', label: 'Comment on Blue.cc', risk: 'write',
    description: 'Add a comment, or a reply when parent_id is given, on a Blue.cc card.',
    parameters: obj({ todo_id: str(), project_id: str(), text: str(), parent_id: str() }, ['todo_id', 'project_id', 'text']),
  },
  {
    name: 'blue_move_todo', label: 'Move a Blue.cc card', risk: 'write',
    description: 'Move a Blue.cc card to another list.',
    parameters: obj({ todo_id: str(), todo_list_id: str(), project_id: str() }, ['todo_id', 'todo_list_id', 'project_id']),
  },
  {
    name: 'create_blue_workspace', label: 'Create a Blue.cc workspace', risk: 'write',
    description: 'Create a Blue.cc workspace.',
    parameters: obj({ name: str(), description: str() }, ['name']),
  },
  {
    name: 'rename_blue_workspace', label: 'Rename a Blue.cc workspace', risk: 'write',
    description: 'Rename a Blue.cc workspace.',
    parameters: obj({ project_id: str(), name: str() }, ['project_id', 'name']),
  },
  {
    name: 'archive_blue_workspace', label: 'Archive a Blue.cc workspace', risk: 'destructive',
    description: 'Archive a Blue.cc workspace.',
    parameters: obj({ project_id: str() }, ['project_id']),
  },
  {
    name: 'invite_blue_user', label: 'Invite someone to Blue.cc', risk: 'external',
    description: 'Invite a person by email to a Blue.cc workspace.',
    parameters: obj({ project_id: str(), email: str() }, ['project_id', 'email']),
  },
  {
    name: 'remove_blue_user', label: 'Remove someone from Blue.cc', risk: 'destructive',
    description: 'Remove a person from a Blue.cc workspace.',
    parameters: obj({ project_id: str(), user_id: str() }, ['project_id', 'user_id']),
  },
];

/** Risks that only run after the user clicks Approve. */
export const APPROVAL_RISKS = new Set<ToolRisk>(['bulk', 'destructive', 'external', 'extension']);

const BY_NAME = new Map(ASSISTANT_TOOLS.map((t) => [t.name, t]));

export function getToolDef(name: string): ToolDefinition | undefined {
  return BY_NAME.get(name);
}

/** Tool definitions in the Responses API format. */
export function toolsForOpenAI() {
  return ASSISTANT_TOOLS.map((t) => ({
    type: 'function' as const,
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}
