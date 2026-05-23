import { JobData } from '../../shared/types';
import { generateId } from '../../shared/utils';
import { FieldExtractors } from './field-extractors';
import { SalaryParser } from './salary-parser';

/**
 * Platform-specific extractor for Trovolavoro
 */
export class TrovolavoroExtractor {
  
  /**
   * Extract all jobs from a Trovolavoro search results page
   */
  static extractAllJobs(): JobData[] {
    const jobs: JobData[] = [];
    const now = new Date().toISOString();

    console.log('[RecruitScout] Running TrovolavoroExtractor...');

    const jobCards = document.querySelectorAll('div.singleResult');

    for (const card of Array.from(jobCards)) {
      try {
        const titleEl = card.querySelector('.dataContainer a') as HTMLAnchorElement;
        const companyEl = card.querySelector('.companyLink') as HTMLElement;
        const snippetEl = card.querySelector('.descriptionContainer') as HTMLElement;
        
        if (!titleEl) continue;

        const title = titleEl.textContent?.trim() || '';
        let url = titleEl.href || '';
        
        // Ensure absolute URL
        if (url && url.startsWith('..')) {
           url = new URL(url, window.location.href).href;
        } else if (url && url.startsWith('/')) {
           url = new URL(url, window.location.origin).href;
        }

        const company = companyEl?.textContent?.trim() || 'Unknown Company';
        const description = snippetEl?.textContent?.trim() || '';

        // Extract location robustly by finding the "Site:" or "Sede:" label
        let location = '';
        const detailsHead = card.querySelector('.detailsHead');
        if (detailsHead) {
            const labels = detailsHead.querySelectorAll('label');
            for (const label of Array.from(labels)) {
                if (label.textContent?.includes('Site:') || label.textContent?.includes('Sede:')) {
                    const parent = label.parentElement;
                    if (parent) {
                        const clone = parent.cloneNode(true) as HTMLElement;
                        const innerLabel = clone.querySelector('label');
                        if (innerLabel) innerLabel.remove();
                        // Clean up whitespace and commas
                        location = clone.textContent?.replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '').trim() || '';
                        break;
                    }
                }
            }
        }

        // Only parse what looks like a valid job
        if (title && url) {
          const job: JobData = {
            id: generateId(url),
            title,
            company,
            location,
            url,
            description,
            source: 'trovolavoro.it',
            extractedAt: now,
          };

          // Try to parse salary from snippet if available
          if (description) {
            const salaryInfo = SalaryParser.parse(description);
            if (salaryInfo) {
              job.salary = salaryInfo;
            }
          }

          jobs.push(job);
        }
      } catch (err) {
        console.warn('[RecruitScout] Error extracting individual Trovolavoro job card:', err);
      }
    }

    return jobs;
  }
}
