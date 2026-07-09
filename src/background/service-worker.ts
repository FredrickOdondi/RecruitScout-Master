import { stateManager } from './state-manager';
import { messageRouter } from './message-router';
import { extractionQueue } from './extraction-queue';
import { storage } from '../shared/storage';
import { MessageType, ExtensionMessage, ExtractionStatus } from '../shared/types';
import { MESSAGE_TIMEOUT } from '../shared/constants';
import { parseDomain } from '../shared/utils';
import { supabaseClient } from '../shared/supabase';
import { googleSheetsClient } from '../lib/export/google-sheets';

function extractDomainFromUrl(url: string): string {
  const hostname = parseDomain(url);
  return hostname.replace(/^www\./, '');
}

// In-memory cache shared across all resolution calls per service worker lifecycle
const _domainCache = new Map<string, string>();

let activeClientNameForScraping: string | null = null;

/**
 * Normalize company name by stripping legal suffixes from the end
 * Only removes suffixes at the very end of the string
 * Handles Italian and International legal suffixes
 * Protects against false positives like "SPA Resort"
 */
function normalizeCompanyName(companyName: string): string {
  if (!companyName) return '';

  // Comprehensive list of legal suffixes (order matters - most specific first)
  const legalSuffixes = [
    // Italian suffixes with dots (most precise)
    /\bS\.p\.A\.$/, /\bS\.r\.l\.$/, /\bS\.c\.a\.$/, /\bS\.c\.p\.A\.$/,
    /\bS\.p\.A$/, /\bS\.r\.l$/, /\bS\.c\.a$/, /\bS\.c\.p\.A$/,

    // Italian suffixes with case-specific patterns to avoid false positives
    /\bSpA$/, /\bSrl$/, /\bSPA$/, /\bSRL$/, /\bsrl$/,

    // French SA variations
    /\bS\.A\.$/, /\bS\.A$/, /\bSA$/,

    // English/American suffixes with dots
    /\bL\.L\.C\.$/, /\bCo\.$/, /\bLtd\.$/, /\bCorp\.$/, /\bInc\.$/,
    /\bCo$/, /\bLtd$/, /\bCorp$/, /\bInc$/,

    // Two-letter international abbreviations (case-specific to avoid false positives)
    /\bPLC$/, /\bAG$/, /\bGmbH$/, /\bLLC$/,

    // Three-letter variations (case-specific)
    /\bltd$/, /\bco$/, /\binc$/, /\bgmbh$/, /\bllc$/,

    // Four+ letter patterns (case-insensitive to handle capitalization)
    /\blimited$/i, /\bincorporated$/i, /\bcorporation$/i, /\bcompany$/i,

    // International variations
    /\bSAS$/, /\bSARL$/, /\bBV$/, /\bNV$/, /\bAB$/, /\bAS$/,
    /\bOy$/, /\bPty$/, /\bLtda$/, /\bZAO$/, /\bOOO$/,

    // General case-insensitive patterns for less common variations
    /\b(?:corporación|sociedad)$/i,
  ];

  let normalized = companyName.trim();

  // Try each pattern exactly once (no iterations to avoid over-stripping)
  for (const pattern of legalSuffixes) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, '').trim();
      break; // Stop after first match
    }
  }

  return normalized;
}

/** Returns { domain, matchedName } so we can check name similarity */
async function fetchDomainFromClearbit(companyName: string): Promise<{ domain: string; matchedName: string }> {
  if (!companyName) return { domain: '', matchedName: '' };
  const cached = _domainCache.get(companyName);
  if (cached !== undefined) return { domain: cached, matchedName: '' };

  try {
    // Normalize company name by stripping legal suffixes before API call
    const searchName = normalizeCompanyName(companyName);
    const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(searchName)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0 && data[0].domain) {
        const domain = data[0].domain as string;
        const matchedName = (data[0].name as string) || '';
        _domainCache.set(companyName, domain);
        return { domain, matchedName };
      }
    }
  } catch { /* network failure */ }

  _domainCache.set(companyName, '');
  return { domain: '', matchedName: '' };
}

async function fetchDomainFromIndeedProfile(profileUrl: string): Promise<string> {
  if (!profileUrl) return '';
  const cached = _domainCache.get(profileUrl);
  if (cached !== undefined) return cached;

  try {
    const response = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) { _domainCache.set(profileUrl, ''); return ''; }

    const html = await response.text();

    // Pattern 1: data-testid="companyWebsite" href
    const m1 = html.match(/data-testid="companyWebsite"[^>]*href="([^"]+)"/);
    if (m1?.[1]) { const d = extractDomainFromUrl(m1[1]); _domainCache.set(profileUrl, d); return d; }

    // Pattern 2: href before "Company website" label (Italian too)
    const m2 = html.match(/href="(https?:\/\/[^"]+)"[^>]*>\s*(?:Company website|Sito web aziendale|Website)\s*<\/a>/i);
    if (m2?.[1]) { const d = extractDomainFromUrl(m2[1]); _domainCache.set(profileUrl, d); return d; }

    // Pattern 3: JSON-LD Organization url
    const m3 = html.match(/"@type"\s*:\s*"Organization"[^}]*"url"\s*:\s*"([^"]+)"/);
    if (m3?.[1]) { const d = extractDomainFromUrl(m3[1]); _domainCache.set(profileUrl, d); return d; }

  } catch { /* fetch failed */ }

  _domainCache.set(profileUrl, '');
  return '';
}

async function fetchDomainFromLinkedIn(companyName: string): Promise<string> {
  if (!companyName) return '';
  const cacheKey = `linkedin:${companyName}`;
  const cached = _domainCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    // Normalize company name for URL, keeping dots
    const normalized = normalizeCompanyName(companyName)
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-|-$/g, '');

    if (!normalized) return '';

    const url = `https://www.linkedin.com/company/${normalized}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const html = await response.text();
      // Look for the website URL in the JSON-LD or raw text
      const jsonLdMatch = html.match(/"sameAs"\s*:\s*"([^"]+)"/);
      if (jsonLdMatch && !jsonLdMatch[1].includes('linkedin.com')) {
        const domain = extractDomainFromUrl(jsonLdMatch[1]);
        if (domain) {
          _domainCache.set(cacheKey, domain);
          return domain;
        }
      }

      // Fallback: look for "companyPageUrl":"https://www.bairesdev.com/"
      const companyUrlMatch = html.match(/"companyPageUrl"\s*:\s*"([^"]+)"/);
      if (companyUrlMatch && !companyUrlMatch[1].includes('linkedin.com')) {
        const domain = extractDomainFromUrl(companyUrlMatch[1]);
        if (domain) {
          _domainCache.set(cacheKey, domain);
          return domain;
        }
      }
    }
  } catch { /* fetch failed */ }

  _domainCache.set(cacheKey, '');
  return '';
}

// Supabase config
const SUPABASE_URL = 'http://72.60.215.34:8000';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

async function fetchDomainFromSupabase(companyName: string): Promise<string> {
  if (!companyName) return '';
  const cacheKey = `supa:${companyName}`;
  const cached = _domainCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // Helper: fire a single query against the Dbase table and return domain or ''
  const queryDbase = async (filterValue: string): Promise<string> => {
    // Table name URL-encoded: "Dbase - 24/6/26" -> "Dbase%20-%2024%2F6%2F26"
    const url = `${SUPABASE_URL}/rest/v1/Dbase%20-%2024%2F6%2F26` +
      `?select=Company%20Website` +
      `&Company%20Name=ilike.${filterValue}` +
      `&limit=1`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return '';
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return '';
    const website = data[0]['Company Website'] as string | undefined;
    if (!website) return '';
    return extractDomainFromUrl(website.startsWith('http') ? website : `https://${website}`);
  };

  try {
    const normalized = normalizeCompanyName(companyName);

    // Pass 1: Exact case-insensitive match on the original company name
    // e.g. "Esseci Studi e Consulenze Srl" -> ilike."Esseci Studi e Consulenze Srl"
    let domain = await queryDbase(encodeURIComponent(companyName));
    if (domain) {
      console.log(`[RecruitScout Dbase] ${companyName}: exact match -> ${domain}`);
      _domainCache.set(cacheKey, domain);
      return domain;
    }

    // Pass 2: Trailing wildcard match on normalized name (strips Srl, SpA, Inc, GmbH etc.)
    // Matches e.g. "Esseci Studi e Consulenze" against DB row "Esseci Studi e Consulenze S.r.l."
    if (normalized && normalized !== companyName) {
      domain = await queryDbase(`${encodeURIComponent(normalized)}*`);
      if (domain) {
        console.log(`[RecruitScout Dbase] ${companyName}: normalized match -> ${domain}`);
        _domainCache.set(cacheKey, domain);
        return domain;
      }
    }

    // Pass 3: Partial/fuzzy match using wildcards on normalized name
    // e.g. "Esseci Studi" -> ilike.*Esseci%20Studi*
    // Only run if the search term is long enough to avoid accidental false positives
    const searchTerm = normalized || companyName;
    if (searchTerm.length >= 5) {
      domain = await queryDbase(`*${encodeURIComponent(searchTerm)}*`);
      if (domain) {
        console.log(`[RecruitScout Dbase] ${companyName}: fuzzy match -> ${domain}`);
        _domainCache.set(cacheKey, domain);
        return domain;
      }
    }

    console.log(`[RecruitScout Dbase] ${companyName}: no match in any pass`);
  } catch (e) {
    console.error(`[RecruitScout Dbase] ${companyName}: error`, e);
  }

  _domainCache.set(cacheKey, '');
  return '';
}


