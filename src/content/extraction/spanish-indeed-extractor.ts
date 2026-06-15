import { JobData } from '../../shared/types';
import { generateId } from '../../shared/utils';
import { SalaryParser } from './salary-parser';

export class SpanishIndeedExtractor {
  static extractAllJobs(): JobData[] {
    const jobs: JobData[] = [];

    // Find the script tag containing the payload
    const scripts = document.querySelectorAll('script');
    let payloadStr = '';

    for (const script of Array.from(scripts)) {
      if (script.textContent && script.textContent.includes('window.mosaic.providerData["mosaic-provider-jobcards"]=')) {
        payloadStr = script.textContent;
        break;
      }
    }

    if (!payloadStr) return jobs;

    try {
      // Extract the JSON object from the script text
      const startIndex = payloadStr.indexOf('window.mosaic.providerData["mosaic-provider-jobcards"]=') + 55;
      let endIndex = payloadStr.indexOf('window.mosaic.providerData["', startIndex);
      if (endIndex === -1) {
        endIndex = payloadStr.lastIndexOf(';');
      }

      const jsonStr = payloadStr.substring(startIndex, endIndex).trim().replace(/;$/, '');
      const data = JSON.parse(jsonStr);

      const results = data?.metaData?.mosaicProviderJobCardsModel?.results || [];

      results.forEach((result: any) => {
        const title = result.title;
        const company = result.company;
        const location = result.formattedLocation || result.jobLocationCity;
        // Extract description: handles both legacy string snippets and new object-based ones
        let snippet = '';
        if (typeof result.snippet === 'string') {
          snippet = result.snippet;
        } else if (result.snippet && typeof result.snippet === 'object' && result.snippet.text) {
          snippet = result.snippet.text;
        } else if (result.displaySnippet && typeof result.displaySnippet === 'string') {
          snippet = result.displaySnippet;
        } else if (result.displaySnippet && typeof result.displaySnippet === 'object' && result.displaySnippet.text) {
          snippet = result.displaySnippet.text;
        }

        let salaryRaw = result.salarySnippet?.text || undefined;
        let employmentTypeStr = '';

        // Sometimes employment types are nested in Taxonomy tags
        if (result.taxonomyAttributes && Array.isArray(result.taxonomyAttributes)) {
          const typeTags = result.taxonomyAttributes
            .filter((attr: any) => attr.attributes && attr.attributes.length > 0)
            .map((attr: any) => attr.attributes.map((a: any) => a.label).join(', '))
            .join(' | ');

          if (typeTags) {
            employmentTypeStr = typeTags;
          }
        }

        if (result.jobTypes && Array.isArray(result.jobTypes)) {
          employmentTypeStr += ' ' + result.jobTypes.join(', ');
        }

        const origin = window.location.origin;
        const url = result.viewJobLink ? `${origin}${result.viewJobLink}` : result.link;

        const job: JobData = {
          id: generateId(),
          title,
          company,
          location,
          url: url || window.location.href,
          employmentType: employmentTypeStr ? this.normalizeEmploymentType(employmentTypeStr.toLowerCase()) : undefined,
          salary: salaryRaw ? SalaryParser.parse(salaryRaw) : undefined,
          description: this.cleanHtmlSnippet(snippet),
          datePostedRaw: result.formattedRelativeTime || result.pubDate,
          source: 'es.indeed.com',
          extractedAt: new Date().toISOString(),
          status: 'active',
          metadata: result.companyProfileLink
            ? { companyProfileLink: `${origin}${result.companyProfileLink}` }
            : undefined,
        };

        if (title && company) {
          jobs.push(job);
        }
      });
    } catch (err) {
      console.error('[RecruitScout] SpanishIndeedExtractor failed to parse mosaic data:', err);
    }

    return jobs;
  }

  private static normalizeEmploymentType(text: string): any {
    const EMPLOYMENT_TYPE_KEYWORDS = {
      'full-time': ['full-time', 'full time', 'ft', 'fulltime'],
      'part-time': ['part-time', 'part time', 'pt', 'parttime'],
      'contract': ['contract', 'contractor', 'consultant'],
      'temporary': ['temporary', 'temp', 'seasonal'],
      'internship': ['internship', 'intern', 'apprentice'],
      'freelance': ['freelance', 'freelancer', 'self-employed'],
    } as const;

    for (const [type, keywords] of Object.entries(EMPLOYMENT_TYPE_KEYWORDS)) {
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (regex.test(text)) {
          return type;
        }
      }
    }
    return undefined;
  }

  private static cleanHtmlSnippet(html: string): string {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }
}
