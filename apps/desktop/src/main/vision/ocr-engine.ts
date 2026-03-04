import type { OcrResult } from '@shared/types/infrastructure'
import { captureRegion, captureScreen, imageToBase64, type ScreenRegion } from './screen-analyzer'
import { loadSettings } from '../store'

export interface OcrOptions {
  region?: ScreenRegion
  languageHint?: string
}

interface OpenRouterCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  return raw.slice(start, end + 1)
}

function normalizeResult(payload: Partial<OcrResult> | null, fallbackText = ''): OcrResult {
  return {
    text: payload?.text ?? fallbackText,
    confidence: typeof payload?.confidence === 'number' ? payload.confidence : 0,
    regions: Array.isArray(payload?.regions) ? payload.regions : [],
  }
}

async function requestOcrFromModel(imageBase64: string, languageHint?: string): Promise<OcrResult> {
  const apiKey = loadSettings().cloudApiKey || process.env['OPENROUTER_API_KEY'] || process.env['OPENAI_API_KEY']
  if (!apiKey) {
    return normalizeResult(null)
  }

  const model = process.env['USAN_OCR_MODEL'] || 'openai/gpt-4o-mini'
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'Extract visible text from the image and return strict JSON only.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Return JSON with keys: text, confidence, regions.',
                'regions must be an array of { text, bounds: { x, y, width, height } }.',
                `language_hint: ${languageHint || 'auto'}`,
              ].join('\n'),
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0,
    }),
  })

  if (!response.ok) {
    return normalizeResult(null)
  }

  const data = await response.json() as OpenRouterCompletionResponse
  const content = data.choices?.[0]?.message?.content ?? ''
  if (!content) return normalizeResult(null)

  const jsonCandidate = extractFirstJsonObject(content)
  if (!jsonCandidate) {
    return normalizeResult(null, content.trim())
  }

  try {
    const parsed = JSON.parse(jsonCandidate) as Partial<OcrResult>
    return normalizeResult(parsed, content.trim())
  } catch {
    return normalizeResult(null, content.trim())
  }
}

export async function runOcrFromImage(imageBuffer: Buffer, options: Omit<OcrOptions, 'region'> = {}): Promise<OcrResult> {
  const imageBase64 = await imageToBase64(imageBuffer)
  return requestOcrFromModel(imageBase64, options.languageHint)
}

export async function runOcr(options: OcrOptions = {}): Promise<OcrResult> {
  const imageBuffer = options.region
    ? await captureRegion(options.region)
    : await captureScreen()

  return runOcrFromImage(imageBuffer, { languageHint: options.languageHint })
}
