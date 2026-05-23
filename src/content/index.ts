import { PageMonitor } from './page-monitor';
import { SchemaParser } from './extraction/schema-parser';
import { HeuristicEngine } from './extraction/heuristic-engine';
import { FieldExtractors } from './extraction/field-extractors';
import { IndeedExtractor } from './extraction/indeed-extractor';
import { TrovolavoroExtractor } from './extraction/trovolavoro-extractor';
import { ClickThroughExtractor } from './extraction/click-extractor';
import { SalaryParser } from './extraction/salary-parser';
import { NLPExtractor } from './extraction/nlp-extractor';
import { JobData, ExtensionMessage, MessageType } from '../shared/types';
import { generateId } from '../shared/utils';

/**
 * Main content script entry point
 * Coordinates extraction modules and handles message passing
 */
class ContentScript {
  private pageMonitor: PageMonitor;
  private isExtracting = false;

  constructor() {
    this.pageMonitor = new PageMonitor();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('[RecruitScout] Content script initialized');

    // Start monitoring page changes
    this.pageMonitor.start();

    // Set up message listeners
    this.setupMessageListeners();

    // Notify background that content script is ready
    chrome.runtime.sendMessage({
      type: MessageType.CONTENT_SCRIPT_READY,
      payload: {
        url: window.location.href,
        pageInfo: this.pageMonitor.detectPage(),
      },
    }).catch(() => {
      // Background might not be ready yet
    });
  }

