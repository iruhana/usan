/**
 * Hotkey Manager — central global shortcut management.
 * Wraps Electron globalShortcut API with conflict detection and persistent user bindings.
 */
import { globalShortcut } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type { HotkeyBinding } from '@shared/types/infrastructure'
import { eventBus } from './event-bus'

const BINDINGS_FILE = 'hotkey-bindings.json'

export class HotkeyManager {
  private bindings: Map<string, HotkeyBinding> = new Map()
  private registered: Set<string> = new Set()

  register(binding: HotkeyBinding): boolean {
    // Check for accelerator conflict
    for (const [id, existing] of this.bindings) {
      if (id !== binding.id && existing.accelerator === binding.accelerator && existing.enabled) {
        return false // Conflict
      }
    }

    // Unregister old if re-registering
    const old = this.bindings.get(binding.id)
    if (old && this.registered.has(old.accelerator)) {
      try { globalShortcut.unregister(old.accelerator) } catch { /* ignore */ }
      this.registered.delete(old.accelerator)
    }

    this.bindings.set(binding.id, binding)

    if (binding.enabled) {
      try {
        const success = globalShortcut.register(binding.accelerator, () => {
          eventBus.emit('hotkey.triggered', { id: binding.id, action: binding.action }, 'hotkey-manager')
        })
        if (success) {
          this.registered.add(binding.accelerator)
        }
        return success
      } catch {
        return false
      }
    }

    return true
  }

  unregister(id: string): void {
    const binding = this.bindings.get(id)
    if (!binding) return

    if (this.registered.has(binding.accelerator)) {
      try { globalShortcut.unregister(binding.accelerator) } catch { /* ignore */ }
      this.registered.delete(binding.accelerator)
    }
    this.bindings.delete(id)
  }

  updateAccelerator(id: string, accelerator: string): boolean {
    const binding = this.bindings.get(id)
    if (!binding) return false

    // Check conflict with new accelerator
    for (const [otherId, existing] of this.bindings) {
      if (otherId !== id && existing.accelerator === accelerator && existing.enabled) {
        return false // Conflict
      }
    }

    return this.register({ ...binding, accelerator })
  }

  getAll(): HotkeyBinding[] {
    return Array.from(this.bindings.values())
  }

  hasConflict(accelerator: string, excludeId?: string): boolean {
    for (const [id, binding] of this.bindings) {
      if (id !== excludeId && binding.accelerator === accelerator && binding.enabled) {
        return true
      }
    }
    return false
  }

  private getBindingsPath(): string {
    return join(app.getPath('userData'), BINDINGS_FILE)
  }

  async loadUserBindings(): Promise<void> {
    try {
      const data = await readFile(this.getBindingsPath(), 'utf-8')
      const saved = JSON.parse(data) as HotkeyBinding[]
      for (const binding of saved) {
        this.register(binding)
      }
    } catch {
      // No saved bindings or corrupt file — start fresh
    }
  }

  async saveUserBindings(): Promise<void> {
    const bindings = this.getAll()
    const dir = app.getPath('userData')
    await mkdir(dir, { recursive: true })
    await writeFile(this.getBindingsPath(), JSON.stringify(bindings, null, 2), 'utf-8')
  }

  destroy(): void {
    for (const accelerator of this.registered) {
      try { globalShortcut.unregister(accelerator) } catch { /* ignore */ }
    }
    this.registered.clear()
    this.bindings.clear()
  }
}

/** Singleton instance */
export const hotkeyManager = new HotkeyManager()
