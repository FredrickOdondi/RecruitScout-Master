import { JobData, BulkQueueRecord, ClientRecord } from './types';

// Supabase configuration
export const SUPABASE_URL = 'https://qyceqgttvvairnaxwicm.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5Y2VxZ3R0dnZhaXJuYXh3aWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDM4MTQsImV4cCI6MjA4ODMxOTgxNH0.cm8dVGQtAZoLwuhbpsD6uZeFXWPp25LOMCZlyR3aRf0';

/**
 * Supabase job record - matches CSV export columns exactly
 */
export interface SupabaseJob {
  id: string;
  title: string;
  company: string;
  companydomain?: string;
  location?: string;
  employmenttype?: string;
  url: string;
  dateposted?: string;
  salary?: string;
  source: string;
  extractedat: string;
  status?: string;
  description?: string;
  created_at?: string;
  worker_id?: string | null;
  category?: string | null;
  client?: string | null;
}

/**
 * Supabase client record - holds configuration for Google Sheets syncing per client
 */
export interface SupabaseClientRecord {
  id?: string;
  name: string;
  apps_script_url: string;
  spreadsheet_id?: string | null;
  sheet_name?: string | null;
  created_at?: string;
}


/**
 * Response from Supabase operations
 */
export interface SupabaseResponse<T> {
  data?: T | null;
  error?: string | null;
}

/**
 * Supabase Client for job data operations
 */
