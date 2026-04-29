import { JobData } from '../../shared/types';

export interface JSONExportOptions {
  includeMetadata?: boolean;
  pretty?: boolean;
  includeTimestamp?: boolean;
  wrapInObject?: boolean;
}

/**
 * JSON Exporter
 * Generate structured JSON with data types preserved
 */
export class JSONExporter {
  /**
   * Export jobs to JSON format
   */
  static export(jobs: JobData[], options: JSONExportOptions = {}): string {
    const {
      includeMetadata = false,
      pretty = true,
      includeTimestamp = true,
      wrapInObject = true,
    } = options;

    const exportData: any = wrapInObject ? {} : [];

    if (wrapInObject) {
      exportData.exportedAt = includeTimestamp ? new Date().toISOString() : undefined;
      exportData.totalJobs = jobs.length;
      exportData.jobs = this.processJobs(jobs, includeMetadata);
    } else {
      const processed = this.processJobs(jobs, includeMetadata);
      Object.assign(exportData, processed);
    }

    return JSON.stringify(exportData, null, pretty ? 2 : 0);
  }

  /**
   * Export jobs to JSON and create download
   */
  static download(jobs: JobData[], filename?: string, options?: JSONExportOptions): void {
    const json = this.export(jobs, options);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = filename || `recruitscout-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(link.href);
  }

  /**
   * Process jobs for export
   */
  private static processJobs(jobs: JobData[], includeMetadata: boolean): any[] {
    return jobs.map(job => {
      const processed: any = {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
      };

      // Optional fields
      if (job.companyDomain) processed.companyDomain = job.companyDomain;
      if (job.locationType) processed.locationType = job.locationType;
      if (job.employmentType) processed.employmentType = job.employmentType;
      if (job.salary) processed.salary = this.processSalary(job.salary);
      if (job.datePosted) processed.datePosted = job.datePosted;
      if (job.postedAgo) processed.postedAgo = job.postedAgo;
      if (job.source) processed.source = job.source;
      if (job.extractedAt) processed.extractedAt = job.extractedAt;
      if (job.status) processed.status = job.status;

      // Description
      if (job.description) {
        processed.description = job.description;
      }

      // Metadata
      if (includeMetadata && job.metadata) {
        processed.metadata = job.metadata;
      }

      return processed;
    });
  }

  /**
   * Process salary for export
   */
  private static processSalary(salary: NonNullable<JobData['salary']>): any {
    return {
      min: salary.min,
      max: salary.max,
      currency: salary.currency,
      period: salary.period,
      ...(salary.raw && { raw: salary.raw }),
    };
  }

  /**
   * Parse JSON string to jobs
   */
  static parse(json: string): JobData[] {
    try {
      const data = JSON.parse(json);
      const jobs = Array.isArray(data) ? data : data.jobs || [];
      return jobs.map(this.parseJob);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return [];
    }
  }

  /**
   * Parse a single job from JSON
   */
  private static parseJob(data: any): JobData {
    return {
      id: data.id,
      title: data.title,
      company: data.company,
      companyDomain: data.companyDomain,
      location: data.location,
      locationType: data.locationType,
      employmentType: data.employmentType,
      description: data.description,
      url: data.url,
      salary: data.salary,
      datePosted: data.datePosted,
      datePostedRaw: data.datePostedRaw,
      postedAgo: data.postedAgo,
      source: data.source,
      extractedAt: data.extractedAt,
      status: data.status,
      metadata: data.metadata,
    };
  }

  /**
   * Validate JSON export
   */
  static validate(json: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const data = JSON.parse(json);

      if (Array.isArray(data)) {
        data.forEach((job, index) => this.validateJob(job, index, errors));
      } else if (data.jobs) {
        data.jobs.forEach((job: any, index: number) => this.validateJob(job, index, errors));
      } else {
        errors.push('Invalid JSON structure: expected array or object with "jobs" property');
      }
    } catch (error) {
      errors.push(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a single job
   */
  private static validateJob(job: any, index: number, errors: string[]): void {
    if (!job.id) errors.push(`Job ${index}: Missing id`);
    if (!job.title) errors.push(`Job ${index}: Missing title`);
    if (!job.url) errors.push(`Job ${index}: Missing url`);
  }
}
