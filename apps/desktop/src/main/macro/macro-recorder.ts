/**
 * Macro Recorder — records mouse/keyboard events and converts to workflow steps.
 * Uses uiohook-napi for global input capture (cross-platform).
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import type { WorkflowStep } from '@shared/types/infrastructure'
import { eventBus } from '../infrastructure/event-bus'

const execFileAsync = promisify(execFile)

/** Map uiohook keycode → SendKeys-compatible key name */
function keycodeToName(keycode: number): string {
  const map: Record<number, string> = {
    [UiohookKey.Enter]: '{ENTER}',
    [UiohookKey.Escape]: '{ESC}',
    [UiohookKey.Backspace]: '{BS}',
    [UiohookKey.Tab]: '{TAB}',
    [UiohookKey.Space]: ' ',
    [UiohookKey.Delete]: '{DEL}',
    [UiohookKey.ArrowUp]: '{UP}',
    [UiohookKey.ArrowDown]: '{DOWN}',
    [UiohookKey.ArrowLeft]: '{LEFT}',
    [UiohookKey.ArrowRight]: '{RIGHT}',
  }
  return map[keycode] || String.fromCharCode(keycode)
}

export interface MacroEvent {
  type: 'mouse_click' | 'keyboard_type' | 'keyboard_hotkey' | 'delay'
  timestamp: number
  x?: number
  y?: number
  button?: string
  key?: string
  keys?: string
  text?: string
  delayMs?: number
}

export interface StoredMacro {
  id: string
  name: string
  events: MacroEvent[]
  createdAt: number
}

const MACROS_FILE = 'macros.json'

export class MacroRecorder {
  private recording = false
  private hookStarted = false
  private events: MacroEvent[] = []
  private lastTimestamp = 0
  private macros: Map<string, StoredMacro> = new Map()

  // Bound listeners so we can remove them later
  private onMouseClick = (e: { x: number; y: number; button: number }) => {
    this.addEvent({
      type: 'mouse_click',
      x: e.x,
      y: e.y,
      button: e.button === 1 ? 'left' : e.button === 2 ? 'right' : 'middle',
    })
  }

  private onKeyDown = (e: { keycode: number }) => {
    this.addEvent({
      type: 'keyboard_type',
      text: keycodeToName(e.keycode),
      key: keycodeToName(e.keycode),
    })
  }

  isRecording(): boolean {
    return this.recording
  }

  startRecording(): void {
    if (this.recording) return
    this.recording = true
    this.events = []
    this.lastTimestamp = Date.now()

    // Register global input hooks
    uIOhook.on('click', this.onMouseClick)
    uIOhook.on('keydown', this.onKeyDown)
    if (!this.hookStarted) {
      uIOhook.start()
      this.hookStarted = true
    }

    eventBus.emit('macro.recording', { recording: true }, 'macro-recorder')
  }

  addEvent(event: Omit<MacroEvent, 'timestamp'>): void {
    if (!this.recording) return
    const now = Date.now()
    const delay = now - this.lastTimestamp

    // Add delay event if significant gap
    if (delay > 200 && this.events.length > 0) {
      this.events.push({ type: 'delay', timestamp: now, delayMs: delay })
    }

    this.events.push({ ...event, timestamp: now })
    this.lastTimestamp = now
  }

  private stopHookListeners(): void {
    uIOhook.off('click', this.onMouseClick)
    uIOhook.off('keydown', this.onKeyDown)
  }

  stopRecording(name: string): StoredMacro {
    this.recording = false
    this.stopHookListeners()
    const macro: StoredMacro = {
      id: crypto.randomUUID(),
      name,
      events: this.events,
      createdAt: Date.now(),
    }
    this.macros.set(macro.id, macro)
    this.saveMacros()
    eventBus.emit('macro.recording', { recording: false }, 'macro-recorder')
    return macro
  }

  cancelRecording(): void {
    this.recording = false
    this.stopHookListeners()
    this.events = []
    eventBus.emit('macro.recording', { recording: false }, 'macro-recorder')
  }

  async play(id: string): Promise<void> {
    const macro = this.macros.get(id)
    if (!macro) throw new Error('매크로를 찾을 수 없습니다')

    for (const event of macro.events) {
      switch (event.type) {
        case 'delay':
          await new Promise((r) => setTimeout(r, event.delayMs || 100))
          break
        case 'mouse_click':
          await this.executeMouseClick(event.x || 0, event.y || 0, event.button || 'left')
          break
        case 'keyboard_type':
          await this.executeKeyType(event.text || '')
          break
        case 'keyboard_hotkey':
          await this.executeHotkey(event.keys || '')
          break
      }
    }
  }

  list(): StoredMacro[] {
    return Array.from(this.macros.values())
  }

  delete(id: string): boolean {
    const deleted = this.macros.delete(id)
    if (deleted) this.saveMacros()
    return deleted
  }

  toWorkflowSteps(id: string): WorkflowStep[] {
    const macro = this.macros.get(id)
    if (!macro) return []
    return macro.events.map((e, i) => {
      if (e.type === 'delay') {
        return { id: `step_${i}`, type: 'delay' as const, delayMs: e.delayMs }
      }
      return {
        id: `step_${i}`,
        type: 'tool_call' as const,
        toolName: e.type,
        toolArgs: { x: e.x, y: e.y, text: e.text, keys: e.keys },
      }
    })
  }

  /** Escape SendKeys metacharacters for literal text input */
  private escapeSendKeys(text: string): string {
    return text.replace(/([+^%~{}[\]()])/g, '{$1}')
  }

  /** Escape single quotes + strip control chars for PowerShell */
  private psEscape(str: string): string {
    return str.replace(/[\x00-\x1f\x7f]/g, '').replace(/'/g, "''")
  }

  private async executeMouseClick(x: number, y: number, _button: string): Promise<void> {
    const safeX = Math.round(Number(x)) || 0
    const safeY = Math.round(Number(y)) || 0
    const script = `
Add-Type @"
using System;using System.Runtime.InteropServices;
public class MC{
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X,int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,int dx,int dy,uint d,int e);
  public static void Click(int x,int y){SetCursorPos(x,y);mouse_event(2,0,0,0,0);mouse_event(4,0,0,0,0);}
}
"@
[MC]::Click(${safeX},${safeY})`
    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 5000, windowsHide: true }).catch(() => {})
  }

  private async executeKeyType(text: string): Promise<void> {
    const safe = this.psEscape(this.escapeSendKeys(text))
    const script = `Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('${safe}')`
    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 5000, windowsHide: true }).catch(() => {})
  }

  private async executeHotkey(keys: string): Promise<void> {
    const script = `Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('${this.psEscape(keys)}')`
    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 5000, windowsHide: true }).catch(() => {})
  }

  private getDataPath(): string {
    return join(app.getPath('userData'), MACROS_FILE)
  }

  async loadFromDisk(): Promise<void> {
    try {
      const data = await readFile(this.getDataPath(), 'utf-8')
      const macros = JSON.parse(data) as StoredMacro[]
      for (const m of macros) this.macros.set(m.id, m)
    } catch { /* fresh start */ }
  }

  private async saveMacros(): Promise<void> {
    try {
      await writeFile(this.getDataPath(), JSON.stringify(this.list(), null, 2), 'utf-8')
    } catch { /* silently fail */ }
  }

  async saveToDisk(): Promise<void> {
    await this.saveMacros()
  }

  destroy(): void {
    this.cancelRecording()
    if (this.hookStarted) {
      uIOhook.stop()
      this.hookStarted = false
    }
    this.macros.clear()
  }
}

export const macroRecorder = new MacroRecorder()
