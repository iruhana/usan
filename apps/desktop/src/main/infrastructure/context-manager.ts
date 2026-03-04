/**
 * Context Manager — tracks user context: active window, app type, time-of-day, idle time.
 * Depends on SystemMonitor for active window detection.
 */
import { screen } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { ContextSnapshot, TimeOfDay, MonitorInfo } from '@shared/types/infrastructure'
import { eventBus } from './event-bus'
import { getActiveWindow } from './system-monitor'

const execFileAsync = promisify(execFile)

const POLL_INTERVAL = 3000

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'afternoon'
  if (h >= 18 && h < 22) return 'evening'
  return 'night'
}

function normalizeAppName(processName: string): string {
  const lower = processName.toLowerCase()
  const appMap: Record<string, string> = {
    chrome: 'chrome', msedge: 'edge', firefox: 'firefox', brave: 'brave',
    code: 'vscode', devenv: 'visual-studio',
    excel: 'excel', winword: 'word', powerpnt: 'powerpoint', onenote: 'onenote', outlook: 'outlook',
    explorer: 'explorer', cmd: 'terminal', powershell: 'terminal', windowsterminal: 'terminal',
    notepad: 'notepad', 'notepad++': 'notepad++',
    slack: 'slack', discord: 'discord', teams: 'teams', telegram: 'telegram',
    spotify: 'spotify', vlc: 'vlc',
  }
  return appMap[lower] ?? lower
}

async function getIdleTime(): Promise<number> {
  try {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class IdleTime {
  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref LASTINPUTINFO p);
  [StructLayout(LayoutKind.Sequential)] struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  public static uint Get() {
    var info = new LASTINPUTINFO { cbSize = 8 };
    GetLastInputInfo(ref info);
    return (uint)Environment.TickCount - info.dwTime;
  }
}
"@
[IdleTime]::Get()`
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command', script,
    ], { timeout: 5000, windowsHide: true })
    return parseInt(stdout.trim(), 10) || 0
  } catch {
    return 0
  }
}

function getMonitors(): MonitorInfo[] {
  try {
    const displays = screen.getAllDisplays()
    return displays.map((d) => ({
      id: d.id,
      bounds: { x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height },
      primary: d.bounds.x === 0 && d.bounds.y === 0,
      label: d.label || undefined,
    }))
  } catch {
    return []
  }
}

export class ContextManager {
  private timer: ReturnType<typeof setInterval> | null = null
  private snapshot: ContextSnapshot | null = null
  private handlers: Array<(s: ContextSnapshot) => void> = []
  private lastApp = ''

  start(): void {
    if (this.timer) return
    this.tick()
    this.timer = setInterval(() => this.tick(), POLL_INTERVAL)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  getSnapshot(): ContextSnapshot {
    return this.snapshot ?? {
      activeWindow: null,
      activeApp: '',
      timeOfDay: getTimeOfDay(),
      idleTimeMs: 0,
      monitors: getMonitors(),
      timestamp: Date.now(),
    }
  }

  onContextChange(handler: (snapshot: ContextSnapshot) => void): () => void {
    this.handlers.push(handler)
    return () => {
      const idx = this.handlers.indexOf(handler)
      if (idx >= 0) this.handlers.splice(idx, 1)
    }
  }

  private async tick(): Promise<void> {
    try {
      const activeWindow = await getActiveWindow()
      const activeApp = activeWindow ? normalizeAppName(activeWindow.processName) : ''
      const idleTimeMs = await getIdleTime()

      this.snapshot = {
        activeWindow,
        activeApp,
        timeOfDay: getTimeOfDay(),
        idleTimeMs,
        monitors: getMonitors(),
        timestamp: Date.now(),
      }

      // Only emit when app changes
      if (activeApp !== this.lastApp) {
        this.lastApp = activeApp
        eventBus.emit('context.changed', this.snapshot as unknown as Record<string, unknown>, 'context-manager')
        for (const h of [...this.handlers]) {
          try { h(this.snapshot) } catch { /* ignore listener errors */ }
        }
      }
    } catch {
      // Silently skip failed tick
    }
  }

  destroy(): void {
    this.stop()
    this.handlers = []
  }
}

/** Singleton instance */
export const contextManager = new ContextManager()
