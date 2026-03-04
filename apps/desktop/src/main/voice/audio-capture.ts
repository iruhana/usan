/**
 * Audio Capture ??records microphone audio as PCM16 buffers.
 * Uses node-record-lpcm16 if available, otherwise gracefully degrades.
 */
import { EventEmitter } from 'events'
import { eventBus } from '../infrastructure/event-bus'

// Optional dependency ??may not be installed
let nodeRecord: { record: (options: { sampleRate: number; channels: number; audioType: string; recorder: string }) => RecordingInstance } | null = null
// eslint-disable-next-line @typescript-eslint/no-require-imports
try { nodeRecord = require('node-record-lpcm16') as { record: (options: { sampleRate: number; channels: number; audioType: string; recorder: string }) => RecordingInstance } } catch { /* not installed */ }

export interface AudioCaptureOptions {
  sampleRate?: number    // default 16000
  channels?: number      // default 1 (mono)
  threshold?: number     // silence threshold (0-1), default 0.01
  silenceMs?: number     // silence duration to auto-stop, default 2000
}

interface RecordingInstance {
  stop: () => void
  stream: () => NodeJS.ReadableStream
}

export class AudioCapture extends EventEmitter {
  private recording: RecordingInstance | null = null
  private chunks: Buffer[] = []
  private options: Required<AudioCaptureOptions>
  private silenceTimer: NodeJS.Timeout | null = null
  private _isRecording = false

  constructor(options: AudioCaptureOptions = {}) {
    super()
    this.options = {
      sampleRate: options.sampleRate ?? 16000,
      channels: options.channels ?? 1,
      threshold: options.threshold ?? 0.01,
      silenceMs: options.silenceMs ?? 2000,
    }
  }

  get isRecording(): boolean {
    return this._isRecording
  }

  isAvailable(): boolean {
    return nodeRecord !== null
  }

  start(): void {
    if (this._isRecording) return

    if (!nodeRecord) {
      eventBus.emit('voice.status', { status: 'error', error: 'node-record-lpcm16 module is not installed' }, 'audio-capture')
      this.emit('error', new Error('node-record-lpcm16 module is not installed'))
      return
    }

    this._isRecording = true
    this.chunks = []

    try {
      this.recording = nodeRecord.record({
        sampleRate: this.options.sampleRate,
        channels: this.options.channels,
        audioType: 'raw',
        recorder: 'sox',
      }) as unknown as RecordingInstance

      const stream = this.recording.stream()

      stream.on('data', (chunk: Buffer) => {
        this.chunks.push(chunk)
        this.emit('data', chunk)

        // Check for silence
        const rms = this.calculateRMS(chunk)
        if (rms < this.options.threshold) {
          if (!this.silenceTimer) {
            this.silenceTimer = setTimeout(() => {
              this.emit('silence')
            }, this.options.silenceMs)
          }
        } else {
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer)
            this.silenceTimer = null
          }
        }
      })

      stream.on('error', (err: Error) => {
        this.emit('error', err)
        this.stop()
      })

      stream.on('end', () => {
        this._isRecording = false
        this.emit('end', this.getAudioBuffer())
      })

      this.emit('start')
    } catch (err) {
      this._isRecording = false
      eventBus.emit('voice.status', {
        status: 'error',
        error: (err as Error).message,
      }, 'audio-capture')
      this.emit('error', err)
    }
  }

  stop(): Buffer {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }

    if (this.recording) {
      try { this.recording.stop() } catch { /* ignore */ }
      this.recording = null
    }

    this._isRecording = false
    return this.getAudioBuffer()
  }

  getAudioBuffer(): Buffer {
    return Buffer.concat(this.chunks)
  }

  private calculateRMS(buffer: Buffer): number {
    if (buffer.length < 2) return 0
    let sum = 0
    const samples = buffer.length / 2
    for (let i = 0; i < buffer.length - 1; i += 2) {
      const sample = buffer.readInt16LE(i) / 32768
      sum += sample * sample
    }
    return Math.sqrt(sum / samples)
  }

  destroy(): void {
    this.stop()
    this.removeAllListeners()
  }
}

export const audioCapture = new AudioCapture()
