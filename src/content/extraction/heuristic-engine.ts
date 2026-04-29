import { JobData } from '../../shared/types';
import { extractText, scoreElementMatch, isElementVisible } from '../../shared/utils';
import { HEURISTIC_SELECTORS } from '../../shared/constants';
import { FieldExtractors } from './field-extractors';

interface ElementScore {
  element: Element;
  score: number;
  confidence: number;
}

/**
 * Universal selector engine using heuristic scoring
 */
export class HeuristicEngine {
  private static readonly JOB_TITLE_KEYWORDS = [
    'engineer', 'developer', 'manager', 'analyst', 'specialist',
    'director', 'consultant', 'assistant', 'coordinator', 'lead',
    'senior', 'junior', 'intern', 'architect', 'designer',
  ];

  private static readonly JOB_TITLE_STOPWORDS = [
    'home', 'about', 'contact', 'privacy', 'terms', 'login', 'register',
    'search', 'filter', 'sort', 'save', 'apply', 'share', 'follow',
  ];

  /**
   * Find job listing containers using heuristics
   */
  static findJobContainers(): Element[] {
    const candidates: ElementScore[] = [];

    // Try direct selectors first
    for (const selector of HEURISTIC_SELECTORS.jobListings) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (isElementVisible(el)) {
          candidates.push({
            element: el,
            score: 100,
            confidence: 0.9,
          });
        }
      });

      if (candidates.length > 0) {
        break;
      }
    }

    // If no direct matches, use heuristics
    if (candidates.length === 0) {
      const heuristicCandidates = this.findHeuristicContainers();
      candidates.push(...heuristicCandidates);
    }

    // Return top candidates
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 100)
      .map(c => c.element);
  }

  /**
   * Find job containers using heuristics
   */
  private static findHeuristicContainers(): ElementScore[] {
    const candidates: ElementScore[] = [];

    // Look for elements with job-related attributes
    const allElements = document.querySelectorAll('*');

    allElements.forEach(element => {
      if (!isElementVisible(element)) return;

      let score = 0;

      // Check for job-related classes
      const className = (element.getAttribute('class') || '').toLowerCase();
      if (className.includes('job') || className.includes('position') || className.includes('role')) {
        score += 30;
      }

      // Check for job-related data attributes
      const dataAttrs = Array.from(element.attributes)
        .filter(attr => attr.name.startsWith('data-'))
        .map(attr => `${attr.name}="${attr.value}"`)
        .join(' ');

      if (dataAttrs.includes('job') || dataAttrs.includes('position') || dataAttrs.includes('role')) {
        score += 40;
      }

      // Check for title element inside
      const titleElement = this.findTitleElement(element);
      if (titleElement) {
        const title = extractText(titleElement).toLowerCase();

        // Check for job title keywords
        const hasJobKeyword = this.JOB_TITLE_KEYWORDS.some(keyword => title.includes(keyword));
        const hasStopword = this.JOB_TITLE_STOPWORDS.some(word => title.includes(word));

        if (hasJobKeyword && !hasStopword) {
          score += 50;
        }

        // Check for company indicators
        const hasCompany = this.hasCompanyIndicator(element);
        if (hasCompany) {
          score += 20;
        }

        // Check for location indicators
        const hasLocation = this.hasLocationIndicator(element);
        if (hasLocation) {
          score += 20;
        }
      }

      // Check if it's a direct link (likely job listing)
      const linkElement = element.querySelector('a');
      if (linkElement) {
        const href = linkElement.getAttribute('href') || '';
        if (href.includes('/job/') || href.includes('/jobs/') || href.includes('/position/')) {
          score += 30;
        }
      }

      // Only include elements with meaningful scores
      if (score >= 30) {
        const confidence = Math.min(score / 150, 1);
        candidates.push({
          element,
          score,
          confidence,
        });
      }
    });

    return candidates;
  }

  /**
   * Find title element within container
   */
  private static findTitleElement(container: Element): Element | null {
    // Try common title selectors
    const selectors = [
      'h2', 'h3', 'h4',
      '.job-title', '.jobTitle', '.title',
      '[data-testid="job-title"]',
      '[data-job-title]',
      'a[href*="/job/"]', 'a[href*="/jobs/"]',
    ];

    for (const selector of selectors) {
      const element = container.querySelector(selector);
      if (element && extractText(element).length > 5) {
        return element;
      }
    }

    return null;
  }

  /**
   * Check for company indicator in container
   */
  private static hasCompanyIndicator(container: Element): boolean {
    const indicators = [
      'company', 'employer', 'organization',
      'data-company', 'data-employer',
    ];

    return indicators.some(indicator => {
      const hasAttr = Array.from(container.attributes).some(
        attr => attr.name.toLowerCase().includes(indicator.toLowerCase())
      );
      const hasClass = (container.getAttribute('class') || '').toLowerCase().includes(indicator.toLowerCase());
      return hasAttr || hasClass;
    });
  }

  /**
   * Check for location indicator in container
   */
  private static hasLocationIndicator(container: Element): boolean {
    const indicators = [
      'location', 'city', 'state', 'country',
      'data-location',
    ];

    return indicators.some(indicator => {
      const hasAttr = Array.from(container.attributes).some(
        attr => attr.name.toLowerCase().includes(indicator.toLowerCase())
      );
      const hasClass = (container.getAttribute('class') || '').toLowerCase().includes(indicator.toLowerCase());
      return hasAttr || hasClass;
    });
  }

  /**
   * Extract job from container with confidence scoring
   */
  static extractJobFromContainer(container: Element): { job: JobData | null; confidence: number } {
    // Try field extractors first
    const job = FieldExtractors.extractJob(container);

    if (job) {
      // Calculate confidence based on data completeness
      const confidence = this.calculateConfidence(job);
      return { job, confidence };
    }

    return { job: null, confidence: 0 };
  }

  /**
   * Calculate confidence score for extracted job
   */
  private static calculateConfidence(job: JobData): number {
    let score = 0;
    let maxScore = 7;

    if (job.title && job.title.length > 5) score++;
    if (job.company && job.company !== 'Unknown') score++;
    if (job.location && job.location !== 'Unknown') score++;
    if (job.url && job.url !== window.location.href) score++;
    if (job.description && job.description.length > 50) score++;
    if (job.employmentType) score++;
    if (job.salary) score++;

    return score / maxScore;
  }

  /**
   * Extract all jobs with confidence scores
   */
  static extractAllJobs(): Array<{ job: JobData; confidence: number }> {
    const containers = this.findJobContainers();
    console.log(`[RecruitScout] HeuristicEngine found ${containers.length} potential job containers.`);
    const results: Array<{ job: JobData; confidence: number }> = [];

    containers.forEach((container, idx) => {
      const { job, confidence } = this.extractJobFromContainer(container);
      console.log(`[RecruitScout] Container ${idx} extracted job:`, job?.title, `| confidence: ${confidence}`);
      if (job && confidence > 0.3) {
        results.push({ job, confidence });
      } else {
        console.log(`[RecruitScout] Container ${idx} rejected due to low confidence or missing job data.`);
      }
    });

    // Deduplicate by URL or Title+Company if URL is the page URL
    const seen = new Set<string>();
    return results.filter(({ job }) => {
      const baseUrl = job.url.split('?')[0];
      const key = `${baseUrl}-${job.title}-${job.company}`;

      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Get extraction statistics
   */
  static getStats(): {
    totalContainers: number;
    extractedJobs: number;
    averageConfidence: number;
    highConfidenceJobs: number;
  } {
    const results = this.extractAllJobs();
    const avgConfidence = results.length > 0
      ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
      : 0;
    const highConfidenceJobs = results.filter(r => r.confidence > 0.7).length;

    return {
      totalContainers: this.findJobContainers().length,
      extractedJobs: results.length,
      averageConfidence: avgConfidence,
      highConfidenceJobs,
    };
  }
}
