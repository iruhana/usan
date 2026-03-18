import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const AUDIO_BUFFER = Buffer.alloc(6400, 8)

let tempDir = ''
let mockCloudApiKey = 'cloud-key'
const mockLocalTranscribe = vi.fn()

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir,
  },
}))

vi.mock('../../src/main/store', () => ({
  loadSettings: () => ({ cloudApiKey: mockCloudApiKey }),
}))

describe('stt-engine', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    mockLocalTranscribe.mockReset()
    tempDir = mkdtempSync(join(tmpdir(), 'usan-stt-'))
    mockCloudApiKey = 'cloud-key'
    process.env.USAN_WHISPER_MODEL_PATH = join(tempDir, 'ggml-base.bin')
    writeFileSync(process.env.USAN_WHISPER_MODEL_PATH, Buffer.from('fake-model'))
  })

  afterEach(() => {
    delete process.env.USAN_WHISPER_MODEL_PATH
    delete process.env.USAN_WHISPER_AUTO_DOWNLOAD
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('prefers the local Whisper addon when available', async () => {
    mockLocalTranscribe.mockResolvedValue({ transcription: [['hello', 'world']] })

    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const {
      transcribe,
      __resetSttEngineForTests,
      __setLocalWhisperModelPathForTests,
      __setLocalWhisperModuleForTests,
    } = await import('../../src/main/voice/stt-engine')
    __resetSttEngineForTests()
    __setLocalWhisperModelPathForTests(process.env.USAN_WHISPER_MODEL_PATH)
    __setLocalWhisperModuleForTests({
      transcribe: (...args: unknown[]) => mockLocalTranscribe(...args),
    })
    const result = await transcribe(AUDIO_BUFFER, { language: 'en' })

    expect(result.provider).toBe('local')
    expect(result.text).toBe('hello world')
    expect(mockLocalTranscribe).toHaveBeenCalledTimes(1)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('falls back to OpenRouter when local Whisper fails', async () => {
    mockLocalTranscribe.mockRejectedValue(new Error('local whisper failed'))

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'fallback text', language: 'ko', duration: 1.25 }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    const {
      transcribe,
      __resetSttEngineForTests,
      __setLocalWhisperModelPathForTests,
      __setLocalWhisperModuleForTests,
    } = await import('../../src/main/voice/stt-engine')
    __resetSttEngineForTests()
    __setLocalWhisperModelPathForTests(process.env.USAN_WHISPER_MODEL_PATH)
    __setLocalWhisperModuleForTests({
      transcribe: (...args: unknown[]) => mockLocalTranscribe(...args),
    })
    const result = await transcribe(AUDIO_BUFFER, { language: 'ko' })

    expect(result.provider).toBe('openrouter')
    expect(result.text).toBe('fallback text')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
