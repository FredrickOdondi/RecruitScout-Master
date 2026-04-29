import { PageInfo, PageType, PaginationType } from '../shared/types';
import { PLATFORM_PATTERNS, PAGINATION_SELECTORS } from '../shared/constants';

/**
 * DOM change observer for monitoring page updates
 */
export class PageMonitor {
  private observer: MutationObserver | null = null;
  private callbacks: Set<() => void> = new Set();
  private pageInfo: PageInfo | null = null;

  constructor() {
    this.pageInfo = this.detectPage();
  }

  /**
   * Start monitoring DOM changes
   */
  start(): void {
    if (this.observer) return;

    this.observer = new MutationObserver((mutations) => {
      let shouldNotify = false;

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldNotify = true;
        }
      });

      if (shouldNotify) {
        this.notifyCallbacks();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Register callback for DOM changes
   */
  onChange(callback: () => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Detect current page information
   */
  detectPage(): PageInfo {
    const url = window.location.href;
    const platform = this.detectPlatform(url);
    const pageType = this.detectPageType(url);
    const jobCount = this.countJobs();
    const hasPagination = this.detectPagination();
    const paginationType = hasPagination ? this.detectPaginationType() : undefined;

    const pageInfo: PageInfo = {
      isJobBoard: platform !== null,
      platform,
      pageType,
      jobCount,
      hasPagination,
      paginationType,
    };

    this.pageInfo = pageInfo;
    return pageInfo;
  }

  /**
   * Detect job platform
   */
  private detectPlatform(url: string): string | undefined {
    for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
      if (pattern.test(url)) {
        return platform;
      }
    }
    return undefined;
  }

  /**
   * Detect page type (listing or detail)
   */
  private detectPageType(url: string): PageType {
    // Check for detail page indicators
    const detailPatterns = [
      /\/jobs\/view\/\d+/,
      /\/job\/view\/\d+/,
      /\/job\/\d+/,
      /\/position\/\d+/,
    ];

    for (const pattern of detailPatterns) {
      if (pattern.test(url)) {
        return 'detail';
      }
    }

    // Check for listing page indicators
    const listingPatterns = [
      /\/jobs\/?$/,
      /\/jobs\//,
      /\/search/,
      /\/careers/,
    ];

    for (const pattern of listingPatterns) {
      if (pattern.test(url)) {
        return 'listing';
      }
    }

    // Check URL structure
    if (url.includes('/job/') && !url.includes('/jobs/') && !url.includes('/jobs?')) {
      return 'detail';
    }

    return 'listing';
  }

  /**
   * Count visible job listings
   */
  private countJobs(): number {
    const jobSelectors = [
      'article[data-automation-id="jobTile"]',
      'div[data-testid="job-card"]',
      'div.job-card',
      'div.jobsearch-SerpJobCard',
      'li.job-result',
    ];

    for (const selector of jobSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return elements.length;
      }
    }

    return 0;
  }

  /**
   * Detect if page has pagination
   */
  private detectPagination(): boolean {
    for (const selector of [...PAGINATION_SELECTORS.nextButton, ...PAGINATION_SELECTORS.loadMore]) {
      const element = document.querySelector(selector);
      if (element) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect pagination type
   */
  private detectPaginationType(): PaginationType {
    // Check for load more button
    for (const selector of PAGINATION_SELECTORS.loadMore) {
      const element = document.querySelector(selector);
      if (element) {
        return 'load-more';
      }
    }

    // Check for traditional pagination
    for (const selector of PAGINATION_SELECTORS.nextButton) {
      const element = document.querySelector(selector);
      if (element) {
        // Check if it's part of numbered pagination
        const hasPageNumbers = document.querySelector(PAGINATION_SELECTORS.pageNumber[0]);
        if (hasPageNumbers) {
          return 'traditional';
        }
      }
    }

    // Check for infinite scroll indicators
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const hasInfiniteScroll = scrollHeight > clientHeight * 2;

    if (hasInfiniteScroll) {
      return 'infinite-scroll';
    }

    return 'traditional';
  }

  /**
   * Get current page info
   */
  getPageInfo(): PageInfo | null {
    return this.pageInfo;
  }

  /**
   * Check if page is a job board
   */
  isJobBoard(): boolean {
    return this.pageInfo?.isJobBoard || false;
  }

  /**
   * Check if page is a listing page
   */
  isListingPage(): boolean {
    return this.pageInfo?.pageType === 'listing';
  }

  /**
   * Check if page is a detail page
   */
  isDetailPage(): boolean {
    return this.pageInfo?.pageType === 'detail';
  }

  /**
   * Notify all callbacks
   */
  private notifyCallbacks(): void {
    this.callbacks.forEach(callback => callback());
  }
}
