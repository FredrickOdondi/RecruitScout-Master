import { JobData, SalaryInfo } from '../../shared/types';
import { extractText, safeJsonParse, generateCompanyDomain } from '../../shared/utils';

/**
 * Schema.org JobPosting parser
 * Extracts structured data from JSON-LD script blocks
 */
export class SchemaParser {
  /**
   * Parse all JSON-LD script blocks on the page
   */
  static parseAll(): JobData[] {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const jobs: JobData[] = [];

    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '');
        const parsedJobs = this.parseFromData(data);
        jobs.push(...parsedJobs);
      } catch (error) {
        // Ignore invalid JSON
      }
    });

    return jobs;
  }

  /**
   * Parse jobs from JSON-LD data
   */
  private static parseFromData(data: any): JobData[] {
    // Handle array of job postings
    if (Array.isArray(data)) {
      const jobs: JobData[] = [];
      data.forEach(item => {
        const parsed = this.parseJobPosting(item);
        if (parsed) jobs.push(parsed);
      });
      return jobs;
    }

    // Handle single job posting
    const job = this.parseJobPosting(data);
    return job ? [job] : [];
  }

  /**
   * Parse a single JobPosting
   */
  private static parseJobPosting(data: any): JobData | null {
    if (!data || data['@type'] !== 'JobPosting') {
      return null;
    }

    const title = data.title || data.name;
    const company = data.hiringOrganization?.name || data.hiringOrganization;
    const location = this.parseLocation(data.jobLocation);
    const description = this.parseDescription(data.description);
    const url = data.url || window.location.href;
    const salary = this.parseSalary(data);

    if (!title) return null;

    const companyText = company ? extractText({ textContent: company } as Element) : 'Unknown';
    let companyDomain = data.hiringOrganization?.url || data.hiringOrganization?.sameAs;

    return {
      id: this.generateId(url),
      title: extractText({ textContent: title } as Element),
      company: companyText,
      companyDomain,
      location: extractText({ textContent: location } as Element),
      locationType: data.jobLocationType?.toLowerCase(),
      // @ts-ignore - Type may not match enum exactly
      employmentType: this.parseEmploymentType(data.employmentType),
      description,
      url,
      salary,
      datePosted: data.datePosted,
      datePostedRaw: data.datePosted,
      source: this.extractSource(),
      extractedAt: new Date().toISOString(),
      metadata: {
        schema: data,
      },
      status: 'active',
    };
  }

  /**
   * Parse location from jobLocation
   */
  private static parseLocation(jobLocation: any): string {
    if (!jobLocation) return 'Unknown';

    // Handle direct string
    if (typeof jobLocation === 'string') {
      return jobLocation;
    }

    // Handle Place object
    if (jobLocation['@type'] === 'Place') {
      const address = jobLocation.address;
      if (address) {
        const parts = [address.streetAddress, address.addressLocality, address.addressRegion, address.postalCode];
        return parts.filter(Boolean).join(', ');
      }
      return jobLocation.name || 'Unknown';
    }

    return 'Unknown';
  }

  /**
   * Parse description
   */
  private static parseDescription(description: any): string | undefined {
    if (!description) return undefined;

    if (typeof description === 'string') {
      return description;
    }

    return JSON.stringify(description);
  }

  /**
   * Parse salary information
   */
  private static parseSalary(data: any): SalaryInfo | undefined {
    const baseSalary = data.baseSalary || data.salaryCurrency;

    if (!baseSalary) return undefined;

    const min = baseSalary.value?.min || baseSalary.minValue;
    const max = baseSalary.value?.max || baseSalary.maxValue;
    const currency = baseSalary.currency || data.salaryCurrency;

    // Parse period from unitText or employmentType
    const period = this.parseSalaryPeriod(baseSalary.unitText || data.unitText);

    return {
      min: min ? parseFloat(min) : undefined,
      max: max ? parseFloat(max) : undefined,
      currency,
      period,
      raw: baseSalary.value || baseSalary,
    };
  }

  /**
   * Parse salary period
   */
  private static parseSalaryPeriod(unitText: string | undefined): SalaryInfo['period'] {
    if (!unitText) return undefined;

    const text = unitText.toLowerCase();
    if (text.includes('hour')) return 'hourly';
    if (text.includes('month')) return 'monthly';
    if (text.includes('year') || text.includes('annually')) return 'yearly';
    if (text.includes('week')) return 'weekly';

    return undefined;
  }

  /**
   * Parse employment type
   */
  private static parseEmploymentType(employmentType: any): string | undefined {
    if (!employmentType) return undefined;

    if (typeof employmentType === 'string') {
      return employmentType.toLowerCase();
    }

    if (Array.isArray(employmentType)) {
      return employmentType.map((t: string) => t.toLowerCase()).join(', ');
    }

    return undefined;
  }

  /**
   * Generate ID from URL
   */
  private static generateId(url: string): string {
    // Extract meaningful part of URL for ID
    const urlParts = url.split('/').filter(Boolean);
    const lastPart = urlParts[urlParts.length - 1];
    return lastPart || url;
  }

  /**
   * Extract source from current page
   */
  private static extractSource(): string {
    const hostname = window.location.hostname;
    return hostname.replace('www.', '');
  }
}
