export interface RankedMatch {
  rowid: number
  rank: number
}

export interface HybridMergedMatch {
  rowid: number
  keywordRank?: number
  vectorRank?: number
  rrfScore: number
  sourceCount: number
}

const DEFAULT_RRF_K = 60

export function tokenizeSearchText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u3131-\u318e\uac00-\ud7a3]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
}

export function buildFtsQuery(text: string): string {
  const tokens = tokenizeSearchText(text)
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(' OR ')
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

export function reciprocalRank(rank: number, k = DEFAULT_RRF_K): number {
  if (!Number.isFinite(rank) || rank <= 0) return 0
  return 1 / (k + rank)
}

export function rankToScore(rank: number, total: number): number {
  if (!Number.isFinite(rank) || rank <= 0 || total <= 0) return 0
  const normalized = (total - rank + 1) / total
  return Math.max(0, Math.min(1, normalized))
}

export function normalizeRrfScore(rrfScore: number, sourceCount: number, k = DEFAULT_RRF_K): number {
  if (sourceCount <= 0) return 0
  const maxScore = sourceCount / (k + 1)
  if (maxScore <= 0) return 0
  return Math.max(0, Math.min(1, rrfScore / maxScore))
}

export function mergeHybridRanks(
  keywordMatches: RankedMatch[],
  vectorMatches: RankedMatch[],
  k = DEFAULT_RRF_K,
): HybridMergedMatch[] {
  const merged = new Map<number, HybridMergedMatch>()

  for (const match of keywordMatches) {
    const current = merged.get(match.rowid) ?? {
      rowid: match.rowid,
      rrfScore: 0,
      sourceCount: 0,
    }
    current.keywordRank = match.rank
    current.rrfScore += reciprocalRank(match.rank, k)
    current.sourceCount += 1
    merged.set(match.rowid, current)
  }

  for (const match of vectorMatches) {
    const current = merged.get(match.rowid) ?? {
      rowid: match.rowid,
      rrfScore: 0,
      sourceCount: 0,
    }
    current.vectorRank = match.rank
    current.rrfScore += reciprocalRank(match.rank, k)
    current.sourceCount += 1
    merged.set(match.rowid, current)
  }

  return Array.from(merged.values()).sort((a, b) => {
    if (b.rrfScore !== a.rrfScore) return b.rrfScore - a.rrfScore
    const aBestRank = Math.min(a.keywordRank ?? Number.POSITIVE_INFINITY, a.vectorRank ?? Number.POSITIVE_INFINITY)
    const bBestRank = Math.min(b.keywordRank ?? Number.POSITIVE_INFINITY, b.vectorRank ?? Number.POSITIVE_INFINITY)
    return aBestRank - bBestRank
  })
}

export function toConfidenceLabel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.75) return 'high'
  if (score >= 0.45) return 'medium'
  return 'low'
}
