import { describe, expect, it } from 'vitest'
import {
  combineHybridScore,
  computeKeywordScore,
  normalizeVectorScore,
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
})
