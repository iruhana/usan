/**
 * Text Chunker ??splits documents into overlapping chunks for embedding.
 */

const DEFAULT_CHUNK_SIZE = 500   // tokens (approx)
const DEFAULT_OVERLAP = 50      // tokens overlap

export interface TextChunk {
  text: string
  index: number
  startOffset: number
  endOffset: number
}

export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP,
): TextChunk[] {
  if (!text.trim()) return []

  // Split by paragraphs first, then recombine into chunks
  const paragraphs = text.split(/\n\n+/)
  const chunks: TextChunk[] = []
  let currentChunk = ''
  let currentStart = 0
  let offset = 0
  let index = 0

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length

    if (currentChunk && (currentChunk.split(/\s+/).length + paraWords > chunkSize)) {
      chunks.push({
        text: currentChunk.trim(),
        index,
        startOffset: currentStart,
        endOffset: offset,
      })
      index++

      // Overlap: keep last N words
      const words = currentChunk.split(/\s+/)
      const overlapWords = words.slice(-overlap)
      currentChunk = overlapWords.join(' ') + '\n\n' + para
      currentStart = offset - overlapWords.join(' ').length
    } else {
      if (currentChunk) currentChunk += '\n\n'
      currentChunk += para
    }
    offset += para.length + 2
  }

  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      index,
      startOffset: currentStart,
      endOffset: offset,
    })
  }

  return chunks
}

export async function extractTextFromFile(filePath: string): Promise<string> {
  const { readFile } = await import('fs/promises')
  const ext = filePath.split('.').pop()?.toLowerCase() || ''

  if (ext === 'hwpx') {
    const { hwpxToText } = await import('../documents/hwpx-engine')
    return hwpxToText(filePath)
  }

  if (ext === 'pdf') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>
      const buffer = await readFile(filePath)
      const data = await pdfParse(buffer)
      return data.text
    } catch {
      throw new Error('PDF 파싱 실패. pdf-parse 모듈을 확인하세요.')
    }
  }

  // Text-based files
  const textExts = new Set(['txt', 'md', 'csv', 'json', 'xml', 'html', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'css', 'yaml', 'yml', 'toml', 'ini', 'log', 'sql', 'sh', 'bat', 'ps1'])
  if (textExts.has(ext)) {
    return readFile(filePath, 'utf-8')
  }

  throw new Error(`지원하지 않는 파일 형식입니다: .${ext}`)
}