async function fetchDomainFromWikidata(companyName: string): Promise<string> {
  if (!companyName) return '';
  const cacheKey = `wiki:${companyName}`;
  const cached = _domainCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    // Normalize company name by stripping legal suffixes before API call
    const searchName = normalizeCompanyName(companyName);
    // Step 1: Search Wikidata for the company entity
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchName)}&language=it&type=item&format=json&origin=*&limit=3`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!searchRes.ok) { _domainCache.set(cacheKey, ''); return ''; }

    const searchData = await searchRes.json();
    const results = searchData?.search || [];
    if (results.length === 0) { _domainCache.set(cacheKey, ''); return ''; }

    // Step 2: Fetch claims for top result and look for P856 (official website)
    const entityId = results[0].id;
    const claimsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=claims&format=json&origin=*`;
    const claimsRes = await fetch(claimsUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!claimsRes.ok) { _domainCache.set(cacheKey, ''); return ''; }

    const claimsData = await claimsRes.json();
    const claims = claimsData?.entities?.[entityId]?.claims;
    // P856 = official website
    const websiteClaims = claims?.P856;
    if (websiteClaims && websiteClaims.length > 0) {
      const website = websiteClaims[0]?.mainsnak?.datavalue?.value as string;
      if (website) {
        const domain = extractDomainFromUrl(website.startsWith('http') ? website : `https://${website}`);
        console.log(`[RecruitScout Wikidata] ${companyName}: found -> ${domain}`);
        _domainCache.set(cacheKey, domain);
        return domain;
      }
    }
    console.log(`[RecruitScout Wikidata] ${companyName}: no official website in Wikidata`);
  } catch (e) {
    console.error(`[RecruitScout Wikidata] ${companyName}: error`, e);
  }

  _domainCache.set(cacheKey, '');
  return '';
}

async function fetchDomainFromSearchEngine(companyName: string, location?: string): Promise<string> {
  if (!companyName) return '';
  const cacheKey = `search:${companyName}:${location || ''}`;
  const cached = _domainCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    // Construct search query
    const cleanName = normalizeCompanyName(companyName);
    let query = `"${cleanName}"`;
    if (location) {
      // Clean location (e.g., "Roma, Lazio" -> "Roma")
      const cleanLoc = location.split(',')[0].trim();
      query += ` "${cleanLoc}"`;
    }
    query += ` official website Italy`;

    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const html = await response.text();
      // Extract DuckDuckGo redirect URLs
      const urls = [...html.matchAll(/href="\/\/duckduckgo\.com\/l\/\?uddg=([^"&]+)/g)]
        .map(m => decodeURIComponent(m[1]));
      
      // Filter out common directories and social media
      const validUrls = urls.filter(u => {
        try {
          const uObj = new URL(u);
          const hostname = uObj.hostname.toLowerCase();
          const skipList = ['linkedin.com', 'wikipedia.org', 'facebook.com', 'instagram.com', 'bloomberg.com', 'crunchbase.com', 'indeed.com', 'glassdoor.com', 'monster.com', 'infojobs.it', 'youtube.com', 'twitter.com', 'tiktok.com', 'bedsandhotels.com', 'dnb.com', 'zoominfo.com', 'apollo.io', 'cerved.com', 'ufficiocamerale.it', 'registroimprese.it', 'paginegialle.it', 'kompass.com', 'pitchbook.com', 'reuters.com', 'cibus.it', 'usetorg.com', 'databasesets.com'];
          return !skipList.some(skip => hostname.includes(skip));
        } catch { return false; }
      });

      if (validUrls.length > 0) {
        const domain = extractDomainFromUrl(validUrls[0]);
        if (domain) {
          console.log(`[RecruitScout Search Engine] ${companyName}: found -> ${domain}`);
          _domainCache.set(cacheKey, domain);
          return domain;
        }
      }
    }
    console.log(`[RecruitScout Search Engine] ${companyName}: no valid results`);
  } catch (e) {
    console.error(`[RecruitScout Search Engine] ${companyName}: error`, e);
  }

  _domainCache.set(cacheKey, '');
  return '';
}


const STOP_WORDS = new Set(['the', 'and', 'for', 'group', 'services', 'company', 'inc', 'llc', 'corp', 'ltd', 'spa', 'srl']);

/** Compute word-overlap similarity between two company names (0–1) */
function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const common = [...wordsA].filter(w => wordsB.has(w)).length;
  return common / Math.max(wordsA.size, wordsB.size);
}

/** Validate domain using safety check (no network requests - bypasses CORS) */
async function validateDomain(domain: string, companyName: string): Promise<boolean> {
  if (!domain || !companyName) return false;
  const cacheKey = `safety:${domain}:${companyName}`;
  const cached = _domainCache.get(cacheKey);
  if (cached !== undefined) return cached === '1';

  // Safety check: domain name should contain company name
  // Remove common TLDs and extract the core domain name
  let domainCore = domain
    .replace(/\.(com|it|net|org|io|co|uk|eu|us|de|fr|es|pt|br|mx|ar|cl|pe|co\.uk|com\.au)$/i, '')
    .toLowerCase();

  // Extract words from company name (for multi-word names like "VOG PRODUCTS")
  const companyWords = companyName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Keep letters, numbers, and spaces
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word)); // Filter out short and stop words

  // Check if domain contains any significant company word
  // Use original domain with hyphens preserved for word comparison
  let foundMatch = false;
  for (const word of companyWords) {
    // Direct match (domainCore equals word)
    if (domainCore === word) {
      foundMatch = true;
      break;
    }
    // Strict containment (only for longer significant words)
    if (word.length >= 4 && domainCore.includes(word)) {
      foundMatch = true;
      break;
    }
  }

  if (!foundMatch && companyWords.length > 0) {
    const joined = companyWords.join('');
    if (domainCore === joined || domainCore.startsWith(joined) || joined.startsWith(domainCore)) {
      foundMatch = true;
    }
  }

  _domainCache.set(cacheKey, foundMatch ? '1' : '0');
  return foundMatch;
}

/**
 * Core resolver: run Clearbit + Wikidata in PARALLEL, cross-validate,
 * optionally confirm with HEAD request. Returns best domain or ''.
 */
async function resolveCompanyDomain(companyName: string): Promise<string> {
  const [clearbitResult, wikidataDomain] = await Promise.all([
    fetchDomainFromClearbit(companyName),
    fetchDomainFromWikidata(companyName),
  ]);

  const { domain: clearbitDomain, matchedName } = clearbitResult;
  const similarity = nameSimilarity(companyName, matchedName);
  const clearbitConfident = !!clearbitDomain && similarity >= 0.45;

  console.log(`[RecruitScout] ${companyName}: clearbit="${clearbitDomain}"(sim=${similarity.toFixed(2)}) wikidata="${wikidataDomain}"`);

  let winner = '';

  if (clearbitConfident && wikidataDomain) {
    if (clearbitDomain === wikidataDomain) {
      winner = clearbitDomain;
      console.log(`[RecruitScout] ${companyName}: ✅ both agree -> ${winner}`);
    } else {
      winner = wikidataDomain;
      console.log(`[RecruitScout] ${companyName}: ⚖️ disagreement, trusting Wikidata -> ${winner}`);
    }
  } else if (wikidataDomain) {
    winner = wikidataDomain;
    console.log(`[RecruitScout] ${companyName}: 📖 Wikidata only -> ${winner}`);
  } else if (clearbitConfident) {
    winner = clearbitDomain;
    console.log(`[RecruitScout] ${companyName}: 🔵 Clearbit confident -> ${winner}`);
  } else if (clearbitDomain) {
    console.log(`[RecruitScout] ${companyName}: ⚠️ Clearbit low confidence, validating ${clearbitDomain}...`);
    const valid = await validateDomain(clearbitDomain, companyName);
    winner = valid ? clearbitDomain : '';
    console.log(`[RecruitScout] ${companyName}: SAFETY CHECK -> ${valid ? 'accepted' : 'rejected'}`);
  }

  return winner;
}

