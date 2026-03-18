/**
 * STT Engine: local Whisper first, then OpenRouter Whisper fallback.
 */
import { createWriteStream } from 'fs'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { cpus } from 'os'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { app } from 'electron'
import { loadSettings } from '../store'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const LOCAL_MODEL_NAME = 'ggml-base.bin'
const LOCAL_MODEL_URL =
  process.env.USAN_WHISPER_MODEL_URL ||
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true'

interface LocalWhisperModule {
  transcribe: (
    options: Record<string, unknown> & ({
      fname_inp: string
    } | {
      pcmf32: Float32Array
    }),
  ) => Promise<{ transcription: string[][] | string[] }>
}

let localWhisperModulePromise: Promise<LocalWhisperModule | null> | null = null
let localModelPathPromise: Promise<string> | null = null
let localWhisperModuleOverride: LocalWhisperModule | null | undefined
let localModelPathOverride: string | null | undefined

export interface SttResult {
  text: string
  language?: string
  confidence?: number
  duration?: number
  provider?: 'local' | 'openrouter'
}

export interface SttOptions {
  language?: string
  prompt?: string
}

export async function transcribe(audioBuffer: Buffer, options: SttOptions = {}): Promise<SttResult> {
  if (audioBuffer.length < 1600) {
    return { text: '', confidence: 0 }
  }

  const errors: string[] = []

  try {
    const localResult = await transcribeLocally(audioBuffer, options)
    return localResult
  } catch (err) {
    errors.push((err as Error).message)
  }

  const settings = loadSettings()
  const apiKey = settings.cloudApiKey?.trim()
  if (!apiKey) {
    throw new Error(buildUnavailableMessage(errors))
  }

  return transcribeViaOpenRouter(audioBuffer, apiKey, options)
}

interface WhisperResponse {
  text?: string
  language?: string
  duration?: number
}

async function transcribeLocally(audioBuffer: Buffer, options: SttOptions): Promise<SttResult> {
  const whisper = await loadLocalWhisperModule()
  if (!whisper) {
    throw new Error('Local Whisper addon is not available')
  }

  const modelPath = await resolveLocalWhisperModelPath()
  const pcmf32 = pcm16ToFloat32(audioBuffer)
  const threadCount = Math.max(1, Math.min(8, cpus().length || 1))

  const result = await whisper.transcribe({
    pcmf32,
    model: modelPath,
    language: options.language ?? 'auto',
    detect_language: !options.language,
    translate: false,
    no_timestamps: true,
    no_prints: true,
    use_gpu: process.env.USAN_WHISPER_USE_GPU === '1',
    n_threads: threadCount,
  })

  const text = normalizeLocalTranscription(result.transcription)

  return {
    text,
    language: options.language,
    confidence: text ? 0.92 : 0,
    duration: audioBuffer.length / (16000 * 2),
    provider: 'local',
  }
}

async function transcribeViaOpenRouter(
  audioBuffer: Buffer,
  apiKey: string,
  options: SttOptions,
): Promise<SttResult> {
  const wavBuffer = pcm16ToWav(audioBuffer, 16000, 1)
  const tempPath = join(app.getPath('temp'), `usan-stt-${Date.now()}.wav`)
  const baseUrl = process.env.USAN_OPENROUTER_BASE_URL || OPENROUTER_BASE

  try {
    await writeFile(tempPath, wavBuffer)

    const audioData = await readFile(tempPath)
    const formData = new FormData()
    formData.append('file', new Blob([audioData], { type: 'audio/wav' }), 'audio.wav')
    formData.append('model', 'openai/whisper-large-v3')
    if (options.language) formData.append('language', options.language)
    if (options.prompt) formData.append('prompt', options.prompt)
    formData.append('response_format', 'json')

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`STT API request failed (${response.status}): ${errorText}`)
    }

    const data = await response.json() as WhisperResponse
    const text = data.text?.trim() || ''

    return {
      text,
      language: data.language || options.language,
      confidence: text.length > 0 ? 0.95 : 0,
      duration: data.duration || audioBuffer.length / (16000 * 2),
      provider: 'openrouter',
    }
  } finally {
    await unlink(tempPath).catch(() => {})
  }
}

