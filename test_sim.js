const STOP_WORDS = new Set(['the', 'and', 'for', 'group', 'services', 'company', 'inc', 'llc', 'corp', 'ltd', 'spa', 'srl']);

function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const common = [...wordsA].filter(w => wordsB.has(w)).length;
  return common / Math.max(wordsA.size, wordsB.size);
}
console.log("Adecco Italia S.p.A. vs Adecco:", nameSimilarity("Adecco Italia S.p.A.", "Adecco"));
console.log("Gi Group vs Gi Group Holding:", nameSimilarity("Gi Group", "Gi Group Holding"));
console.log("Bending Spoons vs Bending Spoons:", nameSimilarity("Bending Spoons", "Bending Spoons"));
