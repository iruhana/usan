export function tokenizeSearchText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u3131-\u318e\uac00-\ud7a3]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
}

export function computeKeywordScore(queryTokens: string[], content: string): number {
  if (queryTokens.length === 0) return 0
  const contentTokens = new Set(tokenizeSearchText(content))
  if (contentTokens.size === 0) return 0
  let hits = 0
  for (const token of queryTokens) {
    if (contentTokens.has(token)) hits++
  }
  return hits / queryTokens.length
}

export function normalizeVectorScore(vectorScore: number): number {
  const normalized = (vectorScore + 1) / 2
  return Math.max(0, Math.min(1, normalized))
}

export function combineHybridScore(vectorScore: number, keywordScore: number): number {
  const safeVector = Math.max(0, Math.min(1, vectorScore))
  const safeKeyword = Math.max(0, Math.min(1, keywordScore))
  return safeVector * 0.7 + safeKeyword * 0.3
}

export function toConfidenceLabel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.75) return 'high'
  if (score >= 0.45) return 'medium'
  return 'low'
}
