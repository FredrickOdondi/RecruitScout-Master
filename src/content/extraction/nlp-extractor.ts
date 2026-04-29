/**
 * Natural language extraction for job data
 * Handles pattern matching and text analysis
 */
export class NLPExtractor {
  /**
   * Extract date from relative text (e.g., "2 days ago")
   */
  static parseRelativeDate(text: string): Date | null {
    const normalized = text.toLowerCase();
    const now = new Date();

    // Today
    if (normalized.includes('today') || normalized.includes('just now')) {
      return now;
    }

    // Yesterday
    if (normalized.includes('yesterday') || normalized.includes('1 day ago')) {
      now.setDate(now.getDate() - 1);
      return now;
    }

    // X days ago
    const daysMatch = normalized.match(/(\d+)\s*days?\s*ago/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      now.setDate(now.getDate() - days);
      return now;
    }

    // X weeks ago
    const weeksMatch = normalized.match(/(\d+)\s*weeks?\s*ago/i);
    if (weeksMatch) {
      const weeks = parseInt(weeksMatch[1], 10);
      now.setDate(now.getDate() - (weeks * 7));
      return now;
    }

    // X months ago
    const monthsMatch = normalized.match(/(\d+)\s*months?\s*ago/i);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[1], 10);
      now.setMonth(now.getMonth() - months);
      return now;
    }

    return null;
  }

  /**
   * Parse absolute date
   */
  static parseAbsoluteDate(text: string): Date | null {
    const date = new Date(text);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Parse location (city, state, country)
   */
  static parseLocation(text: string): { city?: string; state?: string; country?: string } {
    const parts = text.split(',').map(p => p.trim());
    const result: { city?: string; state?: string; country?: string } = {};

    if (parts.length >= 1) {
      result.city = parts[0];
    }
    if (parts.length >= 2) {
      result.state = parts[1];
    }
    if (parts.length >= 3) {
      result.country = parts[2];
    }

    return result;
  }

  /**
   * Detect employment type from text
   */
  static detectEmploymentType(text: string): string | undefined {
    const normalized = text.toLowerCase();

    const patterns = [
      { type: 'full-time', keywords: ['full-time', 'full time', 'ft', 'fulltime'] },
      { type: 'part-time', keywords: ['part-time', 'part time', 'pt', 'parttime'] },
      { type: 'contract', keywords: ['contract', 'contractor', 'consultant'] },
      { type: 'temporary', keywords: ['temporary', 'temp', 'seasonal'] },
      { type: 'internship', keywords: ['internship', 'intern', 'apprentice'] },
      { type: 'freelance', keywords: ['freelance', 'freelancer', 'self-employed'] },
    ];

    for (const pattern of patterns) {
      for (const keyword of pattern.keywords) {
        if (normalized.includes(keyword)) {
          return pattern.type;
        }
      }
    }

    return undefined;
  }

  /**
   * Detect location type from text
   */
  static detectLocationType(text: string): string | undefined {
    const normalized = text.toLowerCase();

    const patterns = [
      { type: 'remote', keywords: ['remote', 'work from home', 'wfh', 'telecommute', 'virtual'] },
      { type: 'hybrid', keywords: ['hybrid', 'mixed'] },
      { type: 'on-site', keywords: ['on-site', 'onsite', 'in-office', 'in person', 'office'] },
    ];

    for (const pattern of patterns) {
      for (const keyword of pattern.keywords) {
        if (normalized.includes(keyword)) {
          return pattern.type;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract skills from job description
   */
  static extractSkills(text: string): string[] {
    const skillPatterns = [
      /(?:skill|requirements|qualifications|technologies|stack)[:\s]*([^\n]+)/gi,
      /(?:must have|required|experience with)[:\s]*([^\n]+)/gi,
    ];

    const skills: string[] = [];

    for (const pattern of skillPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const skillText = match[1].trim();
          const extractedSkills = skillText
            .split(/[,;•]|and /i)
            .map(s => s.trim())
            .filter(s => s.length > 2 && s.length < 50);
          skills.push(...extractedSkills);
        }
      }
    }

    return [...new Set(skills)].slice(0, 20);
  }

  /**
   * Extract experience requirements
   */
  static extractExperience(text: string): { min?: number; max?: number; unit?: string } | null {
    const patterns = [
      /(\d+)\+?\s*years?\s*(?:of\s*)?(?:experience|exp)/i,
      /(\d+)\s*-\s*(\d+)\s*years?\s*(?:of\s*)?(?:experience|exp)/i,
      /experience\s*:\s*(\d+)\+?\s*years?/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const min = parseInt(match[1], 10);
        const max = match[2] ? parseInt(match[2], 10) : undefined;
        return { min, max, unit: 'years' };
      }
    }

    return null;
  }

  /**
   * Extract education requirements
   */
  static extractEducation(text: string): string | undefined {
    const patterns = [
      /(?:education|degree)[:\s]*([^\n]+)/gi,
      /(?:bachelor'?s?|master'?s?|phd|doctorate)\s*(?:degree)?/gi,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  /**
   * Clean and normalize text
   */
  static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, ' ')
      .trim();
  }

  /**
   * Extract keywords from text
   */
  static extractKeywords(text: string, minFrequency: number = 2): string[] {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const frequency = new Map<string, number>();
    words.forEach(word => {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    });

    return Array.from(frequency.entries())
      .filter(([_, count]) => count >= minFrequency)
      .map(([word, _]) => word)
      .slice(0, 20);
  }
}