/** Fire-and-forget: upsert a newly resolved domain into the Dbase - 24/6/26 table so the DB grows over time */
async function saveToSupabase(companyName: string, domain: string): Promise<void> {
  // Instantly cache it in memory to prevent race conditions (duplicate saves for the same company in a single batch)
  _domainCache.set(`supa:${companyName}`, domain);

  try {
    // Table name URL-encoded: "Dbase - 24/6/26" -> "Dbase%20-%2024%2F6%2F26"
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/Dbase%20-%2024%2F6%2F26`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ 'Company Name': companyName, 'Company Website': domain }),
        signal: AbortSignal.timeout(5000),
      }
    );
    if (response.ok || response.status === 201) {
      console.log(`[RecruitScout Dbase] saved: ${companyName} -> ${domain}`);
    } else {
      console.warn(`[RecruitScout Dbase] save failed for ${companyName}: ${response.status}`);
    }
  } catch (e) {
    console.error(`[RecruitScout Dbase] save error for ${companyName}:`, e);
  }
}

/** Extract a company website URL directly from the job description text */
function extractDomainFromDescription(description: string, _company: string): string {
  if (!description) return '';
  const skip = ['linkedin', 'indeed', 'facebook', 'twitter', 'instagram', 'glassdoor',
    'infojobs', 'monster', 'wikipedia', 'youtube', 'google',
    // URL shorteners — never valid company domains
    't.ly', 'bit.ly', 'tinyurl', 'ow.ly', 'goo.gl', 'buff.ly', 'short', 'rebrand.ly'];
  const urlMatches = [...description.matchAll(/https?:\/\/(?:www\.)?([a-zA-Z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)/g)];
  for (const match of urlMatches) {
    const domain = match[1].toLowerCase();
    if (!skip.some(s => domain.includes(s))) return domain;
  }
  const bareMatches = [...description.matchAll(/\bwww\.([a-zA-Z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)\b/g)];
  for (const match of bareMatches) {
    const domain = match[1].toLowerCase();
    if (!skip.some(s => domain.includes(s))) return domain;
  }
  return '';
}

/**
 * Generate the same deterministic job ID used by SupabaseClient.formatJob().
 * Keeps the deduplication key consistent across both layers.
 */
function generateJobId(url: string, title: string, company: string): string {
  const str = `${url}|${title}|${company}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * enrichAndSave — deduplicate BEFORE enrichment to avoid wasted API calls.
 *
 * Deduplication order (cheapest first):
 *   1. Local Chrome storage  — instant, free, works offline
 *   2. Supabase jobs table   — cross-node source of truth for swarm mode
 *
 * Returns { newCount, skippedCount } so callers can decide whether to keep
 * paginating (if the whole page was duplicates, stop early).
 */
async function enrichAndSave(jobs: any[]): Promise<{ newCount: number; skippedCount: number }> {
  if (!jobs || jobs.length === 0) return { newCount: 0, skippedCount: 0 };

  // Map jobs to inject the active client name
  const processedJobs = jobs.map(job => ({
    ...job,
    client: job.client || activeClientNameForScraping || null
  }));

  const settings = await storage.getSettings();
  const friendName = settings.friendName || '';
  const workerId = friendName || settings.instanceId || 'unknown';

  // ── Step 1: Build ID set from incoming jobs ───────────────────────────────
  const incomingWithIds = processedJobs.map(job => ({
    job,
    id: generateJobId(job.url || '', job.title || '', job.company || ''),
  }));

  // ── Step 2: Filter against local Chrome storage (fast, no network) ────────
  const localJobs = await storage.getJobs();
  const localKnownIds = new Set(localJobs.map((j: any) => generateJobId(j.url || '', j.title || '', j.company || '')));

  const notInLocal = incomingWithIds.filter(({ id }) => !localKnownIds.has(id));

  // ── Step 3: Cross-check Supabase for swarm accuracy (other nodes may have ─
  //           scraped these jobs even though our local storage is empty)      ─
  let trulyNew = notInLocal;
  if (notInLocal.length > 0) {
    const supabaseKnownIds = await supabaseClient.checkExistingIds(notInLocal.map(({ id }) => id));
    trulyNew = notInLocal.filter(({ id }) => !supabaseKnownIds.has(id));
  }

  const skippedCount = jobs.length - trulyNew.length;
  const newCount = trulyNew.length;

  let enriched: any[] = trulyNew.map(t => t.job);
  if (newCount > 0) {
    console.log(`[RecruitScout] 🆕 ${newCount} new jobs to enrich, ${skippedCount} already known — skipping duplicates.`);

    // ── Step 4: Enrich ONLY the new jobs ─────────────────────────────────────
    enriched = await Promise.all(trulyNew.map(async ({ job }) => {
      const metadata = { ...job.metadata, extractedBy: workerId };
      const jobWithMeta = { ...job, metadata, workerId };

      if (!jobWithMeta.company) return jobWithMeta;

      // PRE-ENRICHMENT: Clean messy company names (e.g. "Munters Humidity Control Italy S.r.l. (IT02)") 
      // by extracting the clean canonical name directly from the Indeed profile URL if it exists.
      const profileUrl = jobWithMeta.metadata?.companyProfileLink as string | undefined;
      if (profileUrl) {
        const match = profileUrl.match(/\/cmp\/([^/?]+)/);
        if (match && match[1]) {
          const cleanName = decodeURIComponent(match[1]).replace(/-/g, ' ').trim();
          if (cleanName && cleanName.length > 1) {
            console.log(`[RecruitScout] Cleaned company name: "${jobWithMeta.company}" -> "${cleanName}"`);
            jobWithMeta.company = cleanName;
          }
        }
      }

      try {
        // Priority 1: Dbase - 24/6/26 (large curated DB — fastest, no external API needed)
        const supaDomain = await fetchDomainFromSupabase(jobWithMeta.company);
        if (supaDomain) {
          console.log(`[RecruitScout] ${jobWithMeta.company}: domain from Dbase -> ${supaDomain}`);
          return { ...jobWithMeta, companyDomain: supaDomain };
        }

        // Priority 2: Clearbit + Wikidata in parallel with cross-validation
        const resolvedDomain = await resolveCompanyDomain(jobWithMeta.company);
        if (resolvedDomain) {
          saveToSupabase(jobWithMeta.company, resolvedDomain);
          return { ...jobWithMeta, companyDomain: resolvedDomain };
        }

        // Priority 3: Search Engine Fallback
        const searchDomain = await fetchDomainFromSearchEngine(jobWithMeta.company, jobWithMeta.location);
        if (searchDomain) {
          saveToSupabase(jobWithMeta.company, searchDomain);
          return { ...jobWithMeta, companyDomain: searchDomain };
        }

        // Priority 4: Indeed company profile page
        const profileUrl = jobWithMeta.metadata?.companyProfileLink as string | undefined;
        if (profileUrl) {
          const domain = await fetchDomainFromIndeedProfile(profileUrl);
          if (domain) {
            console.log(`[RecruitScout] ${jobWithMeta.company}: domain from Indeed profile -> ${domain}`);
            saveToSupabase(jobWithMeta.company, domain);
            return { ...jobWithMeta, companyDomain: domain };
          }
        }

        // Priority 5: Guess LinkedIn profile and fetch (last resort)
        const linkedInDomain = await fetchDomainFromLinkedIn(jobWithMeta.company);
        if (linkedInDomain) {
          console.log(`[RecruitScout] ${jobWithMeta.company}: domain from LinkedIn -> ${linkedInDomain}`);
          saveToSupabase(jobWithMeta.company, linkedInDomain);
          return { ...jobWithMeta, companyDomain: linkedInDomain };
        }
      } catch (e) {
        console.error(`[RecruitScout] enrichment error for ${jobWithMeta.company}:`, e);
      }
      return jobWithMeta;
    }));
  }

  // ── Step 5: Persist ──────────────────────────────────────────────────────
  // We always perform the upsert even if newCount is 0, because Click-Through 
  // might be sending an "upgrade" to an existing job (adding the description).
  const finalJobs = incomingWithIds.map(({ job, id }) => {
    const newlyEnriched = enriched.find(e => generateJobId(e.url || '', e.title || '', e.company || '') === id);
    if (newlyEnriched) return newlyEnriched;

    const existing = localJobs.find((j: any) => generateJobId(j.url || '', j.title || '', j.company || '') === id);
    if (existing) {
      return {
        ...existing,
        description: job.description || existing.description,
        salary: job.salary || existing.salary,
        metadata: { ...existing.metadata, ...job.metadata }
      };
    }
    return job;
  });
  await storage.addJobs(finalJobs);

  supabaseClient.upsertJobs(finalJobs, workerId).then(result => {
    if (result.error) {
      console.error('[RecruitScout] Supabase sync error:', result.error);
    } else {
      // Auto-sync to Google Sheets for matching enrolled clients
      triggerAutomaticGoogleSheetsSync(finalJobs).catch(err => {
        console.error('[RecruitScout] Auto-Sheets Sync failed:', err);
      });
    }
  });

  return { newCount, skippedCount };
}

function sanitizeCell(val: any): string {
  if (!val) return '';
  let s = String(val).trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (s.length > 49000) s = s.substring(0, 49000) + '\n...[truncated]';
  return s;
}

async function triggerAutomaticGoogleSheetsSync(jobs: any[]) {
  const clientJobsMap: Record<string, any[]> = {};
  for (const job of jobs) {
    if (job.client) {
      if (!clientJobsMap[job.client]) {
        clientJobsMap[job.client] = [];
      }
      clientJobsMap[job.client].push(job);
    }
  }

  const clientNames = Object.keys(clientJobsMap);
  if (clientNames.length === 0) return;

  // Load unique enrolled clients from Supabase
  const clientsRes = await supabaseClient.getClients();
  if (clientsRes.error || !clientsRes.data) {
    console.error('[RecruitScout] Auto-sync failed to load enrolled clients:', clientsRes.error);
    return;
  }

  const enrolledClients = clientsRes.data;

  for (const clientName of clientNames) {
    const client = enrolledClients.find((c: any) => c.name === clientName);
    if (!client) {
      console.warn(`[RecruitScout] Enrolled client details not found for client stamp "${clientName}". Skipping auto sheets sync.`);
      continue;
    }

    if (!client.apps_script_url) {
      console.warn(`[RecruitScout] Enrolled client "${clientName}" does not have an Apps Script Web App URL. Skipping auto sheets sync.`);
      continue;
    }

    let clientJobs = clientJobsMap[clientName].filter((job: any) => job.description && job.description.trim() !== '');
    if (clientJobs.length === 0) {
      console.log(`[RecruitScout] No jobs with non-empty descriptions for client "${clientName}". Skipping auto sync.`);
      continue;
    }

    // ── Spanish Companies Whitelist Filter ───────────────────────────────────
    // For jobs sourced from es.indeed.com, only allow companies listed in the
    // Supabase Spanish_Companies table — UNLESS the whitelist is disabled in
    // Engine Settings, in which case all Spanish Indeed jobs pass through.
    const hasSpanishJobs = clientJobs.some((job: any) => job.source === 'es.indeed.com');
    if (hasSpanishJobs) {
      const engineSettings = await storage.getSettings();
      // spanishWhitelistEnabled defaults to true (filter ON) if never explicitly set
      const whitelistActive = engineSettings.spanishWhitelistEnabled !== false;

      if (whitelistActive) {
        const spanishWhitelist = await supabaseClient.getSpanishCompanies();
        const beforeCount = clientJobs.length;
        clientJobs = clientJobs.filter((job: any) => {
          // Non-Spanish Indeed jobs always pass through
          if (job.source !== 'es.indeed.com') return true;
          // Empty whitelist = block everything
          if (spanishWhitelist.size === 0) return false;
          // Case-insensitive company name match
          return spanishWhitelist.has((job.company || '').toLowerCase().trim());
        });
        const dropped = beforeCount - clientJobs.length;
        if (dropped > 0) {
          console.log(`[RecruitScout] 🇪🇸 Spanish whitelist: filtered out ${dropped} job(s) not in Spanish_Companies — only ${clientJobs.length} job(s) will sync to sheet.`);
        } else {
          console.log(`[RecruitScout] 🇪🇸 Spanish whitelist: all ${clientJobs.length} Spanish Indeed job(s) matched — no filtering needed.`);
        }
      } else {
        console.log(`[RecruitScout] 🇪🇸 Spanish whitelist: DISABLED — sending all ${clientJobs.filter((j: any) => j.source === 'es.indeed.com').length} Spanish Indeed job(s) to sheet without filtering.`);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (clientJobs.length === 0) {
      console.log(`[RecruitScout] No jobs remaining after Spanish whitelist filter for client "${clientName}". Skipping sync.`);
      continue;
    }
    const headers = [
      'job_title',
      'company',
      'company_domain',
      'job_location',
      'description',
      'job_post_url',
      'date_posted',
      'employment_type',
      'salary',
      'status',
      'source'
    ];

    // Ensure all jobs have the absolute correct domain by consulting Supabase's domain DB one last time
    // This prevents the Google Sheet from receiving raw/wrong domains from local storage cache
    for (const job of clientJobs) {
      if (job.company) {
        const supaDomain = await fetchDomainFromSupabase(job.company);
        if (supaDomain) {
          job.companyDomain = supaDomain;
        }
      }
    }

    const rows = [
      headers,
      ...clientJobs.map(job => [
        sanitizeCell(job.title || ''),
        sanitizeCell(job.company || ''),
        sanitizeCell(job.companyDomain || job.companydomain || ''),
        sanitizeCell(job.location || ''),
        sanitizeCell(job.description || ''),
        sanitizeCell(job.url || ''),
        sanitizeCell(job.datePosted || job.dateposted || ''),
        sanitizeCell(job.employmentType || job.employmenttype || ''),
        sanitizeCell(job.salary || ''),
        sanitizeCell(job.status || 'Active'),
        sanitizeCell(job.source || '')
      ])
    ];

    console.log(`[RecruitScout] 🚀 Automatically syncing ${clientJobs.length} jobs to enrolled client "${clientName}" Google Sheet...`);

    try {
      await fetch(client.apps_script_url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          spreadsheetId: client.spreadsheet_id || '',
          sheetName: client.sheet_name || 'Sheet1',
          data: rows
        })
      });
      console.log(`[RecruitScout] ✓ Auto-synced jobs to "${clientName}" successfully.`);
    } catch (err) {
      console.error(`[RecruitScout] ❌ Auto-sync failed for client "${clientName}":`, err);
    }
  }
}

/**
 * Background Service Worker - Main orchestration hub
 */
class ServiceWorker {
  private isInstalled = false;
  private currentTabId: number | null = null;
  private extractionInterval: number | null = null;
  // Instant abort flag — set synchronously so every await checkpoint sees it immediately
  private abortRequested = false;
  private isPollingQueue = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize storage manager
    await storage.initialize();

    // Initialize state manager
    await stateManager.initialize();

    // Setup message handlers
    this.setupMessageHandlers();

    // Setup event listeners
    this.setupEventListeners();

    console.log('[RecruitScout] Service Worker initialized');
  }

  private setupMessageHandlers(): void {
    console.log('[RecruitScout] Setting up message handlers...');

    // Get current state
    messageRouter.on(MessageType.GET_STATE, async () => {
      console.log('[RecruitScout] Handling GET_STATE');
      return stateManager.getState();
    });

    // Update state
    messageRouter.on(MessageType.UPDATE_STATE, async (message) => {
      console.log('[RecruitScout] Handling UPDATE_STATE');
      await stateManager.setState(message.payload);
      return stateManager.getState();
    });

    // Start extraction
    messageRouter.on(MessageType.START_EXTRACTION, async (message, sender) => {
      console.log('[RecruitScout] Handling START_EXTRACTION', { payload: message.payload, sender });
      return this.startExtraction(message.payload, sender);
    });

    // Start bulk extraction
    messageRouter.on(MessageType.START_BULK_EXTRACTION, async (message, sender) => {
      console.log('[RecruitScout] Handling START_BULK_EXTRACTION', { payload: message.payload, sender });
      return this.startBulkExtraction(message.payload, sender);
    });

    // Stop extraction
    messageRouter.on(MessageType.STOP_EXTRACTION, async () => {
      console.log('[RecruitScout] Handling STOP_EXTRACTION');
      const settings = await storage.getSettings();
      if (settings.pollingEnabled) {
        await storage.setSettings({ ...settings, pollingEnabled: false });
      }
      return this.stopExtraction();
    });

    // Pause extraction
    messageRouter.on(MessageType.PAUSE_EXTRACTION, async () => {
      console.log('[RecruitScout] Handling PAUSE_EXTRACTION');
      return this.pauseExtraction();
    });

    // Get jobs
    messageRouter.on(MessageType.GET_JOBS, async () => {
      console.log('[RecruitScout] Handling GET_JOBS');
      return await storage.getJobs();
    });

    // Add jobs — enrich company domains in background before saving
    messageRouter.on(MessageType.ADD_JOBS, async (message) => {
      const jobs = message.payload as any[];
      await enrichAndSave(jobs);
      return await storage.getJobs();
    });

    // Update job
    messageRouter.on(MessageType.UPDATE_JOB, async (message) => {
      const { id, updates } = message.payload;
      await storage.updateJob(id, updates);
      return { success: true };
    });

    // Delete jobs
    messageRouter.on(MessageType.DELETE_JOBS, async (message) => {
      await storage.deleteJobs(message.payload);

      // Also delete from Supabase (fire-and-forget)
      if (message.payload && message.payload.length > 0) {
        supabaseClient.deleteJobs(message.payload).then(result => {
          if (result.error) {
            console.error('[RecruitScout] Supabase delete error:', result.error);
          } else {
            console.log(`[RecruitScout] Supabase delete: ${result.data?.deleted} jobs deleted`);
          }
        });
      }

      return await storage.getJobs();
    });

    // Export jobs
    messageRouter.on(MessageType.EXPORT_JOBS, async (message) => {
      return this.exportJobs(message.payload);
    });

    // Get settings
    messageRouter.on(MessageType.GET_SETTINGS, async () => {
      return await storage.getSettings();
    });

    // Update settings
    messageRouter.on(MessageType.UPDATE_SETTINGS, async (message) => {
      await storage.setSettings(message.payload);
      return await storage.getSettings();
    });

    // Incremental Jobs Saving Checkpoint
    messageRouter.on('ADD_JOBS' as MessageType, async (message) => {
      if (message.payload && message.payload.length > 0) {
        await enrichAndSave(message.payload);
      }
      return { success: true };
    });

    // Save Bulk Job Titles Queue
    messageRouter.on('SAVE_BULK' as any, async (message) => {
      const titles = message.payload;
      await chrome.storage.local.set({ 'recruitscout_pending_bulk': titles });
      return { success: true };
    });

    // Get progress
    messageRouter.on(MessageType.GET_PROGRESS, async () => {
      return {
        ...stateManager.getState(),
        progress: stateManager.getProgress(),
      };
    });

    // Resolve company domain via Clearbit API (proxied through background to avoid CSP blocks)
    messageRouter.on(MessageType.RESOLVE_DOMAIN, async (message) => {
      const companyName: string = message.payload?.companyName || '';
      if (!companyName) return { domain: '' };

      try {
        const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(companyName)}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0 && data[0].domain) {
            return { domain: data[0].domain as string };
          }
        }
      } catch {
        // Network failure or timeout — return empty so content script falls back
      }

      return { domain: '' };
    });

    // Fetch company website from Indeed company profile page
    messageRouter.on(MessageType.FETCH_COMPANY_WEBSITE, async (message) => {
      const profileUrl: string = message.payload?.profileUrl || '';
      if (!profileUrl) return { domain: '' };

      try {
        const response = await fetch(profileUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html',
          },
          signal: AbortSignal.timeout(6000),
        });

        if (!response.ok) return { domain: '' };

        const html = await response.text();

        // Pattern 1: data-testid="companyWebsite" or nearby href
        const testIdMatch = html.match(/data-testid="companyWebsite"[^>]*href="([^"]+)"/);
        if (testIdMatch?.[1]) return { domain: extractDomainFromUrl(testIdMatch[1]) };

        // Pattern 2: <a ... href="https://example.com" ... >Company website</a> (case insensitive)
        const websiteLinkMatch = html.match(/href="(https?:\/\/[^"]+)"[^>]*>\s*(?:Company website|Sito web aziendale|Website)\s*<\/a>/i);
        if (websiteLinkMatch?.[1]) return { domain: extractDomainFromUrl(websiteLinkMatch[1]) };

        // Pattern 3: JSON-LD embedded in profile page with @type Organization
        const jsonLdMatch = html.match(/"@type"\s*:\s*"Organization"[^}]*"url"\s*:\s*"([^"]+)"/);
        if (jsonLdMatch?.[1]) return { domain: extractDomainFromUrl(jsonLdMatch[1]) };

      } catch {
        // Fetch failed or timed out
      }

      return { domain: '' };
    });

    // Clear all data
    messageRouter.on(MessageType.CLEAR_ALL, async () => {
      await storage.clearAllData();
      await stateManager.resetState();
      return { success: true };
    });

    // ===== SUPABASE HANDLERS =====

    // Get jobs from Supabase
    messageRouter.on('SUPABASE_GET_JOBS' as MessageType, async (message) => {
      const result = await supabaseClient.getJobs(message.payload);
      return result;
    });

    // Get jobs by company from Supabase
    messageRouter.on('SUPABASE_GET_JOBS_BY_COMPANY' as MessageType, async (message) => {
      const result = await supabaseClient.getJobsByCompany(message.payload);
      return result;
    });

    // Get jobs by source from Supabase
    messageRouter.on('SUPABASE_GET_JOBS_BY_SOURCE' as MessageType, async (message) => {
      const result = await supabaseClient.getJobsBySource(message.payload);
      return result;
    });

    // Get job count from Supabase
    messageRouter.on('SUPABASE_GET_JOB_COUNT' as MessageType, async () => {
      const result = await supabaseClient.getJobCount();
      return result;
    });

    // Delete jobs from Supabase
    messageRouter.on('SUPABASE_DELETE_JOBS' as MessageType, async (message) => {
      const result = await supabaseClient.deleteJobs(message.payload);
      return result;
    });

    // Sync current local jobs to Supabase
    messageRouter.on('SUPABASE_SYNC_ALL' as MessageType, async () => {
      const jobs = await storage.getJobs();
      const result = await supabaseClient.upsertJobs(jobs);
      return result;
    });

    // Supabase health check
    messageRouter.on('SUPABASE_HEALTH_CHECK' as MessageType, async () => {
      const isHealthy = await supabaseClient.healthCheck();
      return { healthy: isHealthy };
    });

    messageRouter.on('SUPABASE_ENQUEUE_TASKS' as MessageType, async (message) => {
      const { titles, assigned_to, location, client_id, target_site, date_filter } = message.payload;
      return await supabaseClient.enqueueTasks(titles, assigned_to, location, client_id, target_site, date_filter);
    });

    messageRouter.on('SUPABASE_GET_QUEUE' as MessageType, async () => {
      return await supabaseClient.getQueueStatus();
    });

    messageRouter.on('SUPABASE_UPDATE_QUEUE_TASK' as MessageType, async (message) => {
      const { id, updates } = message.payload;
      return await supabaseClient.updateQueueTask(id, updates);
    });

    messageRouter.on('SUPABASE_DELETE_QUEUE_TASK' as any, async (message: any) => {
      // Handle cases where payload might be missing or structured differently
      const taskId = message.id || (message.payload && message.payload.id);
      return await supabaseClient.deleteQueueTask(taskId);
    });

    messageRouter.on('SUPABASE_UPDATE_QUEUE_LOCATION' as any, async (message) => {
      const { location } = message.payload;
      return await supabaseClient.updateQueueLocation(location);
    });

    messageRouter.on('SUPABASE_GET_AGENTS' as MessageType, async () => {
      return await supabaseClient.getActiveAgents();
    });

    // Manually reset all completed queue tasks back to pending
    messageRouter.on('SUPABASE_RESET_QUEUE' as any, async () => {
      const result = await supabaseClient.resetCompletedTasks();
      // Also clear the daily-reset date stamp so auto-reset still fires correctly tomorrow
      await chrome.storage.local.remove('recruitscout_last_queue_reset');
      return result;
    });

    messageRouter.on('SUPABASE_GET_CLIENTS' as MessageType, async () => {
      return await supabaseClient.getClients();
    });

    messageRouter.on('SUPABASE_ENROLL_CLIENT' as MessageType, async (message) => {
      return await supabaseClient.enrollClient(message.payload);
    });

    messageRouter.on('SUPABASE_DELETE_CLIENT' as MessageType, async (message) => {
      return await supabaseClient.deleteClient(message.payload);
    });

    messageRouter.on('FORCE_POLL_QUEUE' as any, async () => {
      this.pollQueue();
      return { success: true };
    });

    // Google Sheets Sync
    messageRouter.on('SHEETS_SYNC' as MessageType, async (message) => {
      let jobsToSync = message.payload?.jobs;
      if (!jobsToSync) {
        jobsToSync = await storage.getJobs();
      }
      const settings = await storage.getSettings();
      if (!settings.googleSheetsConfig) return { data: null, error: 'Google Sheets not configured' };
      const result = await googleSheetsClient.syncJobs(jobsToSync, settings.googleSheetsConfig);
      return result;
    });
  }

  private setupEventListeners(): void {
    // Installation event
    chrome.runtime.onInstalled.addListener(async (details) => {
      if (details.reason === 'install') {
        this.isInstalled = true;
        console.log('[RecruitScout] Extension installed');
        await this.setupOffscreenDocument();
      } else if (details.reason === 'update') {
        console.log('[RecruitScout] Extension updated');
      }
    });

    // Tab activation event
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      // Only adopt the tab as the scraper tab if it is actually a job board page.
      // This prevents the engine from hijacking unrelated tabs (e.g. Gmail, Docs).
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        const url = tab.url || tab.pendingUrl || '';
        if (url.includes('indeed') || url.includes('trovolavoro')) {
          this.currentTabId = activeInfo.tabId;
        }
      } catch { /* tab may have been closed */ }
      await this.detectPageType(activeInfo.tabId);
    });

    // Tab update event
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        await this.detectPageType(tabId);
      }
    });

    // Fire heartbeat immediately when settings change 
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.recruitscout_settings) {
        this.pingHeartbeat();
      }
    });

    // Queue Polling Alarm
    chrome.alarms.create('queue_polling', { periodInMinutes: 0.5 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'queue_polling') {
        this.pollQueue();
        this.pingHeartbeat();
      }
    });
  }

  private async getActiveWorkerId(): Promise<string> {
    const settings = await storage.getSettings();
    if (settings.friendName?.trim()) return settings.friendName.trim();

    if (!settings.instanceId) {
      const newId = 'agent_' + Math.random().toString(36).substring(2, 9);
      await storage.setSettings({ instanceId: newId });
      return newId;
    }
    return settings.instanceId;
  }

  private async pingHeartbeat() {
    const settings = await storage.getSettings();
    if (settings.pollingEnabled) {
      const workerId = await this.getActiveWorkerId();
      await supabaseClient.pingAgent(workerId, settings.friendName || workerId);
    }
  }

  /**
   * Check if it's a new calendar day since the last queue reset.
   * If so, reset all completed BulkQueue tasks back to pending and record today's date.
   * Returns true if a reset was performed (caller should retry polling).
   */
  private async checkAndResetDailyQueue(): Promise<boolean> {
    const todayDate = new Date().toISOString().split('T')[0]; // e.g. "2026-04-23"

    const stored = await chrome.storage.local.get('recruitscout_last_queue_reset');
    const lastReset = stored['recruitscout_last_queue_reset'] as string | undefined;

    if (lastReset === todayDate) {
      // Already reset today — nothing to do
      return false;
    }

    console.log(`[RecruitScout] 📅 New day detected (${todayDate}) — resetting completed queue tasks to pending...`);

    const result = await supabaseClient.resetCompletedTasks();
    if (result.error) {
      console.error('[RecruitScout] Daily queue reset failed:', result.error);
      return false;
    }

    // Record today so we don't reset again until tomorrow
    await chrome.storage.local.set({ 'recruitscout_last_queue_reset': todayDate });
    console.log('[RecruitScout] ✅ Daily queue reset complete — tasks are pending again.');
    return true;
  }

  private async pollQueue(): Promise<void> {
    if (this.isPollingQueue) return;
    this.isPollingQueue = true;
    try {
      const state = stateManager.getState();
      if (state.status === 'running') return; // Busy

      const settings = await storage.getSettings();
      if (!settings.pollingEnabled) return; // Not enabled

      const workerId = await this.getActiveWorkerId();
      if (!workerId) return; // Cannot fetch if unidentified

      let hasMoreTasks = true;
      while (hasMoreTasks) {
        // Check both the class-level abort flag AND the storage setting
        if (this.abortRequested) {
          console.log('[RecruitScout] 🛑 Abort requested — stopping poll loop immediately.');
          break;
        }

        const currentSettings = await storage.getSettings();
        if (!currentSettings.pollingEnabled) {
          console.log('[RecruitScout] Polling disabled by user. Stopping queue watcher.');
          break;
        }

        try {
          const response = await supabaseClient.fetchNextTaskAndLock(workerId);

          if (this.abortRequested) break; // Check again after the network call

          if (response?.data) {
            const queueTask = response.data;
            const taskLabel = queueTask.job_title?.trim() || `[All Jobs${queueTask.location ? ' in ' + queueTask.location : ''}]`;
            console.log(`[RecruitScout] Pulled remote queue task: ${taskLabel}`);

            // Fetch client name if client_id is set
            let clientName: string | null = null;
            if (queueTask.client_id) {
              try {
                const clientsRes = await supabaseClient.getClients();
                if (clientsRes.data) {
                  const match = clientsRes.data.find(c => c.id === queueTask.client_id);
                  if (match) {
                    clientName = match.name;
                  }
                }
              } catch (err) {
                console.error('[RecruitScout] Failed to fetch client name:', err);
              }
            }

            let tabId = this.currentTabId;
            if (!tabId) {
              let startUrl = 'https://it.indeed.com';
              if (queueTask.target_site === 'trovolavoro') startUrl = 'https://offerte-di-lavoro.trovolavoro.com';
              else if (queueTask.target_site === 'spanish-indeed') startUrl = 'https://es.indeed.com';
              const newTab = await chrome.tabs.create({ url: startUrl, active: false });
              tabId = newTab.id;
              this.currentTabId = tabId;
            }

            try {
              activeClientNameForScraping = clientName;
              await this.startBulkExtraction({ titles: [queueTask.job_title || ''], options: { location: queueTask.location, target_site: queueTask.target_site, date_filter: queueTask.date_filter }, tabId }, undefined);

              const wasAborted = this.abortRequested || !(await storage.getSettings()).pollingEnabled;
              await supabaseClient.markTaskComplete(queueTask.id, wasAborted);
            } catch (jobError) {
              console.error('[RecruitScout] Remote Job Failed:', jobError);
              await supabaseClient.markTaskComplete(queueTask.id, true);
            } finally {
              activeClientNameForScraping = null;
            }

            if (this.abortRequested) break;

            // Small cooldown boundary to prevent bot blocking between queue iterations
            await new Promise(r => setTimeout(r, 2000));
          } else {
            // Queue is empty — check if it's a new day and reset completed tasks
            const wasReset = await this.checkAndResetDailyQueue();
            if (wasReset) {
              // Tasks were just flipped to pending — loop continues to pick them up
              console.log('[RecruitScout] 🔄 Continuing poll after daily reset...');
            } else {
              // Truly nothing to do today
              hasMoreTasks = false;
            }
          }
        } catch (e) {
          console.error('[RecruitScout] Polling error:', e);
          hasMoreTasks = false;
        }
      }
    } finally {
      this.isPollingQueue = false;
    }
  }

  private async setupOffscreenDocument(): Promise<void> {
    // @ts-ignore - Chrome offscreen API types may not be complete
    const existingContexts = await chrome.runtime.getContexts({
      // @ts-ignore
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('src/offscreen/index.html')],
    });

    // @ts-ignore
    if (existingContexts.length === 0) {
      // @ts-ignore
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('src/offscreen/index.html'),
        // @ts-ignore
        reasons: ['DOM_SCRAPING', 'WORKERS'],
        justification: 'Process large datasets and perform DOM scraping operations',
      });
    }
  }

  private async detectPageType(tabId: number): Promise<void> {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || !tab.url.startsWith('http')) return;

      const result = await messageRouter.sendToContent(tabId, {
        type: MessageType.DETECT_PAGE,
        payload: { url: tab.url },
      });

      if (result) {
        // Update state with page info
        console.log('[RecruitScout] Page detected:', result);
      }
    } catch (error) {
      // Content script might not be loaded yet (not a job board URL)
      // This is expected, so don't log as error
    }
  }

  private async waitForTabLoad(tabId: number, timeoutMs = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }, timeoutMs);

      const listener = (tid: number, info: chrome.tabs.TabChangeInfo) => {
        if (tid === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          // Give content scripts a moment to initialize
          setTimeout(resolve, 2000);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  private async getOrCreateScraperTab(suggestedTabId?: number, targetSite?: string): Promise<number> {
    const candidates = [suggestedTabId, this.currentTabId].filter(id => id !== undefined) as number[];
    for (const id of candidates) {
      try {
        const tab = await chrome.tabs.get(id);
        const url = tab.url || tab.pendingUrl || '';
        // Only reuse the tab if it is actually on a supported job board.
        // The previous `id === this.currentTabId` condition was a tautology that
        // caused any user-focused tab (e.g. Gmail) to be accepted as a scraper tab.
        if (url.includes('indeed') || url.includes('trovolavoro')) {
          this.currentTabId = id;
          return id;
        }
      } catch (e) {
        // Tab no longer exists
      }
    }
    // Create silent background tab instead of hijacking
    let startUrl = 'https://it.indeed.com';
    if (targetSite === 'trovolavoro') startUrl = 'https://offerte-di-lavoro.trovolavoro.com';
    else if (targetSite === 'spanish-indeed') startUrl = 'https://es.indeed.com';
    
    const newTab = await chrome.tabs.create({ url: startUrl, active: false });
    if (!newTab.id) throw new Error('Failed to spawn background scraper tab');
    this.currentTabId = newTab.id;
    return newTab.id;
  }

  private async startExtraction(payload: any, sender: chrome.runtime.MessageSender): Promise<any> {
    this.abortRequested = false;
    await stateManager.setState({ status: 'running' });
    const { mode, url, options, tabId: payloadTabId } = payload;
    const tabId = await this.getOrCreateScraperTab(payloadTabId, options?.target_site);

    try {
      return await this.performExtraction(tabId, url, mode, options);
    } catch (error: any) {
      await stateManager.setState({ status: 'error' });
      if (error && error.message && error.message.includes('Receiving end does not exist')) {
        throw new Error('Please refresh the job board page.');
      }
      throw error;
    }
  }

  private async startBulkExtraction(payload: any, sender?: chrome.runtime.MessageSender): Promise<any> {
    this.abortRequested = false;
    await stateManager.setState({ status: 'running' });
    const { titles, options, tabId: payloadTabId } = payload;
    const tabId = await this.getOrCreateScraperTab(payloadTabId, options?.target_site);

    const settings = await storage.getSettings();
    const delay = settings.crawlDelay || 2000;

    // Detect Indeed domain from current tab
    const tab = await chrome.tabs.get(tabId);
    let baseUrl = 'https://it.indeed.com';
    if (options?.target_site === 'spanish-indeed') {
      baseUrl = 'https://es.indeed.com';
    } else if (tab.url) {
      const urlObj = new URL(tab.url);
      if (urlObj.hostname.includes('indeed')) {
        baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
      }
    }

    try {
      for (let i = 0; i < titles.length; i++) {
        const title = (titles[i] || '').trim();
        const locationParam = options?.location ? `&l=${encodeURIComponent(options.location)}` : '';
        // Handle date filtering: 'last' for Ads not displayed / unsponsored, or '1', '3', '7', '14'
        let dateParam = '';
        if (options?.date_filter === 'last') {
          dateParam = '&fromage=last';
        } else if (options?.date_filter) {
          dateParam = `&fromage=${encodeURIComponent(options.date_filter)}`;
        }

        let searchUrl = '';
        const isTrovolavoro = options?.target_site === 'trovolavoro' || baseUrl.includes('trovolavoro');

        if (isTrovolavoro) {
          searchUrl = `https://www.trovolavoro.com/`;
        } else {
          searchUrl = title
            ? `${baseUrl}/jobs?q=${encodeURIComponent(title)}${locationParam}${dateParam}`
            : `${baseUrl}/jobs?l=${encodeURIComponent(options?.location || '')}${dateParam}`;
        }

        const label = title || `[All Jobs${options?.location ? ' in ' + options.location : ''}]`;
        console.log(`[RecruitScout] Bulk Search ${i + 1}/${titles.length}: ${label}`);

        // Update tab and wait for load
        await chrome.tabs.update(tabId, { url: searchUrl });
        await this.waitForTabLoad(tabId);

        // UI Automation for Trovolavoro
        if (isTrovolavoro) {
          console.log(`[RecruitScout] Injecting Trovolavoro UI automation...`);
          await chrome.scripting.executeScript({
            target: { tabId },
            func: (query, location) => {
              const keywordInput = document.querySelector('input[name="cand_search-keyword"]') as HTMLInputElement;
              const cityInput = document.querySelector('input[name="cand_search-job_city"]') as HTMLInputElement;
              const submitButton = document.querySelector('button[type="submit"], #submit') as HTMLButtonElement;

              if (keywordInput && submitButton) {
                keywordInput.value = query;
                keywordInput.dispatchEvent(new Event('input', { bubbles: true }));
                keywordInput.dispatchEvent(new Event('change', { bubbles: true }));
                if (cityInput) {
                  cityInput.value = location;
                  cityInput.dispatchEvent(new Event('input', { bubbles: true }));
                  cityInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                submitButton.click();
                return true;
              }
              return false;
            },
            args: [title, options?.location || '']
          });

          console.log(`[RecruitScout] Automation executed, waiting 4s for navigation...`);
          await new Promise(r => setTimeout(r, 4000)); // wait for form submission and redirect

          // Trovolavoro uses SPA/hash navigation after form submit, which may not
          // trigger chrome.tabs.onUpdated with status:'complete'. Instead of calling
          // waitForTabLoad (which times out), poll until the URL changes or stabilises.
          const preSubmitUrl = searchUrl;
          let urlSettled = false;
          for (let attempt = 0; attempt < 30; attempt++) { // 30 × 500ms = 15s max
            await new Promise(r => setTimeout(r, 500));
            try {
              const polledTab = await chrome.tabs.get(tabId);
              if (polledTab.url && polledTab.url !== preSubmitUrl) {
                // URL has changed — give the page an extra moment to render
                await new Promise(r => setTimeout(r, 2000));
                urlSettled = true;
                break;
              }
              // Also accept if tab has finished loading (full-page nav)
              if (polledTab.status === 'complete' && attempt > 4) {
                await new Promise(r => setTimeout(r, 2000));
                urlSettled = true;
                break;
              }
            } catch { break; } // tab closed
          }
          if (!urlSettled) {
            console.warn(`[RecruitScout] Trovolavoro navigation may not have completed — proceeding anyway.`);
            await new Promise(r => setTimeout(r, 2000));
          }

          // Get the new hash-based URL generated by Trovolavoro
          const updatedTab = await chrome.tabs.get(tabId);
          if (updatedTab.url) {
            searchUrl = updatedTab.url;
            console.log(`[RecruitScout] Captured final search results URL: ${searchUrl}`);
          }
        }

        // Perform extraction for this title starting on the final search results URL
        await this.performExtraction(tabId, searchUrl, 'bulk-search', options, i, titles.length);

        // Delay between searches to avoid detection
        if (i < titles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Check if stopped
        const state = await stateManager.getState();
        if (state.status !== 'running') break;
      }

      await stateManager.setState({ status: 'idle' });
      return { success: true };
    } catch (error: any) {
      await stateManager.setState({ status: 'error' });
      throw error;
    }
  }

  private async performExtraction(
    tabId: number,
    url: string,
    mode: string,
    options: any,
    currentIndex: number = 0,
    totalTitles: number = 1
  ): Promise<any> {
    // Initialize state
    const existingJobs = await storage.getJobs();
    const settings = await storage.getSettings();
    const crawlDelay = settings.crawlDelay || 3000;
    await stateManager.setState({
      status: 'running',
      mode: mode as any,
      currentTab: url,
      totalJobs: existingJobs.length,
      extractedJobs: existingJobs.length,
      errors: 0,
      startTime: new Date().toISOString(),
    });

    let urlToScrape: string | undefined = url;
    let pageCount = 0;
    let currentTotal = existingJobs.length;

    let lastSuccessfulUrl: string = url;
    let lastSuccessfulPageCount = 0;
    let consecutiveRetries = 0;
    let nativeClickPending = false;

    while (urlToScrape && pageCount < (options.paginationLimit || 50)) {
      // ── IMMEDIATE ABORT CHECK ──────────────────────────────────────────────
      if (this.abortRequested) {
        console.log('[RecruitScout] 🛑 Abort flag detected in performExtraction — halting.');
        break;
      }
      pageCount++;

      if (pageCount > 1) {
        if (!nativeClickPending && urlToScrape) {
          console.log(`[RecruitScout] Navigating to page ${pageCount}: ${urlToScrape}`);
          await chrome.tabs.update(tabId, { url: urlToScrape });
        } else {
          console.log(`[RecruitScout] Waiting for native click navigation to settle on page ${pageCount} (Target: ${urlToScrape})...`);
        }
        nativeClickPending = false; // Reset the flag
        if (this.abortRequested) break; // Check after every await
        await this.waitForTabLoad(tabId);
        // Add a small buffer for SPAs to finish rendering the DOM after navigation
        await new Promise(r => setTimeout(r, 2000));
        if (this.abortRequested) break; // Check after every await
      }

      const state = await stateManager.getState();
      if (state.status !== 'running' || this.abortRequested) break;

      let result: any = null;
      let extractionFailed = false;

      try {
        result = await messageRouter.sendToContent(tabId, {
          type: MessageType.EXTRACT_JOBS,
          payload: { mode, options },
        });

        if (!result) {
          extractionFailed = true;
        }
      } catch (err: any) {
        console.warn(`[RecruitScout] ⚠️ Content extraction failed on page ${pageCount}:`, err);
        extractionFailed = true;
      }

      if (this.abortRequested) break; // Check after every await

      if (extractionFailed) {
        consecutiveRetries++;
        if (consecutiveRetries > 3) {
          console.error(`[RecruitScout] ❌ Exceeded maximum consecutive recovery retries (3) on page ${pageCount}. Halting.`);
          throw new Error('Scraper halted due to persistent page blocks/connection issues after 3 tab recovery attempts.');
        }

        let recoveryUrl = urlToScrape || lastSuccessfulUrl;

        // MATHEMATICALLY ENFORCE RECOVERY URL TO AVOID PAGE 1 FALLBACK
        if (url.includes('indeed.')) {
          try {
            const u = new URL(url); // the original base search URL!
            const startOffset = (pageCount - 1) * 10; // recovering the exact current pageCount
            if (startOffset > 0) {
              u.searchParams.set('start', startOffset.toString());
            } else {
              u.searchParams.delete('start');
            }
            recoveryUrl = u.toString();
          } catch (e) { /* ignore */ }
        }

        console.log(`[RecruitScout] 🔄 Recovery [Attempt ${consecutiveRetries}/3]: Block/Cloudflare detected on page ${pageCount}. Recreating tab to bypass...`);
        console.log(`[RecruitScout] 🔄 Recovery: Closing blocked tab ID ${tabId}...`);
        try {
          await chrome.tabs.remove(tabId);
        } catch { /* ignore */ }

        console.log(`[RecruitScout] 🔄 Recovery: Creating a clean new tab at URL: ${recoveryUrl}`);
        const newTab = await chrome.tabs.create({ url: recoveryUrl, active: false });
        if (!newTab.id) {
          throw new Error('Failed to recreate background tab during auto-bypass.');
        }

        tabId = newTab.id;
        this.currentTabId = tabId; // Sync engine active tab reference

        console.log(`[RecruitScout] 🔄 Recovery: Waiting for fresh tab ID ${tabId} to load...`);
        await this.waitForTabLoad(tabId);
        await new Promise(r => setTimeout(r, 4000)); // buffer for fresh loading/settling

        // Reset pageCount to try scraping this page again!
        pageCount = lastSuccessfulPageCount;
        urlToScrape = recoveryUrl;

        // Prevent double navigation in the next loop iteration!
        nativeClickPending = true;

        console.log(`[RecruitScout] 🔄 Recovery: Fresh tab loaded successfully. Retrying page ${pageCount + 1}...`);
        continue; // Go back to top of loop to scrape the page again!
      }

      consecutiveRetries = 0; // reset on success

      let pageNewCount = 0;
      if (result && result.jobs && result.jobs.length > 0) {
        const saveResult = await enrichAndSave(result.jobs);
        pageNewCount = saveResult.newCount;
      }

      if (this.abortRequested) break; // Check after every await

      const latestDbJobs = await storage.getJobs();
      currentTotal = latestDbJobs.length;

      await stateManager.setState({
        extractedJobs: currentTotal,
        totalJobs: currentTotal,
        currentPhase: mode === 'bulk-search' ? `Search ${currentIndex + 1}/${totalTitles}` as any : undefined,
      });

      // Update last successful checkpoint parameters!
      lastSuccessfulUrl = urlToScrape || url;
      lastSuccessfulPageCount = pageCount;

      // ── Pagination Check ─────────────────────────────────────────────────
      if ((mode === 'pagination' || mode === 'bulk-search') && result?.nextPageUrl && !this.abortRequested) {
        // Add a human-like randomised delay between pages to avoid Cloudflare detection.
        const jitter = crawlDelay * 0.3;
        const pageDelay = Math.round(crawlDelay + (Math.random() * jitter * 2 - jitter));
        console.log(`[RecruitScout] ⏳ Waiting ${pageDelay}ms before page ${pageCount + 1}...`);
        await new Promise(r => setTimeout(r, pageDelay));
        if (this.abortRequested) break;

        console.log(`[RecruitScout] Proceeding to next page via native click...`);
        try {
          const clickResult = await messageRouter.sendToContent(tabId, { type: MessageType.CLICK_NEXT_PAGE });

          // Mathematically calculate the next page URL to bypass Indeed's obfuscated hrefs
          let nextMathematicalUrl = result.nextPageUrl;
          if (url.includes('indeed.')) {
            try {
              const u = new URL(url);
              const nextOffset = pageCount * 10;
              u.searchParams.set('start', nextOffset.toString());
              nextMathematicalUrl = u.toString();
            } catch (e) { /* ignore */ }
          }

          if (clickResult && clickResult.success) {
            nativeClickPending = true;
            urlToScrape = nextMathematicalUrl;
          } else {
            console.log(`[RecruitScout] Native click failed, falling back to URL navigation: ${nextMathematicalUrl}`);
            urlToScrape = nextMathematicalUrl;
          }
        } catch (e) {
          console.error(`[RecruitScout] Click command failed, falling back to URL navigation`, e);
          let nextMathematicalUrl = result.nextPageUrl;
          if (url.includes('indeed.')) {
            try {
              const u = new URL(url);
              const nextOffset = pageCount * 10;
              u.searchParams.set('start', nextOffset.toString());
              nextMathematicalUrl = u.toString();
            } catch (e) { /* ignore */ }
          }
          urlToScrape = nextMathematicalUrl;
        }
      } else {
        urlToScrape = undefined;
      }
    }

    return { success: true, count: currentTotal };
  }

  private async stopExtraction(): Promise<any> {
    // Set the abort flag IMMEDIATELY — synchronous, no await needed
    // This is checked at every checkpoint in pollQueue and performExtraction
    this.abortRequested = true;

    if (this.extractionInterval) {
      clearInterval(this.extractionInterval);
      this.extractionInterval = null;
    }

    await stateManager.setState({
      status: 'idle',
      progress: stateManager.getProgress(),
    });

    // Close the silent background scraper tab if it exists
    if (this.currentTabId) {
      try {
        await chrome.tabs.remove(this.currentTabId);
      } catch { /* tab may already be closed */ }
      this.currentTabId = null;
    }

    console.log('[RecruitScout] 🛑 Abort flag set — engine stopped.');
    return { success: true };
  }

  private async pauseExtraction(): Promise<any> {
    await stateManager.setState({ status: 'paused' });

    if (this.currentTabId) {
      try {
        await messageRouter.sendToContent(this.currentTabId, {
          type: MessageType.PAUSE_EXTRACTION,
        });
      } catch (error) {
        console.error('[RecruitScout] Error pausing extraction:', error);
      }
    }

    return { success: true };
  }

  private async exportJobs(payload: any): Promise<any> {
    const { format, fields, includeMetadata } = payload;
    const jobs = await storage.getJobs();

    // Send to offscreen document for export processing
    try {
      const offscreenId = await this.getOffscreenTabId();
      if (offscreenId) {
        return await chrome.tabs.sendMessage(offscreenId, {
          type: 'EXPORT_DATA',
          payload: { jobs, format, fields, includeMetadata },
        });
      }
    } catch (error) {
      console.error('[RecruitScout] Error exporting jobs:', error);
      throw error;
    }

    throw new Error('Offscreen document not available');
  }

  private async getOffscreenTabId(): Promise<number | null> {
    try {
      // @ts-ignore - Chrome offscreen API types
      const contexts = await chrome.runtime.getContexts({
        // @ts-ignore
        contextTypes: ['OFFSCREEN_DOCUMENT'],
      });

      // @ts-ignore
      if (contexts && contexts.length > 0) {
        // For offscreen documents, we need to use a different approach
        // as they don't have traditional tab IDs
        return null;
      }

      return null;
    } catch {
      return null;
    }
  }
}

// Initialize service worker
const serviceWorker = new ServiceWorker();

// Export for testing
export { serviceWorker };
