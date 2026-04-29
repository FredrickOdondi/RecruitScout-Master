import { JobData, MessageType } from '../shared/types';

/**
 * Offscreen document handler
 * Processes heavy tasks that can't be done in content scripts
 */
class OffscreenHandler {
  constructor() {
    this.initialize();
  }

  private initialize(): void {
    console.log('[RecruitScout Offscreen] Initialized');

    // Set up message listeners
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender)
        .then(sendResponse)
        .catch(error => {
          sendResponse({ error: error.message });
        });

      return true;
    });
  }

  private async handleMessage(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    const { type, payload } = message;

    console.log('[RecruitScout Offscreen] Received message:', type);

    switch (type) {
      case 'EXPORT_DATA':
        return await this.exportData(payload);
      case 'PROCESS_DATA':
        return await this.processData(payload);
      case 'EXPORT_CSV':
        return await this.exportCSV(payload);
      case 'EXPORT_JSON':
        return await this.exportJSON(payload);
      case 'EXPORT_XLSX':
        return await this.exportXLSX(payload);
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  private async exportData(payload: any): Promise<Blob> {
    const { jobs, format, fields, includeMetadata } = payload;

    switch (format) {
      case 'csv':
        return await this.exportCSV({ jobs, fields, includeMetadata });
      case 'json':
        return await this.exportJSON({ jobs, includeMetadata });
      case 'xlsx':
        return await this.exportXLSX({ jobs, fields, includeMetadata });
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async processData(payload: any): Promise<any> {
    const { data, operation } = payload;

    switch (operation) {
      case 'filter':
        return this.filterData(data.jobs, data.filters);
      case 'sort':
        return this.sortData(data.jobs, data.sortBy, data.order);
      case 'transform':
        return this.transformData(data.jobs, data.transformFn);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  private async exportCSV(payload: any): Promise<Blob> {
    const { jobs, fields, includeMetadata } = payload;

    if (!jobs || jobs.length === 0) {
      throw new Error('No jobs to export');
    }

    // Filter enabled fields
    const enabledFields = fields.filter((f: { enabled: boolean }) => f.enabled);
    const headers = enabledFields.map((f: { key: string }) => f.key);

    // Build CSV content with UTF-8 BOM
    let csvContent = '\uFEFF';
    csvContent += headers.join(',') + '\n';

    for (const job of jobs) {
      const values = headers.map((header: string) => {
        let value = job[header as keyof JobData];

        if (value === undefined || value === null) {
          return '';
        }

        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }

        value = String(value);

        // Escape CSV values
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }

        return value;
      });

      csvContent += values.join(',') + '\n';
    }

    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  private async exportJSON(payload: any): Promise<Blob> {
    const { jobs, includeMetadata } = payload;

    if (!jobs || jobs.length === 0) {
      throw new Error('No jobs to export');
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalJobs: jobs.length,
      jobs: includeMetadata ? jobs : jobs.map(job => {
        const { metadata, ...rest } = job;
        return rest;
      }),
    };

    const jsonContent = JSON.stringify(exportData, null, 2);

    return new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  }

  private async exportXLSX(payload: any): Promise<Blob> {
    // For now, we'll use a simple CSV-based approach
    // In a production environment, you would use SheetJS or similar
    const { jobs, fields, includeMetadata } = payload;

    if (!jobs || jobs.length === 0) {
      throw new Error('No jobs to export');
    }

    // Filter enabled fields
    const enabledFields = fields.filter((f: { enabled: boolean }) => f.enabled);
    const headers = enabledFields.map((f: { label: string }) => f.label);

    // Build CSV content (XLSX would require additional library)
    let csvContent = '\uFEFF';
    csvContent += headers.join(',') + '\n';

    for (const job of jobs) {
      const values = enabledFields.map((field: { key: string }) => {
        let value = job[field.key as keyof JobData];

        if (value === undefined || value === null) {
          return '';
        }

        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }

        value = String(value);

        // Escape CSV values
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }

        return value;
      });

      csvContent += values.join(',') + '\n';
    }

    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  }

  private filterData(jobs: JobData[], filters: any): JobData[] {
    return jobs.filter(job => {
      // Apply filters
      if (filters.search && !this.matchesSearch(job, filters.search)) {
        return false;
      }

      if (filters.companies && filters.companies.length > 0) {
        if (!filters.companies.includes(job.company)) {
          return false;
        }
      }

      if (filters.locations && filters.locations.length > 0) {
        if (!filters.locations.some(loc => job.location.includes(loc))) {
          return false;
        }
      }

      if (filters.employmentTypes && filters.employmentTypes.length > 0) {
        if (!filters.employmentTypes.includes(job.employmentType)) {
          return false;
        }
      }

      if (filters.minSalary && job.salary) {
        if (!job.salary.min || job.salary.min < filters.minSalary) {
          return false;
        }
      }

      if (filters.maxSalary && job.salary) {
        if (!job.salary.max || job.salary.max > filters.maxSalary) {
          return false;
        }
      }

      return true;
    });
  }

  private matchesSearch(job: JobData, search: string): boolean {
    const searchLower = search.toLowerCase();
    const searchableFields = [
      job.title,
      job.company,
      job.location,
      job.description,
      job.url,
    ].join(' ').toLowerCase();

    return searchableFields.includes(searchLower);
  }

  private sortData(
    jobs: JobData[],
    sortBy: keyof JobData,
    order: 'asc' | 'desc'
  ): JobData[] {
    return [...jobs].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return order === 'asc' ? comparison : -comparison;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }

  private transformData(jobs: JobData[], transformFn: string): JobData[] {
    // In a real implementation, you'd safely evaluate the transform function
    // For now, we'll just return the jobs as-is
    return jobs;
  }
}

// Initialize offscreen handler
new OffscreenHandler();

export { OffscreenHandler };
