import { writeFile } from 'fs/promises'
import { loadSettings } from '../store'

export interface ImageGenerationRequest {
  prompt: string
  size?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto'
  quality?: 'low' | 'medium' | 'high' | 'auto'
  background?: 'opaque' | 'transparent' | 'auto'
  outputPath?: string
}

export interface ImageGenerationResult {
  base64: string
  outputPath?: string
  revisedPrompt?: string
}

interface OpenAIImageResponse {
  data?: Array<{
    b64_json?: string
    revised_prompt?: string
  }>
}

function getApiKey(): string | null {
  return loadSettings().cloudApiKey || process.env['OPENAI_API_KEY'] || null
}

export async function generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  if (!request.prompt || !request.prompt.trim()) {
    throw new Error('prompt is required')
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for image generation')
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: request.prompt,
      size: request.size ?? '1024x1024',
      quality: request.quality ?? 'auto',
      background: request.background ?? 'auto',
      output_format: 'png',
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Image generation failed (${response.status}): ${body || response.statusText}`)
  }

  const payload = await response.json() as OpenAIImageResponse
  const item = payload.data?.[0]
  if (!item?.b64_json) {
    throw new Error('Image generation returned empty payload')
  }

  if (request.outputPath) {
    const buffer = Buffer.from(item.b64_json, 'base64')
    await writeFile(request.outputPath, buffer)
  }

  return {
    base64: item.b64_json,
    outputPath: request.outputPath,
    revisedPrompt: item.revised_prompt,
  }
}
