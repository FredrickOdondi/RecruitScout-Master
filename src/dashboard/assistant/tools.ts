import type { ToolDefinition } from './types';

/** OpenAI function-calling schemas. Executors live in executeTool.ts */
export const ASSISTANT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_overview_stats',
    description: 'Fleet overview: job counts, clients, recruiters, queue/agent health from overview_stats().',
    risk: 'read',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_queue',
    description: 'List BulkQueue tasks with status, title, location, client, worker, site.',
    risk: 'read',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Optional filter: pending|running|completed|failed' },
        limit: { type: 'number', description: 'Max rows (default 100)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_active_agents',
    description: 'List swarm agents that have heartbeated recently.',
    risk: 'read',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'enqueue_tasks',
    description: 'Enqueue scrape tasks. One title per entry, or empty titles with location for location-only scrape.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        titles: { type: 'array', items: { type: 'string' }, description: 'Job titles to search' },
        location: { type: 'string' },
        client_id: { type: 'string', description: 'Client UUID, or omit for general' },
        target_site: {
          type: 'string',
          description: 'indeed | trovolavoro | comma-separated sites',
        },
        assigned_to: { type: 'string', description: 'Worker ID or blank for any' },
        date_filter: { type: 'string', description: 'Indeed date filter: last|1|3|7|14' },
        confirm: { type: 'boolean', description: 'Set true after user confirms if required' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'update_queue_task',
    description: 'Update one queue task fields (status, title, location, assigned_to, target_site, client_id).',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string' },
        job_title: { type: 'string' },
        location: { type: 'string' },
        assigned_to: { type: 'string' },
        target_site: { type: 'string' },
        client_id: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_queue_tasks',
    description: 'Delete queue tasks by id. Cannot delete running tasks.',
    risk: 'destructive',
    parameters: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
        confirm: { type: 'boolean' },
      },
      required: ['ids'],
      additionalProperties: false,
    },
  },
  {
    name: 'reset_queue',
    description: 'Reset all completed/failed BulkQueue tasks back to pending.',
    risk: 'bulk',
    parameters: {
      type: 'object',
      properties: { confirm: { type: 'boolean' } },
      additionalProperties: false,
    },
  },
  {
    name: 'apply_queue_location',
    description: 'Set location on all existing queue tasks.',
    risk: 'bulk',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['location'],
      additionalProperties: false,
    },
  },
  {
    name: 'stop_engine',
    description: 'Emergency stop: stop extraction and disable remote polling on this extension node.',
    risk: 'extension',
    parameters: {
      type: 'object',
      properties: { confirm: { type: 'boolean' } },
      additionalProperties: false,
    },
  },
  {
    name: 'force_poll_queue',
    description: 'Force this extension agent to claim the next pending BulkQueue task now.',
    risk: 'extension',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_settings',
    description: 'Read extension engine settings (polling, worker name, Indeed cookie mode, filters, sheets).',
    risk: 'extension',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'update_settings',
    description: 'Update extension settings. Only pass fields to change.',
    risk: 'extension',
    parameters: {
      type: 'object',
      properties: {
        pollingEnabled: { type: 'boolean' },
        friendName: { type: 'string', description: 'Worker display name / ID' },
        indeedCookieMode: { type: 'string', enum: ['browser', 'stored'] },
        activeClientName: { type: 'string' },
        filterRecruitersEnabled: { type: 'boolean' },
        spanishWhitelistEnabled: { type: 'boolean' },
        maxJobsPerPage: { type: 'number' },
        paginationLimit: { type: 'number' },
        crawlDelay: { type: 'number' },
        autoExtract: { type: 'boolean' },
        confirm: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_job_count',
    description: 'Total jobs in the cloud jobs table.',
    risk: 'read',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'query_jobs',
    description: 'Search/filter cloud jobs.',
    risk: 'read',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        client: { type: 'string' },
        source: { type: 'string' },
        company: { type: 'string' },
        category: { type: 'string' },
        worker_id: { type: 'string' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'delete_jobs',
    description: 'Delete cloud jobs by id.',
    risk: 'destructive',
    parameters: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' } },
        confirm: { type: 'boolean' },
      },
      required: ['ids'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_clients',
    description: 'List enrolled clients and their sheet configuration.',
    risk: 'read',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'enroll_client',
    description: 'Enroll a client with Apps Script / Sheets config.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        apps_script_url: { type: 'string' },
        spreadsheet_id: { type: 'string' },
        sheet_name: { type: 'string' },
        set_active: { type: 'boolean', description: 'Also set as active client in settings' },
        confirm: { type: 'boolean' },
      },
      required: ['name', 'apps_script_url'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_client',
    description: 'Delete an enrolled client by id.',
    risk: 'destructive',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_indeed_sessions',
    description: 'List Indeed scraper accounts (no cookie values): health, lease, errors.',
    risk: 'read',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'reactivate_indeed_session',
    description: 'Put a blocked Indeed session back into rotation.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['session_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'force_release_indeed_session',
    description: 'Force-release an Indeed account lease stuck on a worker.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['session_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_recruiters',
    description: 'Search recruiters / leads directory (paginated summary).',
    risk: 'read',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        page: { type: 'number' },
        page_size: { type: 'number' },
        country: { type: 'string' },
        status: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'update_recruiter',
    description: 'Update fields on one recruiter row (keyed by agency name).',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        agency_name: { type: 'string' },
        updates: { type: 'object', additionalProperties: true },
        confirm: { type: 'boolean' },
      },
      required: ['agency_name', 'updates'],
      additionalProperties: false,
    },
  },
  {
    name: 'bulk_update_recruiters',
    description: 'Bulk update all recruiters: status, leads_sent, teaser_threshold, min_leads, or max_leads.',
    risk: 'bulk',
    parameters: {
      type: 'object',
      properties: {
        field: {
          type: 'string',
          enum: ['status', 'leads_sent', 'teaser_threshold', 'min_leads', 'max_leads'],
        },
        value: { description: 'string for status, number for others' },
        confirm: { type: 'boolean' },
      },
      required: ['field', 'value'],
      additionalProperties: false,
    },
  },
  {
    name: 'sync_recruiter_contacts',
    description: 'Sync recruiter contact emails from the contacts source into Recruiters.',
    risk: 'bulk',
    parameters: {
      type: 'object',
      properties: { confirm: { type: 'boolean' } },
      additionalProperties: false,
    },
  },
  {
    name: 'match_recruiters_to_jobs',
    description: 'Match categorized jobs to recruiters by specialty and return groups with contact emails.',
    risk: 'read',
    parameters: {
      type: 'object',
      properties: {
        limit_groups: { type: 'number', description: 'Max matched groups to return (default 20)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_email_schedule',
    description: 'Read leads-flow email schedule config and state from extension storage (via bridge).',
    risk: 'extension',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'set_email_schedule',
    description: 'Update leads-flow email schedule config.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        startTime: { type: 'string', description: 'HH:MM' },
        endTime: { type: 'string', description: 'HH:MM' },
        intervalMinutes: { type: 'number' },
        maxDailyEmails: { type: 'number' },
        daysOfWeek: { type: 'array', items: { type: 'number' }, description: '0=Sun … 6=Sat' },
        confirm: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'send_lead_email',
    description: 'Send a lead email via Plunk/extension. Always requires confirm with full draft.',
    risk: 'external',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body_html: { type: 'string' },
        recruiter_id: { type: 'string' },
        recruiter_name: { type: 'string' },
        matched_jobs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              company: { type: 'string' },
            },
          },
        },
        confirm: { type: 'boolean' },
      },
      required: ['to', 'subject', 'body_html'],
      additionalProperties: false,
    },
  },
  {
    name: 'sync_jobs_to_sheets',
    description: 'Sync jobs for a client to their Google Sheet via Apps Script web app URL.',
    risk: 'external',
    parameters: {
      type: 'object',
      properties: {
        client_name: { type: 'string' },
        limit: { type: 'number', description: 'Max jobs to sync (default 200)' },
        confirm: { type: 'boolean' },
      },
      required: ['client_name'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_blue_workspaces',
    description: 'List Blue.cc workspaces for the signed-in user (requires Blue credentials).',
    risk: 'read',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_blue_workspace_content',
    description: 'Fetch lists and todos for a Blue.cc workspace/project id.',
    risk: 'read',
    parameters: {
      type: 'object',
      properties: { project_id: { type: 'string' } },
      required: ['project_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'blue_create_comment',
    description: 'Add a comment on a Blue.cc todo.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        todo_id: { type: 'string' },
        project_id: { type: 'string' },
        text: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['todo_id', 'project_id', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'blue_move_todo',
    description: 'Move a Blue.cc todo to another list.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        todo_id: { type: 'string' },
        todo_list_id: { type: 'string' },
        project_id: { type: 'string' },
        confirm: { type: 'boolean' },
      },
      required: ['todo_id', 'todo_list_id', 'project_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'diagnose_swarm',
    description: 'One-shot diagnosis: agents online, queue counts, Indeed session health, polling setting if bridge available.',
    risk: 'read',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
];

export function toolsForOpenAI() {
  return ASSISTANT_TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function getToolDef(name: string): ToolDefinition | undefined {
  return ASSISTANT_TOOLS.find((t) => t.name === name);
}

export const NEEDS_CONFIRM_RISKS = new Set(['bulk', 'destructive', 'external']);