  private setupMessageListeners(): void {
    // Relay messages from the hosted Dashboard web app to the extension background
    window.addEventListener('message', (event) => {
      // Security: Only accept messages from specific trusted dashboard origins
      const allowedOrigins = [
        window.location.origin, // Allow same-origin (if injected locally or matching)
        'http://localhost:5173',
        'http://localhost:3000',
        'http://72.60.215.34'
      ];

      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      // We only accept messages from our dashboard script
      if (event.data && event.data.source === 'recruitscout-dashboard') {
        chrome.runtime.sendMessage(event.data, (response) => {
          // Relay success state back to the web app
          window.postMessage({
            source: 'recruitscout-extension',
            type: event.data.type + '_SUCCESS',
            response,
            _id: event.data._id
          }, '*'); // Since we verified origin above, responding to '*' in the same window is safe
        });
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const { type, payload } = message as ExtensionMessage;

      console.log('[RecruitScout] Received message:', type);

      switch (type) {
        case MessageType.DETECT_PAGE:
          this.handleDetectPage().then(sendResponse);
          return true;

        case MessageType.EXTRACT_JOBS:
          this.handleExtractJobs(payload).then(sendResponse);
          return true;

        case MessageType.STOP_EXTRACTION:
          this.handleStopExtraction().then(sendResponse);
          return true;

        case MessageType.PAUSE_EXTRACTION:
          this.handlePauseExtraction().then(sendResponse);
          return true;

        case MessageType.CLICK_NEXT_PAGE:
          this.handleClickNextPage().then(sendResponse);
          return true;

        default:
          sendResponse({ error: 'Unknown message type' });
      }
    });
  }

  /**
   * Handle page detection request
   */
  private async handleDetectPage() {
    const pageInfo = this.pageMonitor.detectPage();
    return { pageInfo };
  }

  private async handleExtractJobs(payload: any) {
    const { mode, options } = payload;

    if (this.isExtracting) {
      return { error: 'Extraction already in progress' };
    }

    this.isExtracting = true;

    try {
      // Extract jobs using multiple strategies
      const jobs = await this.extractJobs(mode, options);

      // Enhance jobs with additional data
      const enhancedJobs = await this.enhanceJobs(jobs);

      // We no longer blindly send ADD_JOBS here to avoid the race condition.
      // The background service worker will await the 'jobs' array returned below.

      let nextPageUrl: string | undefined;
      if (mode === 'pagination' || mode === 'bulk-search') {
        nextPageUrl = this.findNextPageUrl();
        if (nextPageUrl) {
          console.log(`[RecruitScout] ➡️ Found next page URL: ${nextPageUrl}`);
        } else {
          console.warn(`[RecruitScout] ⏹️ No next page URL found. Mode: ${mode}`);
        }
      }

      return {
        success: true,
        count: enhancedJobs.length,
        jobs: enhancedJobs,
        nextPageUrl,
      };
    } catch (error) {
      console.error('[RecruitScout] Extraction error Details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.isExtracting = false;
    }
  }

  /**
   * Extract jobs using multiple strategies
   */
  private async extractJobs(mode: string, options: any = {}): Promise<JobData[]> {
    console.log(`[RecruitScout] Starting extractJobs... mode=${mode}`);
    const jobs: JobData[] = [];

    // Strategy 1: Schema.org parsing
    const schemaJobs = SchemaParser.parseAll();
    console.log(`[RecruitScout] SchemaParser found ${schemaJobs.length} jobs`);
    jobs.push(...schemaJobs);

    // Strategy 2: Platform-specific extraction
    if (window.location.hostname.includes('indeed.')) {
      const indeedJobs = IndeedExtractor.extractAllJobs();
      console.log(`[RecruitScout] IndeedExtractor found ${indeedJobs.length} jobs`);
      jobs.push(...indeedJobs);
    } else if (window.location.hostname.includes('trovolavoro.')) {
      const trovoJobs = TrovolavoroExtractor.extractAllJobs();
      console.log(`[RecruitScout] TrovolavoroExtractor found ${trovoJobs.length} jobs`);
      jobs.push(...trovoJobs);
    }

    // Strategy 3: Heuristic engine
    // If specific extractors already found jobs on list pages, we can skip visual heuristics
    if (jobs.length === 0 || this.pageMonitor.isDetailPage()) {
      const heuristicResults = HeuristicEngine.extractAllJobs();
      console.log(`[RecruitScout] HeuristicEngine found ${heuristicResults.length} high-confidence jobs`);
      jobs.push(...heuristicResults.map(r => r.job));
    }

    // Strategy 3: Field extractors (for detail pages)
    if (this.pageMonitor.isDetailPage()) {
      console.log(`[RecruitScout] Detail page detected, extracting single job...`);
      const detailJob = FieldExtractors.extractJob(document.body);
      if (detailJob) {
        jobs.push(detailJob);
      }
    }

    // Deduplicate jobs by URL
    const uniqueJobs = this.deduplicateJobs(jobs);
    console.log(`[RecruitScout] Total unique jobs after deduplication: ${uniqueJobs.length}`);

    return uniqueJobs;
  }

  /**
   * Enhance jobs with additional data
   */
  private async enhanceJobs(jobs: JobData[]): Promise<JobData[]> {
    let enhancedJobs = jobs.map(job => {
      const enhanced = { ...job };

      // Parse salary if not already present
      if (!enhanced.salary && enhanced.description) {
        const salary = SalaryParser.parse(enhanced.description);
        if (salary) {
          enhanced.salary = salary;
        }
      }

      // Parse date posted if not already present
      if (!enhanced.datePosted && enhanced.postedAgo) {
        const date = NLPExtractor.parseRelativeDate(enhanced.postedAgo);
        if (date) {
          enhanced.datePosted = date.toISOString();
        }
      }

      // Extract skills from description
      if (enhanced.description) {
        const skills = NLPExtractor.extractSkills(enhanced.description);
        if (skills.length > 0) {
          enhanced.metadata = { ...enhanced.metadata, skills };
        }
      }

      return enhanced;
    });

    // Deep scrape indeed right panes if on generic listings page
    if (window.location.hostname.includes('indeed.') && !this.pageMonitor.isDetailPage()) {
      enhancedJobs = await ClickThroughExtractor.enrichWithDescriptions(enhancedJobs);
    }

    return enhancedJobs;
  }

  /**
   * Deduplicate jobs by URL
   */
  private deduplicateJobs(jobs: JobData[]): JobData[] {
    const seen = new Map<string, JobData>();

    for (const job of jobs) {
      const baseUrl = job.url.split('?')[0];
      const key = `${baseUrl}-${job.title}-${job.company}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, job);
      } else {
        // Merge data, preferring more complete records
        const merged = { ...existing };

        if (!merged.salary && job.salary) merged.salary = job.salary;
        if (!merged.description && job.description) merged.description = job.description;
        if (!existing.metadata && job.metadata) {
          merged.metadata = job.metadata;
        }

        seen.set(key, merged);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Find the next page URL for pagination
   */
  private findNextPageUrl(): string | undefined {
    // Indeed & Trovolavoro specific next button robust fallback
    const nextPatterns = [
      'a[data-testid="pagination-page-next"]',
      'a[aria-label="Next Page"]',
      'a[aria-label="Next"]',
      'a[aria-label*="next" i]',
      'a.pagination-next',
      '.pagination a:last-child',
      // Trovolavoro / Italian fallbacks
      'a[aria-label="Avanti"]',
      'a[aria-label*="successiva" i]',
      'li.next a',
      'a.next',
      '.next a',
      '.pagination .next a',
      '.pagNext a'
    ];

    for (const selector of nextPatterns) {
      const btn = document.querySelector(selector) as HTMLAnchorElement;
      if (btn && btn.href && !btn.classList.contains('disabled') && !btn.hasAttribute('disabled')) {
        return btn.href;
      }
    }

    // Aggressive text search fallback
    const allLinks = document.querySelectorAll('a');
    for (const link of Array.from(allLinks)) {
      if (link.hasAttribute('disabled') || link.classList.contains('disabled')) continue;
      
      const text = link.textContent?.toLowerCase().trim() || '';
      if ((text.includes('next') || text.includes('avanti') || text.includes('successiva')) && link.href && !link.href.includes('javascript:')) {
        // Ensure it's inside a pagination block to avoid random "Next steps" links
        const parent = link.parentElement;
        if (parent && (parent.className.toLowerCase().includes('pag') || document.querySelector('nav[role="navigation"]')?.contains(link))) {
          return link.href;
        }
      }
    }

    // Hash-based URL increment fallback for Trovolavoro
    if (window.location.hostname.includes('trovolavoro.')) {
      const currentUrl = window.location.href;
      const match = currentUrl.match(/&page=(\d+)/);
      if (match) {
        // If we are here, we didn't find an explicit "Next" button. 
        // We shouldn't blindly increment forever, but if the DOM is heavily obfuscated, 
        // we can increment it. The background worker will naturally stop when it finds 0 jobs.
        const currentPage = parseInt(match[1], 10);
        return currentUrl.replace(`&page=${currentPage}`, `&page=${currentPage + 1}`);
      }
    }

    return undefined;
  }

  /**
   * Click the next page button in the DOM natively
   */
  private async handleClickNextPage(): Promise<{ success: boolean; error?: string }> {
    console.log('[RecruitScout] 🖱️ Executing native click on Next Page button...');
    const nextPatterns = [
      'a[data-testid="pagination-page-next"]',
      'button[data-testid="pagination-page-next"]',
      'a[aria-label="Next Page"]',
      'button[aria-label="Next Page"]',
      'a[aria-label="Next"]',
      'button[aria-label="Next"]',
      'a[aria-label*="next" i]',
      'button[aria-label*="next" i]',
      'a.pagination-next',
      '.pagination a:last-child',
      '.artdeco-pagination__button--next'
    ];

    for (const selector of nextPatterns) {
      const btn = document.querySelector(selector) as HTMLElement;
      if (btn && !btn.classList.contains('disabled')) {
        console.log(`[RecruitScout] 🖱️ Clicked pagination button using selector: ${selector}`);
        btn.click();
        return { success: true };
      }
    }

    // Aggressive text search fallback
    const allLinks = document.querySelectorAll('a, button');
    for (const el of Array.from(allLinks)) {
      if (el.textContent?.toLowerCase().trim().includes('next') && !el.classList.contains('disabled')) {
        const parent = el.parentElement;
        if (parent && (parent.className.toLowerCase().includes('pag') || document.querySelector('nav[role="navigation"]')?.contains(el))) {
          console.log(`[RecruitScout] 🖱️ Clicked pagination link using text content.`);
          (el as HTMLElement).click();
          return { success: true };
        }
      }
    }

    return { success: false, error: 'Next button not found in DOM' };
  }

  /**
   * Handle stop extraction request
   */
  private async handleStopExtraction() {
    this.isExtracting = false;
    return { success: true };
  }

  /**
   * Handle pause extraction request
   */
  private async handlePauseExtraction() {
    this.isExtracting = false;
    return { success: true };
  }
}

// Initialize content script
new ContentScript();

export { ContentScript };
