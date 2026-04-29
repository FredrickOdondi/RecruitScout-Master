import { JobData } from '../../shared/types';
import { CSVExporter } from './csv-exporter';
import { escapeCSVValue, truncateText } from '../../shared/utils';

export interface XLSXExportOptions {
  includeHeaders?: boolean;
  includeMetadata?: boolean;
  fields?: (keyof JobData)[];
  headers?: string[];
  sheetName?: string;
}

/**
 * XLSX Exporter
 * Note: This is a simplified implementation that generates a CSV with .xlsx extension.
 * For true XLSX support, consider adding SheetJS (xlsx) library to dependencies.
 */
export class XLSXExporter {
  /**
   * Export jobs to XLSX format (CSV-based)
   */
  static export(jobs: JobData[], options: XLSXExportOptions = {}): string {
    const {
      includeHeaders = true,
      includeMetadata = false,
      fields,
      sheetName = 'Jobs',
    } = options;

    // Generate CSV content
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
   * Export jobs to XLSX and create download
   */
  static download(jobs: JobData[], filename?: string, options?: XLSXExportOptions): void {
    const content = this.export(jobs, options);
    const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = filename || `recruitscout-${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();

    URL.revokeObjectURL(link.href);
  }

  /**
   * Export jobs with multiple sheets (CSV-based)
   */
  static exportMultipleSheets(data: Record<string, JobData[]>, options?: XLSXExportOptions): string {
    // For CSV-based approach, we'll create separate sections
    let csv = '';
    let isFirstSheet = true;

    for (const [sheetName, jobs] of Object.entries(data)) {
      if (!isFirstSheet) {
        csv += '\n\n'; // Separator between sheets
      }
      csv += `Sheet: ${sheetName}\n`;
      csv += this.export(jobs, { ...options, includeHeaders: true });
      isFirstSheet = false;
    }

    return csv;
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
   * Format salary for XLSX
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
   * Generate a simple Excel XML format (alternative approach)
   */
  static exportAsExcelXML(jobs: JobData[], options?: XLSXExportOptions): string {
    const {
      includeHeaders = true,
      fields,
      sheetName = 'Jobs',
    } = options;

    const exportFields = fields || this.getDefaultFields();

    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Created>2006-09-13T11:21:51Z</Created>
 </DocumentProperties>
 <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
  <WindowHeight>9000</WindowHeight>
  <WindowWidth>13860</WindowWidth>
  <WindowTopX>240</WindowTopX>
  <WindowTopY>75</WindowTopY>
  <ProtectStructure>False</ProtectStructure>
  <ProtectWindows>False</ProtectWindows>
 </ExcelWorkbook>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
   <Interior ss:Color="#D9E2F3" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${this.escapeXML(sheetName)}">
  <Table>
`;

    // Add headers
    if (includeHeaders) {
      xml += '   <Row>\n';
      const headerRow = options.headers || exportFields;
      headerRow.forEach(header => {
        xml += `    <Cell ss:StyleID="Header"><Data ss:Type="String">${this.escapeXML(header)}</Data></Cell>\n`;
      });
      xml += '   </Row>\n';
    }

    // Add data rows
    for (const job of jobs) {
      xml += '   <Row>\n';
      exportFields.forEach(field => {
        let value: any = job[field];
        const type = this.getCellType(field, value);

        if (field === 'salary' && job.salary) {
          value = this.formatSalary(job.salary);
        } else if (field === 'description' && job.description) {
          value = truncateText(job.description.replace(/[\r\n]+/g, ' '), 500);
        }

        xml += `    <Cell><Data ss:Type="${type}">${this.escapeXML(String(value ?? ''))}</Data></Cell>\n`;
      });
      xml += '   </Row>\n';
    }

    xml += `  </Table>
 </Worksheet>
</Workbook>`;

    return xml;
  }

  /**
   * Get cell type for Excel XML
   */
  private static getCellType(field: keyof JobData, value: any): string {
    if (field === 'salary' || field === 'datePosted' || field === 'extractedAt') {
      return 'String';
    }
    if (typeof value === 'number') {
      return 'Number';
    }
    return 'String';
  }

  /**
   * Escape XML special characters
   */
  private static escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Download as Excel XML file
   */
  static downloadAsExcelXML(jobs: JobData[], filename?: string, options?: XLSXExportOptions): void {
    const xml = this.exportAsExcelXML(jobs, options);
    const blob = new Blob([xml], { type: 'application/xml' });
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = filename || `recruitscout-${new Date().toISOString().split('T')[0]}.xls`;
    link.click();

    URL.revokeObjectURL(link.href);
  }
}

export { CSVExporter };
