const STOP_WORDS = new Set(['the', 'and', 'for', 'group', 'services', 'company', 'inc', 'llc', 'corp', 'ltd', 'spa', 'srl']);

function parseDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

function extractDomainFromUrl(url) {
  const hostname = parseDomain(url);
  return hostname.replace(/^www\./, '');
}

function normalizeCompanyName(companyName) {
  if (!companyName) return '';
  const legalSuffixes = [
    /\bS\.p\.A\.$/, /\bS\.r\.l\.$/, /\bS\.c\.a\.$/, /\bS\.c\.p\.A\.$/,
    /\bS\.p\.A$/, /\bS\.r\.l$/, /\bS\.c\.a$/, /\bS\.c\.p\.A$/,
    /\bSpA$/, /\bSrl$/, /\bSPA$/, /\bSRL$/, /\bsrl$/,
    /\bS\.A\.$/, /\bS\.A$/, /\bSA$/,
    /\bL\.L\.C\.$/, /\bCo\.$/, /\bLtd\.$/, /\bCorp\.$/, /\bInc\.$/,
    /\bCo$/, /\bLtd$/, /\bCorp$/, /\bInc$/,
    /\bPLC$/, /\bAG$/, /\bGmbH$/, /\bLLC$/,
    /\bltd$/, /\bco$/, /\binc$/, /\bgmbh$/, /\bllc$/,
    /\blimited$/i, /\bincorporated$/i, /\bcorporation$/i, /\bcompany$/i,
    /\bSAS$/, /\bSARL$/, /\bBV$/, /\bNV$/, /\bAB$/, /\bAS$/,
    /\bOy$/, /\bPty$/, /\bLtda$/, /\bZAO$/, /\bOOO$/,
    /\b(?:corporación|sociedad)$/i,
  ];
  let normalized = companyName.trim();
  for (const pattern of legalSuffixes) {
    if (pattern.test(normalized)) {
      normalized = normalized.replace(pattern, '').trim();
      break;
    }
  }
  return normalized;
}

function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const common = [...wordsA].filter(w => wordsB.has(w)).length;
  return common / Math.max(wordsA.size, wordsB.size);
}

async function validateDomain(domain, companyName) {
  if (!domain || !companyName) return false;

  let domainCore = domain
    .replace(/\.(com|it|net|org|io|co|uk|eu|us|de|fr|es|pt|br|mx|ar|cl|pe|co\.uk|com\.au)$/i, '')
    .toLowerCase();

  const companyWords = companyName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') 
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word)); 

  let foundMatch = false;
  for (const word of companyWords) {
    if (domainCore === word) {
      foundMatch = true;
      break;
    }
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

  return foundMatch;
}

async function fetchDomainFromClearbit(companyName) {
  try {
    const searchName = normalizeCompanyName(companyName);
    const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(searchName)}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0 && data[0].domain) {
        return { domain: data[0].domain, matchedName: data[0].name || '' };
      }
    }
  } catch {}
  return { domain: '', matchedName: '' };
}

async function fetchDomainFromWikidata(companyName) {
  try {
    const searchName = normalizeCompanyName(companyName);
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchName)}&language=it&type=item&format=json&origin=*&limit=3`;
    const searchRes = await fetch(searchUrl, { headers: { 'Accept': 'application/json' } });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const results = searchData?.search || [];
      if (results.length > 0) {
        const entityId = results[0].id;
        const claimsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=claims&format=json&origin=*`;
        const claimsRes = await fetch(claimsUrl, { headers: { 'Accept': 'application/json' } });
        if (claimsRes.ok) {
          const claimsData = await claimsRes.json();
          const websiteClaims = claimsData?.entities?.[entityId]?.claims?.P856;
          if (websiteClaims && websiteClaims.length > 0) {
            const website = websiteClaims[0]?.mainsnak?.datavalue?.value;
            if (website) {
              return extractDomainFromUrl(website.startsWith('http') ? website : `https://${website}`);
            }
          }
        }
      }
    }
  } catch {}
  return '';
}

async function fetchDomainFromLinkedIn(companyName) {
  try {
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
      }
    });

    if (response.ok) {
      const html = await response.text();
      const jsonLdMatch = html.match(/"sameAs"\s*:\s*"([^"]+)"/);
      if (jsonLdMatch && !jsonLdMatch[1].includes('linkedin.com')) {
        return extractDomainFromUrl(jsonLdMatch[1]);
      }
    }
  } catch {}
  return '';
}

async function resolveCompanyDomain(companyName) {
  const [clearbitResult, wikidataDomain] = await Promise.all([
    fetchDomainFromClearbit(companyName),
    fetchDomainFromWikidata(companyName),
  ]);

  const { domain: clearbitDomain, matchedName } = clearbitResult;
  const similarity = nameSimilarity(companyName, matchedName);
  const clearbitConfident = !!clearbitDomain && similarity >= 0.45;

  let winner = '';

  if (clearbitConfident && wikidataDomain) {
    if (clearbitDomain === wikidataDomain) {
      winner = clearbitDomain;
      console.log(`✅ both agree -> ${winner}`);
    } else {
      winner = wikidataDomain;
      console.log(`⚖️ disagreement, trusting Wikidata -> ${winner}`);
    }
  } else if (wikidataDomain) {
    winner = wikidataDomain;
    console.log(`📖 Wikidata only -> ${winner}`);
  } else if (clearbitConfident) {
    winner = clearbitDomain;
    console.log(`🔵 Clearbit confident -> ${winner}`);
  } else if (clearbitDomain) {
    const valid = await validateDomain(clearbitDomain, companyName);
    winner = valid ? clearbitDomain : '';
    console.log(`⚠️ Clearbit sim=${similarity.toFixed(2)}, SAFETY CHECK -> ${valid ? 'accepted' : 'rejected'} (${clearbitDomain})`);
  } else {
    console.log(`❌ Clearbit & Wikidata failed`);
  }

  return winner;
}

async function testAll(companyName) {
  console.log(`\n\n=== TESTING: "${companyName}" ===`);
  
  // 1. Test LinkedIn
  const li = await fetchDomainFromLinkedIn(companyName);
  console.log(`[LinkedIn] Result: ${li || 'FAILED'}`);
  
  // 2. Test Clearbit + Wikidata
  console.log(`[Resolve] Run...`);
  const resolved = await resolveCompanyDomain(companyName);
  console.log(`[Resolve] Final: ${resolved || 'FAILED'}`);
}

async function runTests() {
  await testAll("Adecco Italia S.p.A.");
  await testAll("Gi Group");
  await testAll("Bending Spoons");
  await testAll("Randstad Italia");
  await testAll("Ferrari N.V.");
}

runTests();
