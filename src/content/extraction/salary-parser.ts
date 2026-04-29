import { SalaryInfo } from '../../shared/types';
import { SALARY_PERIOD_KEYWORDS, CURRENCY_SYMBOLS } from '../../shared/constants';
import { extractNumber, parseSalaryRange } from '../../shared/utils';

/**
 * Salary extraction and normalization
 */
export class SalaryParser {
  /**
   * Extract salary information from text
   */
  static parse(text: string): SalaryInfo | null {
    if (!text) return null;

    const normalized = text.toLowerCase();
    const salary = parseSalaryRange(text);

    if (!salary) {
      // Try single value
      const number = extractNumber(text);
      if (number) {
        return {
          min: number,
          max: number,
          currency: this.extractCurrency(text),
          period: this.extractPeriod(normalized),
          raw: text,
        };
      }
      return null;
    }

    return {
      min: salary.min,
      max: salary.max,
      currency: this.extractCurrency(text),
      period: this.extractPeriod(normalized),
      raw: text,
    };
  }

  /**
   * Extract currency from text
   */
  static extractCurrency(text: string): string | undefined {
    // Check for currency symbols
    for (const [code, symbol] of Object.entries(CURRENCY_SYMBOLS)) {
      if (text.includes(symbol)) {
        return code;
      }
    }

    // Check for currency codes (USD, EUR, etc.)
    const currencyCodeMatch = text.match(/[A-Z]{3}/);
    if (currencyCodeMatch) {
      const code = currencyCodeMatch[0];
      if (CURRENCY_SYMBOLS[code as keyof typeof CURRENCY_SYMBOLS]) {
        return code;
      }
    }

    // Default to USD
    return 'USD';
  }

  /**
   * Extract salary period from text
   */
  static extractPeriod(text: string): SalaryInfo['period'] {
    for (const [period, keywords] of Object.entries(SALARY_PERIOD_KEYWORDS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return period as SalaryInfo['period'];
        }
      }
    }

    // Default to yearly
    return 'yearly';
  }

  /**
   * Normalize salary to yearly
   */
  static normalizeToYearly(salary: SalaryInfo): { min?: number; max?: number } {
    if (!salary.min && !salary.max) {
      return {};
    }

    const period = salary.period || 'yearly';

    let min = salary.min;
    let max = salary.max;

    if (period === 'hourly') {
      min = min ? min * 2080 : undefined; // 40 hours * 52 weeks
      max = max ? max * 2080 : undefined;
    } else if (period === 'monthly') {
      min = min ? min * 12 : undefined;
      max = max ? max * 12 : undefined;
    } else if (period === 'weekly') {
      min = min ? min * 52 : undefined;
      max = max ? max * 52 : undefined;
    }

    return { min, max };
  }

  /**
   * Format salary for display
   */
  static formatSalary(salary: SalaryInfo): string {
    if (!salary.min && !salary.max) {
      return '';
    }

    const currency = salary.currency || 'USD';
    const symbol = CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] || '';

    if (salary.min && salary.max) {
      return `${symbol}${this.formatNumber(salary.min)} - ${symbol}${this.formatNumber(salary.max)}`;
    } else if (salary.min) {
      return `${symbol}${this.formatNumber(salary.min)}+`;
    } else if (salary.max) {
      return `Up to ${symbol}${this.formatNumber(salary.max)}`;
    }

    return '';
  }

  /**
   * Format number with commas
   */
  private static formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num);
  }

  /**
   * Check if text contains salary information
   */
  static containsSalary(text: string): boolean {
    const salaryIndicators = [
      /\$[\d,]+/,
      /\d+,\d+\s*-\s*\d+,\d+/,
      /salary/i,
      /pay/i,
      /hourly/i,
      /annually/i,
      /per year/i,
      /per hour/i,
    ];

    return salaryIndicators.some(pattern => pattern.test(text));
  }
}