async function loadLocalWhisperModule(): Promise<LocalWhisperModule | null> {
  if (localWhisperModuleOverride !== undefined) {
    return localWhisperModuleOverride
  }

  if (!localWhisperModulePromise) {
    localWhisperModulePromise = import('@kutalia/whisper-node-addon')
      .then((module) => {
        const transcribeFn =
          typeof module.transcribe === 'function'
            ? module.transcribe
            : (module as { default?: { transcribe?: unknown } }).default?.transcribe

        if (typeof transcribeFn !== 'function') {
          throw new Error('Whisper addon did not expose transcribe()')
        }

        return { transcribe: transcribeFn } as unknown as LocalWhisperModule
      })
      .catch(() => null)
  }

  return localWhisperModulePromise
}

async function resolveLocalWhisperModelPath(): Promise<string> {
  if (!localModelPathPromise) {
    localModelPathPromise = ensureLocalWhisperModel()
  }

  try {
    return await localModelPathPromise
  } catch (error) {
    localModelPathPromise = null
    throw error
  }
}

async function ensureLocalWhisperModel(): Promise<string> {
  if (localModelPathOverride !== undefined) {
    if (!localModelPathOverride) {
      throw new Error('Local Whisper model is missing')
    }
    return localModelPathOverride
  }

  const userModelPath = join(app.getPath('userData'), 'models', 'whisper', LOCAL_MODEL_NAME)
  const bundledModelPath = join(process.resourcesPath, 'models', 'whisper', LOCAL_MODEL_NAME)

  for (const candidate of [process.env.USAN_WHISPER_MODEL_PATH, userModelPath, bundledModelPath]) {
    if (!candidate) continue
    try {
      const contents = await readFile(candidate)
      if (contents.length > 0) return candidate
    } catch {
      // Ignore missing model and continue.
    }
  }

  if (process.env.USAN_WHISPER_AUTO_DOWNLOAD === '0') {
    throw new Error('Local Whisper model is missing')
  }

  await mkdir(join(app.getPath('userData'), 'models', 'whisper'), { recursive: true })

  const response = await fetch(LOCAL_MODEL_URL)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download local Whisper model (${response.status})`)
  }

  const nodeStream = Readable.fromWeb(response.body as globalThis.ReadableStream<Uint8Array>)
  await pipeline(nodeStream, createWriteStream(userModelPath))
  return userModelPath
}

export function __setLocalWhisperModuleForTests(module: LocalWhisperModule | null | undefined): void {
  localWhisperModuleOverride = module
  localWhisperModulePromise = null
}

export function __setLocalWhisperModelPathForTests(modelPath: string | null | undefined): void {
  localModelPathOverride = modelPath
  localModelPathPromise = null
}

export function __resetSttEngineForTests(): void {
  localWhisperModulePromise = null
  localModelPathPromise = null
  localWhisperModuleOverride = undefined
  localModelPathOverride = undefined
}

function normalizeLocalTranscription(transcription: string[][] | string[]): string {
  if (!Array.isArray(transcription)) return ''

  const segments = transcription.flatMap((entry) => {
    if (Array.isArray(entry)) return entry
    return [entry]
  })

  return segments
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(' ')
    .trim()
}

function buildUnavailableMessage(errors: string[]): string {
  const detail = errors.find(Boolean)
  if (detail) {
    return `Voice input needs setup before it can work. ${detail}`
  }

  return 'Voice input needs setup before it can work.'
}

function pcm16ToFloat32(pcmData: Buffer): Float32Array {
  const sampleCount = Math.floor(pcmData.length / 2)
  const output = new Float32Array(sampleCount)

  for (let index = 0; index < sampleCount; index += 1) {
    output[index] = pcmData.readInt16LE(index * 2) / 32768
  }

  return output
}

function pcm16ToWav(pcmData: Buffer, sampleRate: number, channels: number): Buffer {
  const byteRate = sampleRate * channels * 2
  const blockAlign = channels * 2
  const dataSize = pcmData.length
  const headerSize = 44
  const buffer = Buffer.alloc(headerSize + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)

  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(16, 34)

  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  pcmData.copy(buffer, 44)

  return buffer
}
