/**
 * STT Engine — speech-to-text using cloud API (OpenRouter Whisper).
 * Falls back to offline mode error if no API key configured.
 */
import { readFile, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { loadSettings } from '../store'
import { eventBus } from '../infrastructure/event-bus'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export interface SttResult {
  text: string
  language?: string
  confidence?: number
  duration?: number
}

export interface SttOptions {
  language?: string     // ISO 639-1, e.g. 'ko', 'en', 'ja'
  prompt?: string       // context hint for better recognition
}

/**
 * Transcribe raw PCM16 audio buffer to text.
 * Writes temp WAV file, sends to OpenRouter Whisper API, cleans up.
 */
export async function transcribe(audioBuffer: Buffer, options: SttOptions = {}): Promise<SttResult> {
  if (audioBuffer.length < 1600) {
    return { text: '', confidence: 0 }
  }

  eventBus.emit('voice.status', { status: 'processing' }, 'stt-engine')

  const wavBuffer = pcm16ToWav(audioBuffer, 16000, 1)
  const tempPath = join(app.getPath('temp'), `usan-stt-${Date.now()}.wav`)

  try {
    await writeFile(tempPath, wavBuffer)

    const settings = loadSettings()
    const apiKey = settings.cloudApiKey
    if (!apiKey) {
      throw new Error('API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.')
    }

    const result = await transcribeViaOpenRouter(tempPath, apiKey, options)
    eventBus.emit('voice.status', { status: 'idle', text: result.text }, 'stt-engine')
    return result
  } catch (err) {
    const error = (err as Error).message
    eventBus.emit('voice.status', { status: 'error', error }, 'stt-engine')
    throw err
  } finally {
    await unlink(tempPath).catch(() => {})
  }
}

interface WhisperResponse {
  text?: string
  language?: string
  duration?: number
}

async function transcribeViaOpenRouter(
  wavPath: string,
  apiKey: string,
  options: SttOptions,
): Promise<SttResult> {
  const audioData = await readFile(wavPath)
  const baseUrl = process.env.USAN_OPENROUTER_BASE_URL || OPENROUTER_BASE

  // Use Whisper via OpenRouter's OpenAI-compatible transcription endpoint
  const formData = new FormData()
  formData.append('file', new Blob([audioData], { type: 'audio/wav' }), 'audio.wav')
  formData.append('model', 'openai/whisper-large-v3')
  if (options.language) formData.append('language', options.language)
  if (options.prompt) formData.append('prompt', options.prompt)
  formData.append('response_format', 'json')

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`STT API 요청 실패 (${response.status}): ${errorText}`)
  }

  const data = await response.json() as WhisperResponse
  const text = data.text?.trim() || ''

  return {
    text,
    language: data.language || options.language,
    confidence: text.length > 0 ? 0.95 : 0,
    duration: data.duration || audioData.length / (16000 * 2),
  }
}

/** Convert raw PCM16 mono to WAV format */
function pcm16ToWav(pcmData: Buffer, sampleRate: number, channels: number): Buffer {
  const byteRate = sampleRate * channels * 2
  const blockAlign = channels * 2
  const dataSize = pcmData.length
  const headerSize = 44
  const buffer = Buffer.alloc(headerSize + dataSize)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)

  // fmt sub-chunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)       // sub-chunk size
  buffer.writeUInt16LE(1, 20)        // PCM format
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(16, 34)       // bits per sample

  // data sub-chunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  pcmData.copy(buffer, 44)

  return buffer
}
