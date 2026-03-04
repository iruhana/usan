/**
 * Central Event Bus — decouples modules via typed events.
 * Uses Node.js EventEmitter + ring buffer for history.
 */
import { EventEmitter } from 'events'
import type { UsanEvent } from '@shared/types/infrastructure'

const MAX_HISTORY = 1000

export class EventBus {
  private emitter = new EventEmitter()
  private ring: UsanEvent[] = []
  private ringIndex = 0
  private ringFull = false

  constructor() {
    this.emitter.setMaxListeners(100)
  }

  emit(type: string, payload: Record<string, unknown>, source: string): void {
    const event: UsanEvent = { type, payload, timestamp: Date.now(), source }
    // Push to ring buffer
    this.ring[this.ringIndex] = event
    this.ringIndex = (this.ringIndex + 1) % MAX_HISTORY
    if (this.ringIndex === 0 && this.ring.length >= MAX_HISTORY) this.ringFull = true
    this.emitter.emit(type, event)
  }

  on(type: string, handler: (event: UsanEvent) => void): () => void {
    this.emitter.on(type, handler)
    return () => this.emitter.removeListener(type, handler)
  }

  once(type: string, handler: (event: UsanEvent) => void): () => void {
    this.emitter.once(type, handler)
    return () => this.emitter.removeListener(type, handler)
  }

  history(filter?: { types?: string[] }, limit?: number): UsanEvent[] {
    const count = this.ringFull ? MAX_HISTORY : this.ringIndex
    const events: UsanEvent[] = []
    const start = this.ringFull ? this.ringIndex : 0

    for (let i = 0; i < count; i++) {
      const idx = (start + i) % MAX_HISTORY
      const evt = this.ring[idx]
      if (!evt) continue
      if (filter?.types && !filter.types.includes(evt.type)) continue
      events.push(evt)
    }

    if (limit && limit > 0) {
      return events.slice(-limit)
    }
    return events
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners()
  }

  destroy(): void {
    this.removeAllListeners()
    this.ring = []
    this.ringIndex = 0
    this.ringFull = false
  }
}

/** Singleton instance */
export const eventBus = new EventBus()
