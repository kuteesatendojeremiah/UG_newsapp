const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "as", "at",
  "by", "from", "is", "are", "was", "were", "be", "been", "being", "this", "that", "it",
  "its", "after", "over", "into", "about", "than", "then", "will", "has", "have", "had",
]);

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
  return new Set(words);
}

// Jaccard similarity over significant words (title + summary) — cheap, deterministic, and
// consistent with categorize.ts's keyword-matching approach rather than pulling in an
// embeddings/AI dependency for MVP clustering.
export function textSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}
