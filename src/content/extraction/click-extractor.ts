import { JobData } from '../../shared/types';
import { extractText } from '../../shared/utils';

export class ClickThroughExtractor {
    /**
     * Automatically clicks job cards to load and extract their full descriptions.
     */
    static async enrichWithDescriptions(jobs: JobData[]): Promise<JobData[]> {
        console.log(`[RecruitScout] Starting Click-Through visual extraction on ${jobs.length} jobs to find hidden descriptions...`);
        const jobsCopy = [...jobs];

        // Checkpoint: Save all basic data instantly before we begin clicking, in case of an abrupt navigation exit
        try {
            await new Promise(resolve => {
                chrome.runtime.sendMessage({ type: 'ADD_JOBS', payload: jobsCopy }, resolve);
            });
        } catch (e) { console.log('Incremental save init failed'); }

        // Find all clickable job cards on the screen
        // Indeed uses these common classes for the list items
        const clickables = Array.from(document.querySelectorAll('li.css-5lfssm, a.jcs-JobTitle, .job_seen_beacon, .jobsearch-SerpJobCard'));

        for (let i = 0; i < clickables.length; i++) {
            const card = clickables[i] as HTMLElement;
            try {
                // Figure out which job this card belongs to by matching the title
                const titleElement = card.querySelector('.jcs-JobTitle, h2, .jobTitle, [id^="jobTitle"]');
                if (!titleElement) continue;

                const cardTitle = extractText(titleElement).trim().toLowerCase();
                const companyElement = card.querySelector('[data-testid="company-name"], .companyName');
                const cardCompany = companyElement ? extractText(companyElement).trim().toLowerCase() : '';

                // Find a matching job that doesn't already have a massive full description
                const matchedJob = jobsCopy.find(j => {
                    const isTitleMatch = j.title.toLowerCase().includes(cardTitle) || cardTitle.includes(j.title.toLowerCase());
                    const isCompanyMatch = !cardCompany || j.company.toLowerCase().includes(cardCompany) || cardCompany.includes(j.company.toLowerCase());
                    const needsDescription = !j.description || j.description.length < 500; // Snippets are ~200 chars
                    return isTitleMatch && isCompanyMatch && needsDescription;
                });

                if (matchedJob) {
                    console.log(`[RecruitScout] Clicking job: "${matchedJob.title}" to extract full description...`);

                    // Click the card
                    const clickableTarget = card.querySelector('a') || card;

                    // Scroll into view so the click isn't intercepted
                    clickableTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Human-like pre-click hesitation (Wait 800ms to 1500ms for smooth scroll & reading)
                    const preClickDelay = Math.floor(Math.random() * (1500 - 800 + 1)) + 800;
                    await new Promise(r => setTimeout(r, preClickDelay));

                    // Prevent accidental external browser native navigation that permanently kills our content script
                    const isAnchor = clickableTarget.tagName.toLowerCase() === 'a';
                    const prevHref = clickableTarget.getAttribute('href');
                    if (isAnchor) {
                        clickableTarget.removeAttribute('href');
                    }

                    (clickableTarget as HTMLElement).click();

                    if (isAnchor && prevHref) {
                        clickableTarget.setAttribute('href', prevHref);
                    }

                    // Wait dynamically for the right pane to load.
                    // Instead of stopping at the first match (which might just be the header), 
                    // we scan the main document AND all iframes, picking the candidate with the most text.
                    const maxWaitTime = 6000;
                    const startTime = Date.now();
                    let bestText = '';

                    while (Date.now() - startTime < maxWaitTime) {
                        bestText = '';
                        const candidates: Element[] = [];

                        // 1. Check main document for specific description IDs/classes and wrappers
                        const selectors = [
                            '#jobDescriptionText', 
                            '.jobsearch-jobDescriptionText', 
                            '[data-testid="job-description-container"]',
                            '.jobsearch-ViewJobLayout-description', 
                            '.jobsearch-JobComponent-description'
                        ];

                        for (const sel of selectors) {
                            const el = document.querySelector(sel);
                            if (el) candidates.push(el);
                        }

                        // 2. Check iframes (Indeed often hides the body inside an iframe while the header is in the main doc)
                        const iframes = Array.from(document.querySelectorAll('iframe'));
                        for (const iframe of iframes) {
                            try {
                                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                                if (doc) {
                                    for (const sel of selectors) {
                                        const el = doc.querySelector(sel);
                                        if (el) candidates.push(el);
                                    }
                                    if (doc.body) candidates.push(doc.body);
                                }
                            } catch (e) { /* ignore cross-origin */ }
                        }

                        // Evaluate all candidates and find the one with the longest extracted text
                        for (const el of candidates) {
                            const text = extractText(el);
                            if (text && text.length > bestText.length) {
                                bestText = text;
                            }
                        }

                        // If we found a massive block of text, it's definitely the description body. Break early.
                        if (bestText.length > 400) {
                            break; 
                        }

                        // Wait 500ms before checking again
                        await new Promise(r => setTimeout(r, 500));
                    }

                    // Pre-calculate human reading delay
                    const readingDelay = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500;
                    await new Promise(r => setTimeout(r, readingDelay));

                    // Accept the best text we found (even if it's shorter than 400, it's the best available)
                    if (bestText && bestText.length > 20) {
                        matchedJob.description = bestText;
                        console.log(`[RecruitScout] Successfully extracted ${bestText.length} characters for "${matchedJob.title}"`);
                        
                        // Incremental Checkpoint Stream
                        try {
                            await new Promise(resolve => {
                                chrome.runtime.sendMessage({ type: 'ADD_JOBS', payload: [matchedJob] }, resolve);
                            });
                        } catch(e) { console.log('Incremental save failed for job', matchedJob.title, e); }
                    }
                }
            } catch (err) {
                console.error('[RecruitScout] ClickThroughExtractor error on card', i, err);
            }
        }

        console.log('[RecruitScout] Automated click-through extraction completed.');
        return jobsCopy;
    }
}
