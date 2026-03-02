import { app } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { writeFile, rename } from 'fs/promises'
import { sendNotification, flashWindow } from '../notifications'

export interface Reminder {
  id: string
  text: string
  fireAt: number
  createdAt: number
  fired: boolean
}

const MAX_DELAY_MS = 48 * 60 * 60 * 1000 // 48 hours
const PRUNE_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getDataDir(): string {
  return join(app.getPath('userData'), 'data')
}

function getRemindersPath(): string {
  return join(getDataDir(), 'reminders.json')
}

class ReminderManager {
  private reminders: Reminder[] = []
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  private loaded = false
  private shuttingDown = false

  private ensureLoaded(): void {
    if (this.loaded) return
    this.loaded = true
    const dataDir = getDataDir()
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }
    try {
      const raw = readFileSync(getRemindersPath(), 'utf-8')
      this.reminders = JSON.parse(raw) as Reminder[]
    } catch {
      this.reminders = []
    }
    this.pruneOld()
    this.rescheduleAll()
  }

  private pruneOld(): void {
    const cutoff = Date.now() - PRUNE_AGE_MS
    this.reminders = this.reminders.filter((r) => !r.fired || r.fireAt > cutoff)
  }

  private rescheduleAll(): void {
    const now = Date.now()
    for (const r of this.reminders) {
      if (r.fired) continue
      if (r.fireAt <= now) {
        this.fire(r)
      } else {
        this.scheduleTimer(r)
      }
    }
  }

  private scheduleTimer(reminder: Reminder): void {
    this.clearTimer(reminder.id)
    const delay = reminder.fireAt - Date.now()
    if (delay <= 0) {
      this.fire(reminder)
      return
    }
    const timer = setTimeout(() => this.fire(reminder), delay)
    this.timers.set(reminder.id, timer)
  }

  private clearTimer(id: string): void {
    const existing = this.timers.get(id)
    if (existing) {
      clearTimeout(existing)
      this.timers.delete(id)
    }
  }

  private fire(reminder: Reminder): void {
    if (this.shuttingDown) return
    reminder.fired = true
    this.clearTimer(reminder.id)
    sendNotification({
      title: '우산 알림',
      body: reminder.text,
      level: 'info',
      sound: true,
    })
    flashWindow()
    this.persist().catch(() => {})
  }

  private async persist(): Promise<void> {
    const path = getRemindersPath()
    const tmp = path + '.tmp'
    await writeFile(tmp, JSON.stringify(this.reminders, null, 2), 'utf-8')
    await rename(tmp, path)
  }

  set(text: string, delayMinutes: number): { id: string; firesAt: string } | { error: string } {
    this.ensureLoaded()

    if (delayMinutes <= 0) {
      return { error: '시간은 0보다 커야 합니다' }
    }

    const delayMs = delayMinutes * 60 * 1000
    if (delayMs > MAX_DELAY_MS) {
      return { error: '최대 48시간(2880분)까지 설정할 수 있습니다' }
    }

    const reminder: Reminder = {
      id: crypto.randomUUID(),
      text,
      fireAt: Date.now() + delayMs,
      createdAt: Date.now(),
      fired: false,
    }

    this.reminders.push(reminder)
    this.scheduleTimer(reminder)
    this.persist().catch(() => {})

    return {
      id: reminder.id,
      firesAt: new Date(reminder.fireAt).toLocaleString('ko-KR'),
    }
  }

  list(): { reminders: Array<{ id: string; text: string; firesAt: string; fired: boolean }> } {
    this.ensureLoaded()
    return {
      reminders: this.reminders
        .filter((r) => !r.fired)
        .map((r) => ({
          id: r.id,
          text: r.text,
          firesAt: new Date(r.fireAt).toLocaleString('ko-KR'),
          fired: r.fired,
        })),
    }
  }

  cancel(id: string): { success: boolean } | { error: string } {
    this.ensureLoaded()
    const idx = this.reminders.findIndex((r) => r.id === id)
    if (idx === -1) {
      return { error: '해당 알림을 찾을 수 없습니다' }
    }
    this.clearTimer(id)
    this.reminders.splice(idx, 1)
    this.persist().catch(() => {})
    return { success: true }
  }

  cleanup(): void {
    this.shuttingDown = true
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }
}

export const reminderManager = new ReminderManager()
