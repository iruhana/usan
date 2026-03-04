/**
 * Embeddings — generate text embeddings via OpenRouter API.
 * Falls back to simple TF-IDF-like vector if API unavailable.
 */
import { loadSettings } from '../store'

const EMBEDDING_DIM = 384  // Fixed dimension for all embeddings (API + local)

export async function generateEmbedding(text: string): Promise<number[]> {
  const settings = loadSettings()
  const apiKey = settings.cloudApiKey

  if (apiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: text.slice(0, 8000),
          dimensions: EMBEDDING_DIM,  // Request fixed dimension to match local fallback
        }),
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok) {
        const data = await res.json() as { data: Array<{ embedding: number[] }> }
        const emb = data.data?.[0]?.embedding
        if (emb && emb.length === EMBEDDING_DIM) {
          return emb
        }
        // Dimension mismatch — fall through to local to keep consistency
      }
    } catch { /* fall through to local */ }
  }

  // Local fallback: simple hash-based embedding
  return localEmbedding(text)
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  if (texts.length === 1) return [await generateEmbedding(texts[0])]

  const settings = loadSettings()
  const apiKey = settings.cloudApiKey

  if (apiKey) {
    // Batch in groups of 50
    const BATCH_SIZE = 50
    const allResults: number[][] = []
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.slice(0, 8000))
      try {
        const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/text-embedding-3-small',
            input: batch,
            dimensions: EMBEDDING_DIM,
          }),
          signal: AbortSignal.timeout(60000),
        })
        if (res.ok) {
          const data = await res.json() as { data: Array<{ embedding: number[]; index: number }> }
          const sorted = (data.data || []).sort((a, b) => a.index - b.index)
          if (sorted.length === batch.length && sorted.every((d) => d.embedding?.length === EMBEDDING_DIM)) {
            allResults.push(...sorted.map((d) => d.embedding))
            continue
          }
        }
      } catch { /* fall through to per-item local */ }
      // Fallback: generate individually for this batch
      for (const text of batch) {
        allResults.push(localEmbedding(text))
      }
    }
    return allResults
  }

  // No API key — all local
  return texts.map((t) => localEmbedding(t))
}

function localEmbedding(text: string): number[] {
  // Simple deterministic embedding based on character n-gram hashing
  const vec = new Float32Array(EMBEDDING_DIM).fill(0)
  const words = text.toLowerCase().split(/\s+/)
  for (const word of words) {
    for (let i = 0; i < word.length - 1; i++) {
      const bigram = word.slice(i, i + 2)
      const hash = simpleHash(bigram) % EMBEDDING_DIM
      vec[hash] += 1
    }
  }
  // Normalize
  let norm = 0
  for (let i = 0; i < EMBEDDING_DIM; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) || 1
  const result: number[] = new Array(EMBEDDING_DIM)
  for (let i = 0; i < EMBEDDING_DIM; i++) result[i] = vec[i] / norm
  return result
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1)
}
