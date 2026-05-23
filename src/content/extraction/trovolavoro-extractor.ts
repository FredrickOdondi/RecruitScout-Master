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

        const description = snippetEl?.textContent?.trim() || '';

        let company = '';
        let location = '';

        // First try explicit company link (already selected as companyEl above)
        if (companyEl) {
            company = companyEl.textContent?.replace(/^[\s-]+/, '').trim() || '';
        }

        // Robustly extract location by finding the map icon and walking sibling nodes
        const mapIcon = card.querySelector('.google-maps, [class*="map-marker"], [class*="location"]');
        if (mapIcon && mapIcon.parentElement) {
            let current: Node | null = mapIcon.nextSibling;
            let locLine = '';
            
            // Walk siblings until we hit a break, a div, or another icon
            while (current) {
                const nodeName = current.nodeName.toUpperCase();
                const isIcon = (current as Element).classList?.contains('glyphicon') || 
                               (current as Element).classList?.contains('fa') ||
                               (current as Element).tagName?.toLowerCase() === 'i';
                               
                if (nodeName === 'BR' || nodeName === 'DIV' || isIcon) {
                    break;
                }
                
                locLine += current.textContent || '';
                current = current.nextSibling;
            }
            
            // Clean up common prefixes and whitespace
            locLine = locLine.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            locLine = locLine.replace(/^(Site|Sede):\s*/i, '');
            
            if (locLine) {
                // If it contains a " - ", the last part is usually the company name
                if (locLine.includes(' - ')) {
                    const parts = locLine.split(' - ');
                    const potentialCompany = parts.pop()?.trim();
                    location = parts.join(' - ').trim();
                    
                    if (!company && potentialCompany) {
                        company = potentialCompany;
                    }
                } else {
                    location = locLine;
                }
            }
        }

        if (!company) {
            company = 'Unknown Company';
        }

        // Only parse what looks like a valid job
        if (title && url) {
          const job: JobData = {
            id: generateId(),
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
