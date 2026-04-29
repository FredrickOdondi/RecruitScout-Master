import { PaginationType } from '../../shared/types';
import { PAGINATION_SELECTORS } from '../../shared/constants';
import { extractAttribute, sleep } from '../../shared/utils';

export interface PaginationResult {
  hasNext: boolean;
  nextUrl?: string;
  totalPages?: number;
  currentPage?: number;
  type: PaginationType;
}

/**
 * Handle pagination and infinite scroll
 */
export class PaginationHandler {
  private static readonly MAX_SCROLL_ATTEMPTS = 10;
  private static readonly SCROLL_DELAY = 1000;
  private static readonly LOAD_MORE_DELAY = 2000;

  /**
   * Detect pagination type and get pagination info
   */
  static detectPagination(): PaginationResult {
    const type = this.detectType();
    const hasNext = this.hasNextPage(type);

    return {
      hasNext,
      nextUrl: hasNext ? this.getNextPageUrl(type) : undefined,
      totalPages: this.estimateTotalPages(),
      currentPage: this.getCurrentPage(),
      type,
    };
  }

  /**
   * Detect pagination type
   */
  private static detectType(): PaginationType {
    // Check for load more button
    for (const selector of PAGINATION_SELECTORS.loadMore) {
      const element = document.querySelector(selector);
      if (element) {
        return 'load-more';
      }
    }

    // Check for numbered pagination
    const hasPageNumbers = document.querySelector(PAGINATION_SELECTORS.pageNumber[0]);
    if (hasPageNumbers) {
      return 'traditional';
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
   * Check if there's a next page
   */
  private static hasNextPage(type: PaginationType): boolean {
    switch (type) {
      case 'load-more':
        return this.hasLoadMoreButton();
      case 'infinite-scroll':
        return this.canScrollMore();
      case 'traditional':
      case 'api-based':
      default:
        return this.hasNextPageButton();
    }
  }

  /**
   * Get next page URL
   */
  private static getNextPageUrl(type: PaginationType): string | undefined {
    switch (type) {
      case 'load-more':
        return this.getLoadMoreUrl();
      case 'traditional':
      case 'api-based':
        return this.getNextPageButtonUrl();
      case 'infinite-scroll':
        return undefined; // Infinite scroll doesn't use URLs
      default:
        return undefined;
    }
  }

  /**
   * Check for load more button
   */
  private static hasLoadMoreButton(): boolean {
    for (const selector of PAGINATION_SELECTORS.loadMore) {
      const element = document.querySelector(selector);
      if (element && this.isElementVisible(element)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get load more button URL
   */
  private static getLoadMoreUrl(): string | undefined {
    for (const selector of PAGINATION_SELECTORS.loadMore) {
      const element = document.querySelector(selector) as HTMLAnchorElement;
      if (element && this.isElementVisible(element)) {
        const href = extractAttribute(element, 'href');
        if (href) {
          return this.resolveUrl(href);
        }
      }
    }
    return undefined;
  }

  /**
   * Click load more button
   */
  static async clickLoadMore(): Promise<boolean> {
    for (const selector of PAGINATION_SELECTORS.loadMore) {
      const element = document.querySelector(selector);
      if (element && this.isElementVisible(element)) {
        try {
          (element as HTMLElement).click();
          await sleep(this.LOAD_MORE_DELAY);
          return true;
        } catch {
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Check for next page button
   */
  private static hasNextPageButton(): boolean {
    for (const selector of PAGINATION_SELECTORS.nextButton) {
      const element = document.querySelector(selector);
      if (element && this.isElementVisible(element)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get next page button URL
   */
  private static getNextPageButtonUrl(): string | undefined {
    for (const selector of PAGINATION_SELECTORS.nextButton) {
      const element = document.querySelector(selector) as HTMLAnchorElement;
      if (element && this.isElementVisible(element)) {
        const href = extractAttribute(element, 'href');
        if (href) {
          return this.resolveUrl(href);
        }
      }
    }
    return undefined;
  }

  /**
   * Click next page button
   */
  static async clickNextPage(): Promise<boolean> {
    for (const selector of PAGINATION_SELECTORS.nextButton) {
      const element = document.querySelector(selector);
      if (element && this.isElementVisible(element)) {
        try {
          (element as HTMLElement).click();
          await sleep(this.SCROLL_DELAY);
          return true;
        } catch {
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Check if can scroll more
   */
  private static canScrollMore(): boolean {
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const scrollTop = document.documentElement.scrollTop;

    return scrollTop + clientHeight < scrollHeight - 100;
  }

  /**
   * Scroll to bottom of page
   */
  static async scrollToBottom(): Promise<boolean> {
    let attempts = 0;
    let previousHeight = 0;

    while (attempts < this.MAX_SCROLL_ATTEMPTS) {
      // Scroll to bottom
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(this.SCROLL_DELAY);

      // Check if more content loaded
      const currentHeight = document.documentElement.scrollHeight;

      if (currentHeight === previousHeight) {
        // No more content loaded
        break;
      }

      previousHeight = currentHeight;
      attempts++;
    }

    return attempts < this.MAX_SCROLL_ATTEMPTS;
  }

  /**
   * Scroll to specific position
   */
  static scrollTo(position: number): void {
    window.scrollTo(0, position);
  }

  /**
   * Scroll to element
   */
  static scrollToElement(element: Element): void {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Get current page number
   */
  private static getCurrentPage(): number | undefined {
    // Try to find page number in URL
    const urlMatch = window.location.href.match(/[?&]page=(\d+)/);
    if (urlMatch) {
      return parseInt(urlMatch[1], 10);
    }

    // Try to find page number in pagination UI
    const activePage = document.querySelector('.active, [aria-current="page"], .current');
    if (activePage) {
      const text = activePage.textContent?.trim();
      if (text && /^\d+$/.test(text)) {
        return parseInt(text, 10);
      }
    }

    return 1;
  }

  /**
   * Estimate total pages
   */
  private static estimateTotalPages(): number | undefined {
    // Try to find total pages in pagination UI
    const pageElements = document.querySelectorAll(PAGINATION_SELECTORS.pageNumber[0]);
    if (pageElements.length > 0) {
      const pageNumbers = Array.from(pageElements)
        .map(el => parseInt(el.textContent?.trim() || '', 10))
        .filter(n => !isNaN(n));

      if (pageNumbers.length > 0) {
        return Math.max(...pageNumbers);
      }
    }

    return undefined;
  }

  /**
   * Check if element is visible
   */
  private static isElementVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.getBoundingClientRect().height > 0
    );
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
   * Navigate to next page
   */
  static async navigateToNext(): Promise<boolean> {
    const type = this.detectType();

    switch (type) {
      case 'load-more':
        return await this.clickLoadMore();
      case 'traditional':
      case 'api-based':
        return await this.clickNextPage();
      case 'infinite-scroll':
        return await this.scrollToBottom();
      default:
        return false;
    }
  }
}
