import { JobData } from '../../shared/types';

export class GoogleSheetsClient {
  /**
   * Format jobs into a 2D array matching the headers you want in the Sheet
   */
  private sanitizeForSheets(text: string | undefined | null): string {
    if (!text) return '';
    let cleanText = typeof text === 'string' ? text.trim() : String(text).trim();
    
    // Prevent Google Sheets from interpreting text as a formula
    if (/^[=+\-@]/.test(cleanText)) {
      cleanText = "'" + cleanText;
    }
    
    // Google Sheets cell limit is 50,000 characters
    if (cleanText.length > 49000) {
      cleanText = cleanText.substring(0, 49000) + '\n...[Truncated to fit Google Sheets limits]';
    }
    
    return cleanText;
  }

  private formatJobs(jobs: JobData[]): any[][] {
    const headers = [
      'job_title',
      'company',
      'company_domain',
      'job_location',
      'description',
      'job_post_url',
      'date_posted',
      'employment_type',
      'salary',
      'status',
      'source'
    ];

    const rows = jobs.map(job => {
      let salaryString = '';
      if (job.salary) {
        const parts: string[] = [];
        if (job.salary.min) parts.push(`$${job.salary.min.toLocaleString()}`);
        if (job.salary.max) parts.push(`$${job.salary.max.toLocaleString()}`);
        if (job.salary.currency) parts.push(job.salary.currency);
        if (job.salary.period) parts.push(`/${job.salary.period}`);
        salaryString = parts.join(' ') || job.salary.raw || '';
      }

      return [
        this.sanitizeForSheets(job.title),
        this.sanitizeForSheets(job.company),
        this.sanitizeForSheets(job.companyDomain),
        this.sanitizeForSheets(job.location),
        this.sanitizeForSheets(job.description),
        job.url || '',
        this.sanitizeForSheets(job.datePosted),
        this.sanitizeForSheets(job.employmentType),
        this.sanitizeForSheets(salaryString),
        this.sanitizeForSheets(job.status),
        this.sanitizeForSheets(job.source)
      ];
    });

    return [headers, ...rows];
  }

  /**
   * Syncs jobs to the specified Google Apps Script Web App Endpoint
   */
  async syncJobs(jobs: JobData[], config: { webAppUrl: string; spreadsheetId: string; sheetName: string }) {
    if (!jobs || jobs.length === 0) return { data: null, error: 'No jobs to sync' };
    if (!config || !config.webAppUrl) return { data: null, error: 'Missing Web App URL' };

    try {
      const payload = {
        spreadsheetId: config.spreadsheetId,
        sheetName: config.sheetName,
        data: this.formatJobs(jobs)
      };

      const response = await fetch(config.webAppUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });

      // With no-cors, the response is opaque, so we can't read response.json() or response.ok.
      // If fetch doesn't throw a network exception, we assume the data was sent successfully.
      return { data: { inserted: jobs.length }, error: null };

    } catch (error: any) {
      console.error('[Google Sheets] Sync error:', error);
      return { data: null, error: error.message || 'Network error occurred' };
    }
  }
}

export const googleSheetsClient = new GoogleSheetsClient();
