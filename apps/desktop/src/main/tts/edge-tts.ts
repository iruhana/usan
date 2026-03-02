import { app } from 'electron'
import { join } from 'path'
import { mkdir, readdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { EdgeTTS } from 'node-edge-tts'

const VOICES: Record<string, string> = {
  ko: 'ko-KR-SunHiNeural',
  en: 'en-US-MichelleNeural',
  ja: 'ja-JP-NanamiNeural',
  zh: 'zh-CN-XiaoxiaoNeural',
}

const DEFAULT_RATE = '-20%'
const MAX_TTS_FILES = 50

function getTtsDir(): string {
  return join(app.getPath('temp'), 'usan-tts')
}

async function ensureTtsDir(): Promise<string> {
  const dir = getTtsDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  return dir
}

function detectLanguage(text: string): string {
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'ko'
  // Japanese kana (hiragana + katakana) — check before CJK ideographs
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja'
  // CJK ideographs without kana → Chinese
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh'
  return 'en'
}

async function cleanupOldFiles(dir: string): Promise<void> {
  try {
    const files = (await readdir(dir))
      .filter((f) => f.startsWith('tts-') && f.endsWith('.mp3'))
      .sort()
    if (files.length <= MAX_TTS_FILES) return
    const toDelete = files.slice(0, files.length - MAX_TTS_FILES)
    await Promise.all(toDelete.map((f) => unlink(join(dir, f)).catch(() => {})))
  } catch {
    // cleanup is best-effort
  }
}

export async function speakText(
  text: string,
  voice?: string,
  rate?: string
): Promise<{ audioPath: string } | { error: string }> {
  if (!text || text.trim().length === 0) {
    return { error: '읽을 텍스트를 입력해주세요' }
  }

  const dir = await ensureTtsDir()
  const filename = `tts-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.mp3`
  const outputPath = join(dir, filename)

  const lang = detectLanguage(text)
  const selectedVoice = voice || VOICES[lang] || VOICES.ko
  const selectedRate = rate || DEFAULT_RATE

  try {
    const tts = new EdgeTTS({ voice: selectedVoice, rate: selectedRate })
    await tts.ttsPromise(text, outputPath)
    cleanupOldFiles(dir).catch(() => {})
    return { audioPath: outputPath }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `TTS 생성 실패: ${message}` }
  }
}
