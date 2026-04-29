import { PAGINATION_SELECTORS, HEURISTIC_SELECTORS } from '../../shared/constants';
import { extractAttribute, isElementVisible } from '../../shared/utils';

export interface JobUrl {
  url: string;
  title: string;
  element: Element;
}

/**
 * URL discovery mechanism for finding job listing links
 */
export class URLDiscovery {
  /**
   * Find all job listing URLs on current page
   */
  static findJobUrls(): JobUrl[] {
    const urls: JobUrl[] = [];

    // Try direct selectors first
    for (const selector of HEURISTIC_SELECTORS.jobLink) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (isElementVisible(el)) {
          const url = this.extractUrl(el);
          if (url && this.isValidJobUrl(url)) {
            urls.push({
              url,
              title: this.extractTitle(el),
              element: el,
            });
          }
        }
      });

      if (urls.length > 0) {
        break;
      }
    }

    // If no direct matches, use heuristics
    if (urls.length === 0) {
      const heuristicUrls = this.findHeuristicUrls();
      urls.push(...heuristicUrls);
    }

    // Deduplicate
    const seen = new Set<string>();
    return urls.filter(jobUrl => {
      if (seen.has(jobUrl.url)) {
        return false;
      }
      seen.add(jobUrl.url);
      return true;
    });
  }

  /**
   * Find URLs using heuristics
   */
  private static findHeuristicUrls(): JobUrl[] {
    const urls: JobUrl[] = [];
    const links = document.querySelectorAll('a[href]');

    links.forEach(link => {
      if (!isElementVisible(link)) return;

      const href = extractAttribute(link, 'href');
      if (!href) return;

      // Check for job URL patterns
      const urlPatterns = [
        /\/job\/\d+/,
        /\/jobs\/\d+/,
        /\/position\/\d+/,
        /\/viewjob\//i,
        /\/jobs\/view\//i,
      ];

      const isJobUrl = urlPatterns.some(pattern => pattern.test(href));

      if (isJobUrl) {
        const fullUrl = this.resolveUrl(href);
        if (this.isValidJobUrl(fullUrl)) {
          urls.push({
            url: fullUrl,
            title: this.extractTitle(link),
            element: link,
          });
        }
      }
    });

    return urls;
  }

  /**
   * Extract URL from element
   */
  private static extractUrl(element: Element): string | null {
    let url: string | null = null;

    if (element.tagName === 'A') {
      url = extractAttribute(element, 'href');
    } else {
      const link = element.querySelector('a');
      if (link) {
        url = extractAttribute(link, 'href');
      }
    }

    if (!url) return null;

    return this.resolveUrl(url);
  }

  /**
   * Extract title from element
   */
  private static extractTitle(element: Element): string {
    return element.textContent?.trim() || element.getAttribute('title') || '';
  }

  /**
   * Resolve URL relative to current page
   */
  private static resolveUrl(url: string): string {
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return url;
    }
  }

  /**
   * Check if URL is a valid job URL
   */
  private static isValidJobUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // Must be HTTP/HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }

      // Must have a path
      if (!urlObj.pathname || urlObj.pathname === '/') {
        return false;
      }

      // Should not be a mailto, tel, etc.
      if (urlObj.pathname.includes('mailto:') || urlObj.pathname.includes('tel:')) {
        return false;
      }

      // Should contain job-related keywords
      const pathname = urlObj.pathname.toLowerCase();
      const jobKeywords = ['job', 'jobs', 'position', 'role', 'career', 'opportunity'];
      const hasJobKeyword = jobKeywords.some(keyword => pathname.includes(keyword));

      return hasJobKeyword || /\/\d+/.test(pathname);
    } catch {
      return false;
    }
  }

  /**
   * Get pagination URLs
   */
  static getPaginationUrls(): string[] {
    const urls: string[] = [];

    // Find next button
    for (const selector of PAGINATION_SELECTORS.nextButton) {
      const element = document.querySelector(selector);
      if (element) {
        const href = extractAttribute(element, 'href');
        if (href) {
          urls.push(this.resolveUrl(href));
          break;
        }
      }
    }

    // Find numbered pages
    const pageElements = document.querySelectorAll(PAGINATION_SELECTORS.pageNumber[0]);
    pageElements.forEach(el => {
      if (isElementVisible(el)) {
        const href = extractAttribute(el, 'href');
        if (href) {
          urls.push(this.resolveUrl(href));
        }
      }
    });

    return urls;
  }

  /**
   * Get next page URL
   */
  static getNextPageUrl(): string | null {
    for (const selector of PAGINATION_SELECTORS.nextButton) {
      const element = document.querySelector(selector);
      if (element && isElementVisible(element)) {
        const href = extractAttribute(element, 'href');
        if (href) {
          return this.resolveUrl(href);
        }
      }
    }
    return null;
  }

  /**
   * Check if there's a next page
   */
  static hasNextPage(): boolean {
    return this.getNextPageUrl() !== null;
  }

  /**
   * Get all unique job URLs from current page
   */
  static getAllUniqueJobUrls(): Set<string> {
    const jobUrls = this.findJobUrls();
    return new Set(jobUrls.map(ju => ju.url));
  }

  /**
   * Count job URLs
   */
  static countJobUrls(): number {
    return this.findJobUrls().length;
  }
}
