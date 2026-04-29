import { describe, it, expect } from 'vitest';
import {
  cn,
  generateId,
  debounce,
  throttle,
  formatNumber,
  formatDate,
  getRelativeTime,
  truncateText,
  parseDomain,
  isValidUrl,
  escapeCSVValue,
  extractText,
  uniqueBy,
  sortBy,
} from '../../src/shared/utils';

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
      expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
      expect(cn('foo', undefined, 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar')).toBe('foo');
      expect(cn('foo', true && 'bar')).toBe('foo bar');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate string IDs', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should handle small numbers', () => {
      expect(formatNumber(123)).toBe('123');
    });
  });

  describe('formatDate', () => {
    it('should format dates correctly', () => {
      const date = new Date('2024-01-15');
      expect(formatDate(date)).toMatch(/Jan 15, 2024/);
    });

    it('should handle date strings', () => {
      expect(formatDate('2024-01-15')).toMatch(/Jan 15, 2024/);
    });
  });

  describe('getRelativeTime', () => {
    it('should show today for recent dates', () => {
      const today = new Date();
      expect(getRelativeTime(today)).toBe('Today');
    });

    it('should show days ago for recent dates', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      expect(getRelativeTime(twoDaysAgo)).toBe('2 days ago');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const text = 'This is a very long text that should be truncated';
      const truncated = truncateText(text, 20);
      expect(truncated.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(truncated).toContain('...');
    });

    it('should not truncate short text', () => {
      const text = 'Short text';
      expect(truncateText(text, 20)).toBe('Short text');
    });
  });

  describe('parseDomain', () => {
    it('should parse domain from URL', () => {
      expect(parseDomain('https://www.example.com/path')).toBe('www.example.com');
      expect(parseDomain('https://example.com/path')).toBe('example.com');
    });

    it('should handle invalid URLs', () => {
      expect(parseDomain('not-a-url')).toBe('');
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('escapeCSVValue', () => {
    it('should escape values with commas', () => {
      expect(escapeCSVValue('value,with,commas')).toBe('"value,with,commas"');
    });

    it('should escape values with quotes', () => {
      expect(escapeCSVValue('value"with"quotes')).toBe('"value""with""quotes"');
    });

    it('should not escape simple values', () => {
      expect(escapeCSVValue('simple value')).toBe('simple value');
    });
  });

  describe('uniqueBy', () => {
    it('should remove duplicates by key', () => {
      const items = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'C' },
      ];
      const unique = uniqueBy(items, 'id');
      expect(unique).toHaveLength(2);
      expect(unique.find(item => item.id === 1)?.name).toBe('A');
    });
  });

  describe('sortBy', () => {
    it('should sort array by key in ascending order', () => {
      const items = [
        { id: 3, name: 'C' },
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ];
      const sorted = sortBy(items, 'id', 'asc');
      expect(sorted[0].id).toBe(1);
      expect(sorted[2].id).toBe(3);
    });

    it('should sort array by key in descending order', () => {
      const items = [
        { id: 1, name: 'A' },
        { id: 3, name: 'C' },
        { id: 2, name: 'B' },
      ];
      const sorted = sortBy(items, 'id', 'desc');
      expect(sorted[0].id).toBe(3);
      expect(sorted[2].id).toBe(1);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', (done) => {
      const fn = jest.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      setTimeout(() => {
        expect(fn).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', () => {
      const fn = jest.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
