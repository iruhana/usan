/**
 * Clipboard Manager — history tracking, pinning, format transforms.
 * Polls Electron clipboard API every 500ms.
 */
import { clipboard } from 'electron'
import type { ClipboardEntry, ClipboardTransformFormat } from '@shared/types/infrastructure'

const MAX_HISTORY = 200
const POLL_INTERVAL = 500
const MIN_POLL_INTERVAL = 250
const MAX_POLL_INTERVAL = 10000

export class ClipboardManager {
  private history: ClipboardEntry[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private lastText = ''
  private pollIntervalMs = POLL_INTERVAL

  start(): void {
    if (this.timer) return
    this.lastText = clipboard.readText() || ''
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getHistory(): ClipboardEntry[] {
    return [...this.history]
  }

  pin(id: string): void {
    const entry = this.history.find((e) => e.id === id)
    if (entry) entry.pinned = true
  }

  unpin(id: string): void {
    const entry = this.history.find((e) => e.id === id)
    if (entry) entry.pinned = false
  }

  transform(id: string, format: ClipboardTransformFormat): string {
    const entry = this.history.find((e) => e.id === id)
    if (!entry) throw new Error('Clipboard entry not found')

    switch (format) {
      case 'json_pretty': {
        try {
          return JSON.stringify(JSON.parse(entry.text), null, 2)
        } catch {
          throw new Error('Invalid JSON')
        }
      }
      case 'url_decode':
        try {
          return decodeURIComponent(entry.text)
        } catch {
          throw new Error('Invalid URL-encoded string')
        }
      case 'base64_decode':
        return Buffer.from(entry.text, 'base64').toString('utf-8')
      case 'md_to_text':
        return entry.text
          .replace(/#{1,6}\s+/g, '')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/`(.+?)`/g, '$1')
          .replace(/\[(.+?)\]\(.+?\)/g, '$1')
          .replace(/^[-*+]\s+/gm, '')
          .replace(/^\d+\.\s+/gm, '')
          .trim()
      default:
        throw new Error(`Unknown format: ${format}`)
    }
  }

  clear(): void {
    this.history = this.history.filter((e) => e.pinned)
  }

  setPollIntervalMs(intervalMs: number): void {
    const next = this.toSafePollInterval(intervalMs)
    if (next === this.pollIntervalMs) return
    this.pollIntervalMs = next

    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = setInterval(() => this.poll(), this.pollIntervalMs)
  }

  getPollIntervalMs(): number {
    return this.pollIntervalMs
  }

  private poll(): void {
    try {
      const text = clipboard.readText()
      if (!text || text === this.lastText) return
      this.lastText = text

      const entry: ClipboardEntry = {
        id: crypto.randomUUID(),
        text: text.slice(0, 10000), // Cap at 10KB
        timestamp: Date.now(),
        pinned: false,
      }

      this.history.unshift(entry)

      // Trim non-pinned entries beyond limit
      const pinned = this.history.filter((e) => e.pinned)
      const unpinned = this.history.filter((e) => !e.pinned)
      if (unpinned.length > MAX_HISTORY) {
        this.history = [...pinned, ...unpinned.slice(0, MAX_HISTORY)]
      }
    } catch { /* ignore clipboard read errors */ }
  }

  destroy(): void {
    this.stop()
    this.history = []
  }

  private toSafePollInterval(raw: number): number {
    if (!Number.isFinite(raw) || raw <= 0) return POLL_INTERVAL
    return Math.min(Math.max(Math.floor(raw), MIN_POLL_INTERVAL), MAX_POLL_INTERVAL)
  }
}

/** Singleton instance */
export const clipboardManager = new ClipboardManager()
