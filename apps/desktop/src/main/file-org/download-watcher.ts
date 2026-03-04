import { app } from 'electron'
import { watch } from 'fs'
import { basename, join } from 'path'
import { eventBus } from '../infrastructure/event-bus'

export interface DownloadWatchEvent {
  type: 'created' | 'renamed' | 'deleted'
  fileName: string
  fullPath: string
  timestamp: number
}

class DownloadWatcher {
  private watcher: ReturnType<typeof watch> | null = null
  private events: DownloadWatchEvent[] = []
  private maxEvents = 200

  start(dirPath?: string): void {
    if (this.watcher) return
    const targetDir = dirPath || app.getPath('downloads')

    this.watcher = watch(targetDir, { persistent: false }, (eventType, fileName) => {
      if (!fileName) return

      const mappedType: DownloadWatchEvent['type'] = eventType === 'rename' ? 'renamed' : 'created'
      const event: DownloadWatchEvent = {
        type: mappedType,
        fileName: basename(fileName.toString()),
        fullPath: join(targetDir, fileName.toString()),
        timestamp: Date.now(),
      }

      this.events.unshift(event)
      if (this.events.length > this.maxEvents) {
        this.events = this.events.slice(0, this.maxEvents)
      }

      eventBus.emit('file-org.download', event as unknown as Record<string, unknown>, 'download-watcher')
    })
  }

  stop(): void {
    if (!this.watcher) return
    this.watcher.close()
    this.watcher = null
  }

  listEvents(): DownloadWatchEvent[] {
    return [...this.events]
  }

  clearEvents(): void {
    this.events = []
  }

  isRunning(): boolean {
    return this.watcher != null
  }
}

export const downloadWatcher = new DownloadWatcher()
