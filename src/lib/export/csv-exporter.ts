import { JobData } from '../../shared/types';
import { escapeCSVValue, truncateText } from '../../shared/utils';

export interface CSVExportOptions {
  includeHeaders?: boolean;
  includeMetadata?: boolean;
  fields?: (keyof JobData)[];
  headers?: string[];
}

/**
 * CSV Exporter
 * Generate CSV with UTF-8 BOM and proper escaping
 */
export class CSVExporter {
  /**
   * Export jobs to CSV format
   */
  static export(jobs: JobData[], options: CSVExportOptions = {}): string {
    const {
      includeHeaders = true,
      includeMetadata = false,
      fields,
    } = options;

    const exportFields = fields || this.getDefaultFields();
    let csv = '';

    // Add UTF-8 BOM
    csv += '\uFEFF';

    // Add headers
    if (includeHeaders) {
      const headerRow = options.headers || exportFields;
      csv += headerRow.join(',') + '\n';
    }

    // Add data rows
    for (const job of jobs) {
      const values = exportFields.map(field => {
        let value: any;

        if (field === 'salary' && job.salary) {
          value = this.formatSalary(job.salary);
        } else if (field === 'description' && !includeMetadata && job.description) {
          value = truncateText(job.description.replace(/[\r\n]+/g, ' '), 500);
        } else {
          value = job[field];
        }

        return escapeCSVValue(String(value ?? ''));
      });

      csv += values.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Export jobs to CSV and create download
   */
  static download(jobs: JobData[], filename?: string, options?: CSVExportOptions): void {
    const csv = this.export(jobs, options);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = filename || `recruitscout-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    URL.revokeObjectURL(link.href);
  }

  /**
   * Get default export fields
   */
  private static getDefaultFields(): (keyof JobData)[] {
    return [
      'title',
      'company',
      'companyDomain',
      'location',
      'employmentType',
      'url',
      'datePosted',
      'salary',
      'source',
      'extractedAt',
      'status',
    ];
  }

  /**
   * Format salary for CSV
   */
  private static formatSalary(salary: NonNullable<JobData['salary']>): string {
    const parts: string[] = [];

    if (salary.min) parts.push(`$${salary.min.toLocaleString()}`);
    if (salary.max) parts.push(`$${salary.max.toLocaleString()}`);
    if (salary.currency) parts.push(salary.currency);
    if (salary.period) parts.push(`/${salary.period}`);

    return parts.join(' ');
  }

  /**
   * Parse CSV string to array of objects
   */
  static parse(csv: string): Record<string, string>[] {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = this.parseCSVLine(lines[0]);
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      data.push(row);
    }

    return data;
  }

  /**
   * Parse a single CSV line
   */
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }
}
