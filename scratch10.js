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

console.log('Hosco, LLC:', normalizeCompanyName("Hosco, LLC"));
console.log('Hosco LLC:', normalizeCompanyName("Hosco LLC"));
