import { JobData } from '../../shared/types';
import {
  extractText,
  extractAttribute,
  querySelectorSafe,
  querySelectorAllSafe,
  parseDomain,
  generateId,
  extractNumber,
  getRelativeTime,
} from '../../shared/utils';
import { HEURISTIC_SELECTORS, EMPLOYMENT_TYPE_KEYWORDS, LOCATION_TYPE_KEYWORDS } from '../../shared/constants';
import { SalaryParser } from './salary-parser';

/**
 * Field-specific extractors for job data
 */
export class FieldExtractors {
  /**
   * Extract job title
   */
  static extractTitle(container: Element): string {
    const titleElement = querySelectorSafe(container, HEURISTIC_SELECTORS.jobTitle);
    if (titleElement) {
      return extractText(titleElement);
    }

    // Try og:title meta tag
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      return extractAttribute(ogTitle, 'content') || '';
    }

    // Try h1
    const h1 = document.querySelector('h1');
    if (h1) {
      return extractText(h1);
    }

    return '';
  }

  /**
   * Extract company name
   */
  static extractCompany(container: Element): string {
    const companyElement = querySelectorSafe(container, HEURISTIC_SELECTORS.company);
    if (companyElement) {
      return extractText(companyElement);
    }

    // Try og:site_name meta tag
    const ogSite = document.querySelector('meta[property="og:site_name"]');
    if (ogSite) {
      return extractAttribute(ogSite, 'content') || '';
    }

    return 'Unknown';
  }

  /**
   * Extract company domain
   */
  static extractCompanyDomain(container: Element, companyName?: string): string | undefined {
    const companyLink = querySelectorSafe(container, [
      'a[data-testid="company-link"]',
      'a[href*="/company/"]',
      'a[href*="/companies/"]',
    ]);

    if (companyLink) {
      const href = extractAttribute(companyLink, 'href');
      if (href) {
        return parseDomain(href);
      }
    }



    return undefined;
  }

  /**
   * Extract location
   */
  static extractLocation(container: Element): string {
    const locationElement = querySelectorSafe(container, HEURISTIC_SELECTORS.location);
    if (locationElement) {
      return extractText(locationElement);
    }

    return 'Unknown';
  }

  /**
   * Extract location type (remote, hybrid, on-site)
   */
  static extractLocationType(container: Element): string | undefined {
    const location = this.extractLocation(container).toLowerCase();

    for (const [type, keywords] of Object.entries(LOCATION_TYPE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (location.includes(keyword)) {
          return type;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract employment type
   */
  static extractEmploymentType(container: Element): string | undefined {
    const typeElement = querySelectorSafe(container, HEURISTIC_SELECTORS.employmentType);
    if (typeElement) {
      const text = extractText(typeElement).toLowerCase();
      for (const [type, keywords] of Object.entries(EMPLOYMENT_TYPE_KEYWORDS)) {
        for (const keyword of keywords) {
          const regex = new RegExp(`\\b${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
          if (regex.test(text)) return type;
        }
      }
    }

    const items = Array.from(container.querySelectorAll('*')).map(el => extractText(el).toLowerCase());
    for (const [type, keywords] of Object.entries(EMPLOYMENT_TYPE_KEYWORDS)) {
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        for (const text of items) {
          if (regex.test(text) && text.length < 50) {
            return type;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Extract salary
   */
  static extractSalary(container: Element): any {
    const salaryElement = querySelectorSafe(container, HEURISTIC_SELECTORS.salary);
    if (salaryElement) {
      return SalaryParser.parse(extractText(salaryElement)) || undefined;
    }
    
    // Scan all children for salary indicators
    const items = Array.from(container.querySelectorAll('*'))
      .map(el => extractText(el))
      .filter(t => t.length < 100 && (t.includes('$') || t.includes('€') || t.includes('£') || t.toLowerCase().includes('salary') || t.toLowerCase().includes('a year')));
    
    for (const text of items) {
      const salary = SalaryParser.parse(text);
      if (salary) return salary;
    }
    
    return undefined;
  }

  /**
   * Extract job description
   */
  static extractDescription(container: Element): string | undefined {
    const descElement = querySelectorSafe(container, HEURISTIC_SELECTORS.description);
    if (descElement) {
      return extractText(descElement);
    }
    
    const ul = container.querySelector('ul');
    if (ul) {
      return extractText(ul);
    }

    // Try to find largest text block
    const textBlocks = Array.from(container.querySelectorAll('div, section, article'))
      .map(el => ({ el, text: extractText(el) }))
      .filter(({ text }) => text.length > 50)
      .sort((a, b) => b.text.length - a.text.length);

    if (textBlocks.length > 0) {
      return textBlocks[0].text;
    }

    return undefined;
  }

  /**
   * Extract job URL
   */
  static extractUrl(container: Element): string {
    const linkElement = querySelectorSafe(container, HEURISTIC_SELECTORS.jobLink);
    if (linkElement) {
      const href = extractAttribute(linkElement, 'href');
      if (href) {
        return href.startsWith('http') ? href : new URL(href, window.location.origin).href;
      }
    }

    return window.location.href;
  }

  /**
   * Extract date posted
   */
  static extractDatePosted(container: Element): { date?: string; raw?: string; ago?: string } {
    const dateElement = querySelectorSafe(container, HEURISTIC_SELECTORS.datePosted);
    if (dateElement) {
      const raw = extractText(dateElement);
      const ago = raw;
      return { ago, raw };
    }

    // Try to parse from time element
    const timeElement = document.querySelector('time');
    if (timeElement) {
      const datetime = extractAttribute(timeElement, 'datetime');
      if (datetime) {
        return { date: datetime, raw: extractText(timeElement) };
      }
    }

    return {};
  }

  /**
   * Extract job metadata
   */
  static extractMetadata(container: Element): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Extract all data attributes from container and its children
    const elements = [container, ...Array.from(container.querySelectorAll('*'))];
    elements.forEach(el => {
      for (const key of el.getAttributeNames()) {
        if (key.startsWith('data-')) {
          metadata[key] = extractAttribute(el, key);
        }
      }
    });

    return metadata;
  }

  /**
   * Extract job from container element
   */
  static extractJob(container: Element): JobData | null {
    const url = this.extractUrl(container);
    const title = this.extractTitle(container);

    if (!title) return null;

    const company = this.extractCompany(container);
    const dateInfo = this.extractDatePosted(container);

    return {
      id: generateId(),
      title,
      company,
      companyDomain: this.extractCompanyDomain(container, company),
      location: this.extractLocation(container),
      // @ts-ignore - Type may not match enum exactly
      locationType: this.extractLocationType(container),
      // @ts-ignore - Type may not match enum exactly
      employmentType: this.extractEmploymentType(container),
      salary: this.extractSalary(container),
      description: this.extractDescription(container),
      url,
      datePosted: dateInfo.date,
      datePostedRaw: dateInfo.raw,
      postedAgo: dateInfo.ago,
      source: window.location.hostname.replace('www.', ''),
      extractedAt: new Date().toISOString(),
      metadata: this.extractMetadata(container),
      status: 'active',
    };
  }

  /**
   * Extract multiple jobs from page
   */
  static extractAllJobs(): JobData[] {
    const containers = querySelectorAllSafe(document, HEURISTIC_SELECTORS.jobListings);
    const jobs: JobData[] = [];

    containers.forEach(container => {
      const job = this.extractJob(container);
      if (job) {
        jobs.push(job);
      }
    });

    return jobs;
  }
}
