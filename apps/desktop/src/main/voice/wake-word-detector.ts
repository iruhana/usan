/**
 * Wake Word Detector ??detects "?곗궛" or custom wake word.
 * Uses Picovoice Porcupine if available, otherwise push-to-talk only.
 */
import { EventEmitter } from 'events'
import { eventBus } from '../infrastructure/event-bus'
import { audioCapture } from './audio-capture'
import { transcribe } from './stt-engine'
import type { VoiceStatus } from '@shared/types/infrastructure'

// Optional Picovoice dependency
let Porcupine: unknown = null
// eslint-disable-next-line @typescript-eslint/no-require-imports
try { Porcupine = require('@picovoice/porcupine-node') } catch { /* not installed */ }

export class WakeWordDetector extends EventEmitter {
  private active = false
  private status: VoiceStatus = 'idle'
  private cleanupFn: (() => void) | null = null
  private pendingResult: Promise<{ text: string } | { error: string }> | null = null

  isActive(): boolean {
    return this.active
  }

  getStatus(): VoiceStatus {
    return this.status
  }

  hasPorcupine(): boolean {
    return Porcupine !== null
  }

  /**
   * Start listening for voice input (push-to-talk mode).
   * Records audio, transcribes, and emits 'transcript' event.
   */
  async startListening(): Promise<{ text: string } | { error: string }> {
    if (this.active) return { error: 'Voice recognition is already active' }

    this.active = true
    this.setStatus('listening')

    if (!audioCapture.isAvailable()) {
      // Fallback: record via PowerShell + ffmpeg (Windows)
      return this.recordViaPowerShell()
    }

    const resultPromise = new Promise<{ text: string } | { error: string }>((resolve) => {
      const onSilence = () => {
        cleanup()
        const buffer = audioCapture.stop()
        this.processAudio(buffer).then(resolve)
      }

      const onError = (err: Error) => {
        cleanup()
        this.setStatus('error')
        resolve({ error: err.message })
      }

      const cleanup = () => {
        audioCapture.removeListener('silence', onSilence)
        audioCapture.removeListener('error', onError)
        this.cleanupFn = null
      }

      this.cleanupFn = () => {
        cleanup()
        const buffer = audioCapture.stop()
        this.processAudio(buffer).then(resolve)
      }

      audioCapture.on('silence', onSilence)
      audioCapture.on('error', onError)
      audioCapture.start()

      // Max recording duration: 30 seconds
      setTimeout(() => {
        if (this.active) {
          cleanup()
          const buffer = audioCapture.stop()
          this.processAudio(buffer).then(resolve)
        }
      }, 30000)
    })

    this.pendingResult = resultPromise
    return resultPromise
  }

  /** Stop listening and process collected audio */
  async stopListening(): Promise<{ text: string } | { error: string }> {
    if (!this.active) return { error: 'Voice recognition is not active' }

    if (this.cleanupFn) {
      this.cleanupFn()
      this.cleanupFn = null
      // Wait for the actual transcription result from startListening's promise
      if (this.pendingResult) {
        const result = await this.pendingResult
        this.pendingResult = null
        return result
      }
    }

    const buffer = audioCapture.stop()
    return this.processAudio(buffer)
  }

  private async processAudio(buffer: Buffer): Promise<{ text: string } | { error: string }> {
    this.active = false

    if (buffer.length < 3200) {
      this.setStatus('idle')
      return { error: 'No voice input detected' }
    }

    this.setStatus('processing')

    try {
      const result = await transcribe(buffer)
      this.setStatus('idle')
      this.emit('transcript', result.text)
      return { text: result.text }
    } catch (err) {
      this.setStatus('error')
      return { error: (err as Error).message }
    }
  }

  /**
   * Fallback recording using PowerShell + SoX/ffmpeg.
   * Records 5 seconds of audio via default microphone.
   */
  private async recordViaPowerShell(): Promise<{ text: string } | { error: string }> {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const { join } = await import('path')
    const { app: electronApp } = await import('electron')
    const { unlink } = await import('fs/promises')
    const execFileAsync = promisify(execFile)

    const tempPath = join(electronApp.getPath('temp'), `usan-voice-${Date.now()}.wav`)

    try {
      // Try recording with PowerShell + NAudio approach
      const ps = `
Add-Type -AssemblyName System.Speech
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$recognizer.SetInputToDefaultAudioDevice()
$grammar = New-Object System.Speech.Recognition.DictationGrammar
$recognizer.LoadGrammar($grammar)
try {
  $result = $recognizer.Recognize([TimeSpan]::FromSeconds(10))
  if ($result) { Write-Output $result.Text }
  else { Write-Output '' }
} finally {
  $recognizer.Dispose()
}
`
      const { stdout } = await execFileAsync('powershell', [
        '-NoProfile', '-NonInteractive', '-Command', ps,
      ], { timeout: 15000, windowsHide: true })

      const text = stdout.trim()
      this.active = false
      this.setStatus('idle')

      if (text) {
        this.emit('transcript', text)
        return { text }
      }
      return { error: 'No voice input detected' }
    } catch (err) {
      this.active = false
      this.setStatus('error')
      await unlink(tempPath).catch(() => {})
      return { error: `Voice capture failed: ${(err as Error).message}` }
    }
  }

  private setStatus(status: VoiceStatus): void {
    this.status = status
    eventBus.emit('voice.status', { status }, 'wake-word-detector')
  }

  destroy(): void {
    if (this.active) {
      audioCapture.stop()
    }
    this.active = false
    this.removeAllListeners()
  }
}

export const wakeWordDetector = new WakeWordDetector()