export class SupabaseClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = SUPABASE_URL;
    this.apiKey = SUPABASE_ANON_KEY;
  }

  /**
   * Format JobData to SupabaseJob
   */
  private formatJob(job: JobData & { workerId?: string }): SupabaseJob {
    // Format salary as string (matches CSV export format)
    let salaryString = '';
    if (job.salary) {
      const parts: string[] = [];
      if (job.salary.min) parts.push(`$${job.salary.min.toLocaleString()}`);
      if (job.salary.max) parts.push(`$${job.salary.max.toLocaleString()}`);
      if (job.salary.currency) parts.push(job.salary.currency);
      if (job.salary.period) parts.push(`/${job.salary.period}`);
      salaryString = parts.join(' ') || job.salary.raw || '';
    }

    // Generate ID from URL + title + company (for deduplication)
    const id = this.generateId(job.url, job.title, job.company);

    return {
      id,
      title: job.title,
      company: job.company,
      companydomain: job.companyDomain ?? null,
      location: job.location ?? null,
      employmenttype: job.employmentType ?? null,
      url: job.url,
      dateposted: job.datePosted ?? null,
      salary: salaryString ?? null,
      source: job.source,
      extractedat: job.extractedAt,
      status: job.status ?? null,
      description: job.description ?? null,
      // Write worker_id so we know exactly which extension scraped this job
      worker_id: job.workerId ?? (job as any).worker_id ?? null,
      category: (job as any).category ?? null,
      client: (job as any).client ?? null,
    };
  }

  /**
   * Generate unique ID from job identifiers
   */
  private generateId(url: string, title: string, company: string): string {
    const str = `${url}|${title}|${company}`;
    // Simple hash for ID generation
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Upsert multiple jobs to Supabase.
   * Accepts an optional workerId that stamps the extension name onto every row.
   * Uses batch processing to avoid rate limits.
   */
  async upsertJobs(jobs: JobData[], workerId?: string): Promise<SupabaseResponse<{ inserted: number; failed: number }>> {
    if (!jobs || jobs.length === 0) {
      return { data: { inserted: 0, failed: 0 }, error: null };
    }

    try {
      const batchSize = 100; // Process in batches of 100
      let totalInserted = 0;
      let totalFailed = 0;

      for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        // Stamp worker_id onto each job before formatting
        const supabaseJobs = batch.map(job => this.formatJob({ ...job, workerId: workerId ?? (job as any).workerId }));

        const response = await fetch(`${this.baseUrl}/rest/v1/jobs`, {
          method: 'POST',
          headers: {
            'apikey': this.apiKey,
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify(supabaseJobs),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok || response.status === 201) {
          totalInserted += batch.length;
          console.log(`[Supabase] Upserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} jobs`);
        } else {
          totalFailed += batch.length;
          const errorText = await response.text();
          console.error(`[Supabase] Batch ${Math.floor(i / batchSize) + 1} failed:`, errorText);
        }
      }

      return {
        data: { inserted: totalInserted, failed: totalFailed },
        error: totalFailed > 0 ? `${totalFailed} jobs failed to sync` : null,
      };
    } catch (error) {
      console.error('[Supabase] Upsert error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get all jobs from Supabase
   */
  async getJobs(options?: { limit?: number; offset?: number }): Promise<SupabaseResponse<SupabaseJob[]>> {
    try {
      let url = `${this.baseUrl}/rest/v1/jobs?order=extractedat.desc`;
      if (options?.limit) url += `&limit=${options.limit}`;
      if (options?.offset) url += `&offset=${options.offset}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('[Supabase] Get jobs error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Query jobs with server-side filtering, sorting, and pagination.
   * Returns the current page of data plus the total count.
   */
  async queryJobs(options: {
    search?: string;
    source?: string;
    workerId?: string;
    client?: string;
    categories?: string[];
    sortBy?: 'newest' | 'oldest' | 'title' | 'company';
    limit: number;
    offset: number;
  }): Promise<SupabaseResponse<SupabaseJob[]> & { total: number }> {
    try {
      const { search, source, workerId, client, categories, sortBy = 'newest', limit, offset } = options;

      const params: string[] = [];

      // Search filter – PostgREST OR across title, company, location
      if (search && search.trim()) {
        const q = encodeURIComponent(`%${search.trim()}%`);
        params.push(`or=(title.ilike.${q},company.ilike.${q},location.ilike.${q})`);
      }

      // Source filter
      if (source && source !== 'all') {
        params.push(`source=eq.${encodeURIComponent(source)}`);
      }

      // Worker ID filter — isolate jobs from a specific extension
      if (workerId && workerId !== 'all') {
        params.push(`worker_id=eq.${encodeURIComponent(workerId)}`);
      }

      // Client filter
      if (client && client !== 'all') {
        params.push(`client=eq.${encodeURIComponent(client)}`);
      }

      // Category filter
      if (categories && categories.length > 0) {
        // PostgREST IN syntax requires comma-separated values, optionally quoted
        // Example: category=in.("IT, Tech","Retail")
        const catString = categories.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
        params.push(`category=in.(${encodeURIComponent(catString)})`);
      }

      // Sort
      const sortMap: Record<string, string> = {
        newest:  'extractedat.desc',
        oldest:  'extractedat.asc',
        title:   'title.asc',
        company: 'company.asc',
      };
      params.push(`order=${sortMap[sortBy] ?? 'extractedat.desc'}`);

      // Pagination
      params.push(`limit=${limit}`);
      params.push(`offset=${offset}`);

      const url = `${this.baseUrl}/rest/v1/jobs?${params.join('&')}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          // Ask Supabase to return the total row count in Content-Range header
          'Prefer': 'count=exact',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error('[Supabase] queryJobs error body:', body);
        return { data: null, error: `HTTP ${response.status}: ${body}`, total: 0 };
      }

      // Parse total from Content-Range: 0-49/12345
      const contentRange = response.headers.get('content-range') ?? '';
      const total = contentRange.includes('/')
        ? parseInt(contentRange.split('/').pop() ?? '0', 10)
        : 0;

      const data: SupabaseJob[] = await response.json();
      return { data, error: null, total };
    } catch (error) {
      console.error('[Supabase] queryJobs error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error', total: 0 };
    }
  }

  /**
   * Get jobs by company
   */
  async getJobsByCompany(company: string): Promise<SupabaseResponse<SupabaseJob[]>> {
    try {
      const url = `${this.baseUrl}/rest/v1/jobs?company=eq.${encodeURIComponent(company)}&order=extractedat.desc`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('[Supabase] Get jobs by company error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get jobs by source
   */
  async getJobsBySource(source: string): Promise<SupabaseResponse<SupabaseJob[]>> {
    try {
      const url = `${this.baseUrl}/rest/v1/jobs?source=eq.${encodeURIComponent(source)}&order=extractedat.desc`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('[Supabase] Get jobs by source error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Delete jobs by IDs
   */
  async deleteJobs(ids: string[]): Promise<SupabaseResponse<{ deleted: number }>> {
    if (!ids || ids.length === 0) {
      return { data: { deleted: 0 }, error: null };
    }

    try {
      // Supabase REST API supports IN filter
      const url = `${this.baseUrl}/rest/v1/jobs?id=in.(${ids.join(',')})`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Prefer': 'return=representation',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}` };
      }

      return { data: { deleted: ids.length }, error: null };
    } catch (error) {
      console.error('[Supabase] Delete jobs error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Given a list of job IDs, return the subset that already exist in Supabase.
   * Used for deduplication — lets the scraper skip jobs saved in previous runs.
   * Works across all worker nodes since Supabase is the shared source of truth.
   */
  async checkExistingIds(ids: string[]): Promise<Set<string>> {
    if (!ids || ids.length === 0) return new Set();
    try {
      // PostgREST IN filter: id=in.(id1,id2,...)
      const idList = ids.join(',');
      const url = `${this.baseUrl}/rest/v1/jobs?select=id&id=in.(${idList})&limit=${ids.length}`;
      const res = await fetch(url, {
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return new Set();
      const rows: { id: string }[] = await res.json();
      return new Set(rows.map(r => r.id));
    } catch {
      // Network failure — treat all as new (safe fallback, may re-upsert but won't miss data)
      return new Set();
    }
  }

  /**
   * Get all distinct worker_ids from the jobs table.
   * Used to populate the "Filter by Extension" dropdown on the Export page.
   */
  async getUniqueWorkers(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/rest/v1/jobs?select=worker_id&worker_id=not.is.null&limit=5000`;
      const res = await fetch(url, {
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      const rows: { worker_id: string }[] = await res.json();
      return Array.from(new Set(rows.map(r => r.worker_id).filter(Boolean))).sort();
    } catch {
      return [];
    }
  }

  /**
   * Get job count
   */
  async getJobCount(): Promise<SupabaseResponse<{ count: number }>> {
    try {
      const url = `${this.baseUrl}/rest/v1/jobs?select=count`;

      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Prefer': 'count=exact',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}` };
      }

      const count = response.headers.get('content-range');
      const total = count ? parseInt(count.split('/').pop() || '0', 10) : 0;

      return { data: { count: total }, error: null };
    } catch (error) {
      console.error('[Supabase] Get job count error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Enqueue bulk search tasks
   */
  async enqueueTasks(titles: string[], assigned_to?: string, location?: string, client_id?: string, target_site?: string): Promise<SupabaseResponse<{ inserted: number }>> {
    if (!titles || titles.length === 0) return { data: { inserted: 0 }, error: null };
    
    const records = titles.map(title => ({
      job_title: title.trim(),
      status: 'pending',
      assigned_to: assigned_to || null,
      location: location || null,
      client_id: client_id || null,
      target_site: target_site || null
    }));

    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/BulkQueue`, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(records)
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}` };
      }

      return { data: { inserted: records.length }, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Fetch pending task and lock it atomically
   */
  async fetchNextTaskAndLock(workerId: string): Promise<SupabaseResponse<BulkQueueRecord>> {
    try {
      // Find one pending or failed task (anyone can pick up failed tasks to retry)
      const url = `${this.baseUrl}/rest/v1/BulkQueue?select=*&status=in.(pending,failed)&order=created_at.asc&limit=1`;
      
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
      const data = await res.json();
      if (!data || data.length === 0) return { data: null, error: null }; // No tasks

      const task = data[0];

      // Lock it atomically with patch where status was either pending or failed.
      // We claim the assignment simply by setting assigned_to.
      const lockRes = await fetch(`${this.baseUrl}/rest/v1/BulkQueue?id=eq.${task.id}&status=in.(pending,failed)`, {
        method: 'PATCH',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          status: 'running',
          assigned_to: workerId,
          started_at: new Date().toISOString()
        })
      });

      if (!lockRes.ok) return { data: null, error: `Failed to lock` };
      const lockedData = await lockRes.json();
      if (!lockedData || lockedData.length === 0) return { data: null, error: null }; // Someone else took it right before us

      return { data: lockedData[0], error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Mark task complete or failed
   */
  async markTaskComplete(taskId: string, failed: boolean = false): Promise<SupabaseResponse<boolean>> {
    try {
      const res = await fetch(`${this.baseUrl}/rest/v1/BulkQueue?id=eq.${taskId}`, {
        method: 'PATCH',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          status: failed ? 'failed' : 'completed',
          completed_at: new Date().toISOString()
        })
      });
      return { data: res.ok, error: res.ok ? null : `HTTP ${res.status}` };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get queue status for dashboard
   */
  async getQueueStatus(): Promise<SupabaseResponse<BulkQueueRecord[]>> {
    try {
      const url = `${this.baseUrl}/rest/v1/BulkQueue?order=created_at.desc&limit=1000`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        }
      });
      if (!response.ok) return { data: null, error: `HTTP ${response.status}` };
      return { data: await response.json(), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Reset all completed BulkQueue tasks back to pending.
   * Called once per calendar day so the same job titles are re-scraped daily.
   * Clears assigned_to / started_at / completed_at so any node can pick them up fresh.
   */
  async resetCompletedTasks(): Promise<SupabaseResponse<{ reset: boolean }>> {
    try {
      const res = await fetch(`${this.baseUrl}/rest/v1/BulkQueue?status=in.(completed,failed)`, {
        method: 'PATCH',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          status: 'pending',
          assigned_to: null,
          started_at: null,
          completed_at: null,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
      return { data: { reset: true }, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Delete a specific queue task
   */
  async deleteQueueTask(id: string): Promise<SupabaseResponse<{ deleted: boolean }>> {
    try {
      const res = await fetch(`${this.baseUrl}/rest/v1/BulkQueue?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
      return { data: { deleted: true }, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update a specific queue task
   */
  async updateQueueTask(id: string, updates: Partial<BulkQueueRecord>): Promise<SupabaseResponse<{ updated: boolean }>> {
    try {
      const res = await fetch(`${this.baseUrl}/rest/v1/BulkQueue?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(updates),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
      return { data: { updated: true }, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update location for all queue tasks
   */
  async updateQueueLocation(location: string): Promise<SupabaseResponse<{ updated: boolean }>> {
    try {
      const res = await fetch(`${this.baseUrl}/rest/v1/BulkQueue?id=not.is.null`, {
        method: 'PATCH',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          location: location || null
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
      return { data: { updated: true }, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Heartbeat to register active extensions 
   */
  async pingAgent(workerId: string, workerName: string): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/rest/v1/ActiveAgents`, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          worker_id: workerId,
          worker_name: workerName || 'Anonymous Node',
          last_ping: new Date().toISOString()
        })
      });
      if (!res.ok) console.error('[Supabase] Heartbeat error:', await res.text());
    } catch (e) {
      console.error('[Supabase] Heartbeat crash:', e);
    }
  }

  /**
   * Get active agents for dashboard
   */
  async getActiveAgents(): Promise<SupabaseResponse<any[]>> {
    try {
      const res = await fetch(`${this.baseUrl}/rest/v1/ActiveAgents?select=*&order=last_ping.desc`, {
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
      return { data: await res.json(), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  private readonly SESSION_KEY = 'recruitscout_auth_session';

  /**
   * Sign in with email and password via Supabase Auth.
   * On success the session is persisted to localStorage.
   */
  async signIn(email: string, password: string): Promise<{ session: any; error: string | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return {
          session: null,
          error: err.error_description || err.msg || `HTTP ${response.status}: Invalid credentials`,
        };
      }

      const session = await response.json();
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      return { session, error: null };
    } catch (error) {
      return { session: null, error: error instanceof Error ? error.message : 'Sign in failed' };
    }
  }

  /**
   * Request a password reset email.
   * If redirectTo is provided, Supabase appends it to the recovery link in the email.
   */
  async resetPasswordForEmail(email: string, redirectTo?: string): Promise<{ error: string | null }> {
    try {
      const url = new URL(`${this.baseUrl}/auth/v1/recover`);
      if (redirectTo) {
        url.searchParams.append('redirect_to', redirectTo);
      }
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { error: err.error_description || err.msg || `HTTP ${response.status}: Failed to send reset email` };
      }

      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to send reset email' };
    }
  }

  /**
   * Update the user's password using the access token obtained from the recovery email.
   */
  async updateUserPassword(password: string, accessToken: string): Promise<{ error: string | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { error: err.error_description || err.msg || `HTTP ${response.status}: Failed to update password` };
      }

      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to update password' };
    }
  }

  /**
   * Retrieves user details (like email) using an access token (e.g. from an invite link).
   */
  async getUserByToken(accessToken: string): Promise<{ user: any; error: string | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { user: null, error: err.error_description || err.msg || `HTTP ${response.status}: Failed to fetch user` };
      }

      const user = await response.json();
      return { user, error: null };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error.message : 'Failed to fetch user' };
    }
  }

  /**
   * Sign out — clears the stored session.
   */
  signOut(): void {
    localStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Returns the stored session if it is still valid, or null if missing/expired.
   */
  getSession(): any | null {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      // expires_at is in Unix seconds
      if (session.expires_at && Date.now() / 1000 > session.expires_at) {
        localStorage.removeItem(this.SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Get user integrations (e.g., Blue.cc credentials) for the current user
   */
  async getUserIntegration(userId: string): Promise<SupabaseResponse<any>> {
    try {
      // Must use authenticated token, not just apikey, to bypass RLS properly
      const session = this.getSession();
      const token = session?.access_token || this.apiKey;
      
      const response = await fetch(`${this.baseUrl}/rest/v1/user_integrations?user_id=eq.${userId}&select=*`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}: ${await response.text()}` };
      }

      const data = await response.json();
      return { data: data[0] || null, error: null };
    } catch (error) {
      console.error('[Supabase] Get user integration error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Upsert user integrations
   */
  async upsertUserIntegration(integration: any): Promise<SupabaseResponse<any>> {
    try {
      const session = this.getSession();
      const token = session?.access_token || this.apiKey;

      const response = await fetch(`${this.baseUrl}/rest/v1/user_integrations`, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(integration),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}: ${await response.text()}` };
      }

      const data = await response.json();
      return { data: data[0], error: null };
    } catch (error) {
      console.error('[Supabase] Upsert user integration error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check if Supabase connection is working
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/jobs?select=count&limit=0`, {
        method: 'HEAD',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Prefer': 'count=exact',
        },
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get all clients from Supabase
   */
  async getClients(): Promise<SupabaseResponse<SupabaseClientRecord[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/clients?order=created_at.desc`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}: ${await response.text()}` };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('[Supabase] Get clients error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Enroll a new client in Supabase
   */
  async enrollClient(client: SupabaseClientRecord): Promise<SupabaseResponse<SupabaseClientRecord>> {
    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/clients`, {
        method: 'POST',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify([client]),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}: ${await response.text()}` };
      }

      const data = await response.json();
      return { data: data[0], error: null };
    } catch (error) {
      console.error('[Supabase] Enroll client error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Delete a client by ID
   */
  async deleteClient(id: string): Promise<SupabaseResponse<{ deleted: boolean }>> {
    try {
      const response = await fetch(`${this.baseUrl}/rest/v1/clients?id=eq.${id}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Prefer': 'return=minimal',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}: ${await response.text()}` };
      }

      return { data: { deleted: true }, error: null };
    } catch (error) {
      console.error('[Supabase] Delete client error:', error);
      return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Fetch all company names from the Spanish_Companies whitelist table.
   * Returns a Set of lowercased names for fast case-insensitive lookups.
   * On any network/DB error, returns an empty Set (which causes the caller
   * to block all Spanish Indeed jobs — the safe "block everything" fallback).
   */
  async getSpanishCompanies(): Promise<Set<string>> {
    try {
      const url = `${this.baseUrl}/rest/v1/Spanish_Companies?select=Compan_Names&limit=5000`;
      const res = await fetch(url, {
        headers: {
          'apikey': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.error(`[Supabase] getSpanishCompanies failed: HTTP ${res.status}`);
        return new Set();
      }

      const rows: { Compan_Names: string }[] = await res.json();
      // Lowercase all names so the filter can do case-insensitive comparison
      const names = new Set(
        rows
          .map(r => r.Compan_Names?.toLowerCase().trim())
          .filter(Boolean) as string[]
      );
      console.log(`[Supabase] Loaded ${names.size} companies from Spanish_Companies whitelist.`);
      return names;
    } catch (error) {
      console.error('[Supabase] getSpanishCompanies error:', error);
      return new Set(); // Block everything on failure
    }
  }
}

// Export singleton instance
export const supabaseClient = new SupabaseClient();
