const STOP_WORDS = new Set(['the', 'and', 'for', 'group', 'services', 'company', 'inc', 'llc', 'corp', 'ltd', 'spa', 'srl']);

function validateDomainSync(domain, companyName) {
  let domainCore = domain
    .replace(/\.(com|it|net|org|io|co|uk|eu|us|de|fr|es|pt|br|mx|ar|cl|pe|co\.uk|com\.au)$/i, '')
    .toLowerCase();

  const companyWords = companyName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));

  let foundMatch = false;
  for (const word of companyWords) {
    if (domainCore === word) { foundMatch = true; break; }
    if (word.length >= 4 && domainCore.includes(word)) { foundMatch = true; break; }
  }

  if (!foundMatch && companyWords.length === 1) {
    foundMatch = domainCore === companyWords[0];
  }

  return { domainCore, companyWords, foundMatch };
}
console.log(validateDomainSync('gigroup.com', 'Gi Group'));
