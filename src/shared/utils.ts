import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Sleep function for async delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format currency
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD'
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(date: string | Date, format: string = 'MMM DD, YYYY'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Get relative time (e.g., "2 days ago")
 */
export function getRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Truncate text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Escape CSV value
 */
export function escapeCSVValue(value: string): string {
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * In-memory cache to avoid duplicate API calls per scrape session
 */
const _domainCache = new Map<string, string>();



/**
 * Fetch the real company domain by proxying through the background service worker
 * (which has network access to autocomplete.clearbit.com without CSP restrictions).
 * Returns empty string if the lookup fails.
 */
export async function fetchCompanyDomain(companyName: string): Promise<string> {
  if (!companyName || companyName === 'Unknown') return '';

  // Check cache first
  const cached = _domainCache.get(companyName);
  if (cached !== undefined) return cached;

  try {
    const result = await new Promise<{ domain: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
      chrome.runtime.sendMessage(
        { type: 'RESOLVE_DOMAIN', payload: { companyName } },
        (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response as { domain: string });
          }
        }
      );
    });

    if (result?.domain) {
      _domainCache.set(companyName, result.domain);
      return result.domain;
    }
  } catch {
    // Background not reachable or timed out
  }

  _domainCache.set(companyName, '');
  return '';
}

/**
 * Parse URL domain
 */
export function parseDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

/**
 * Check if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract text from element
 */
export function extractText(element: Element | null): string {
  if (!element) return '';
  
  try {
    const htmlEl = element as HTMLElement;
    // innerText naturally ignores <style>, <script>, and hidden elements
    if (typeof htmlEl.innerText === 'string' && htmlEl.innerText.trim().length > 0) {
      return htmlEl.innerText.trim();
    }
  } catch(e) {}

  // Fallback: use textContent but remove CSS/JS tags first
  try {
    const clone = element.cloneNode(true) as Element;
    const unwanted = clone.querySelectorAll('style, script, noscript');
    Array.from(unwanted).forEach(el => el.remove());
    return clone.textContent?.trim() || '';
  } catch(e) {
    return element.textContent?.trim() || '';
  }
}

/**
 * Extract attribute from element
 */
export function extractAttribute(element: Element | null, attribute: string): string | null {
  return element?.getAttribute(attribute) || null;
}

/**
 * Find closest element by selector
 */
export function findClosest(element: Element | null, selector: string): Element | null {
  return element?.closest(selector) || null;
}

/**
 * Query selector with fallback
 */
export function querySelectorAllSafe(root: Document | Element, selectors: readonly string[]): Element[] {
  for (const selector of selectors) {
    try {
      const elements = root.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    } catch {
      continue;
    }
  }
  return [];
}

/**
 * Query selector first with fallback
 */
export function querySelectorSafe(root: Document | Element, selectors: readonly string[]): Element | null {
  for (const selector of selectors) {
    try {
      const element = root.querySelector(selector);
      if (element) return element;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Score element match
 */
export function scoreElementMatch(element: Element, keywords: string[]): number {
  const text = extractText(element).toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) {
      score += 1;
    }
  }
  return score;
}

/**
 * Normalize whitespace
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Strip HTML tags
 */
export function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return extractText(div);
}

/**
 * Parse salary range
 */
export function parseSalaryRange(text: string): { min?: number; max?: number } | null {
  const patterns = [
    /(\$[\d,]+)\s*[-–]\s*(\$[\d,]+)/i,
    /(\d+,\d+)\s*[-–]\s*(\d+,\d+)/,
    /(\d+)\s*[-–]\s*(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const min = parseInt(match[1].replace(/[^0-9]/g, ''), 10);
      const max = parseInt(match[2].replace(/[^0-9]/g, ''), 10);
      if (!isNaN(min) && !isNaN(max)) {
        return { min, max };
      }
    }
  }

  return null;
}

/**
 * Extract number from text
 */
export function extractNumber(text: string): number | null {
  const match = text.match(/[\d,]+(?:\.\d+)?/);
  if (match) {
    return parseFloat(match[0].replace(/,/g, ''));
  }
  return null;
}

/**
 * Check if element is visible
 */
export function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.getBoundingClientRect().height > 0
  );
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge objects deeply
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key as keyof T])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key as keyof T] });
        } else {
          output[key as keyof T] = deepMerge(
            target[key as keyof T],
            source[key as keyof T] as any
          );
        }
      } else {
        Object.assign(output, { [key]: source[key as keyof T] });
      }
    });
  }
  return output;
}

function isObject(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Chunk array
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Remove duplicates from array based on key
 */
export function uniqueBy<T>(array: T[], key: keyof T): T[] {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

/**
 * Sort array by key
 */
export function sortBy<T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {
  return [...array].sort((a, b) => {
    const aValue = a[key];
    const bValue = b[key];
    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });
}
