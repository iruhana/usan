import { describe, expect, it } from 'vitest'
import {
  buildFtsQuery,
  combineHybridScore,
  computeKeywordScore,
  mergeHybridRanks,
  normalizeVectorScore,
  normalizeRrfScore,
  rankToScore,
  reciprocalRank,
  toConfidenceLabel,
  tokenizeSearchText,
} from '../../src/main/rag/hybrid-ranking'

describe('hybrid ranking', () => {
  it('tokenizes mixed language search text', () => {
    const tokens = tokenizeSearchText('Error in 화면 capture! 123')
    expect(tokens).toEqual(['error', 'in', '화면', 'capture', '123'])
  })

  it('computes keyword overlap score', () => {
    const score = computeKeywordScore(['screen', 'error', 'capture'], 'Capture screen to inspect error logs')
    expect(score).toBeCloseTo(1, 5)
  })

  it('builds a safe OR query for FTS5', () => {
    const query = buildFtsQuery('screen error capture')
    expect(query).toBe('"screen" OR "error" OR "capture"')
  })

  it('normalizes vector score range', () => {
    expect(normalizeVectorScore(-1)).toBe(0)
    expect(normalizeVectorScore(0)).toBe(0.5)
    expect(normalizeVectorScore(1)).toBe(1)
  })

  it('combines vector and keyword scores with weighted blend', () => {
    const score = combineHybridScore(0.8, 0.5)
    expect(score).toBeCloseTo(0.71, 5)
  })

  it('maps confidence labels from score', () => {
    expect(toConfidenceLabel(0.9)).toBe('high')
    expect(toConfidenceLabel(0.6)).toBe('medium')
    expect(toConfidenceLabel(0.2)).toBe('low')
  })

  it('computes reciprocal rank fusion for overlapping results', () => {
    const merged = mergeHybridRanks(
      [
        { rowid: 10, rank: 1 },
        { rowid: 20, rank: 2 },
      ],
      [
        { rowid: 20, rank: 1 },
        { rowid: 10, rank: 2 },
      ],
    )

    expect(merged[0]?.rowid).toBe(10)
    expect(merged[0]?.sourceCount).toBe(2)
    expect(merged[0]?.rrfScore).toBeCloseTo(reciprocalRank(1) + reciprocalRank(2), 8)
  })

  it('normalizes rank-based scores', () => {
    expect(rankToScore(1, 5)).toBe(1)
    expect(rankToScore(5, 5)).toBeCloseTo(0.2, 5)
    expect(normalizeRrfScore(reciprocalRank(1), 1)).toBe(1)
  })
})
