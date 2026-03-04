import type { StoredMacro } from './macro-recorder'
import { macroRecorder } from './macro-recorder'

export async function loadMacros(): Promise<StoredMacro[]> {
  await macroRecorder.loadFromDisk()
  return macroRecorder.list()
}

export function listMacros(): StoredMacro[] {
  return macroRecorder.list()
}

export async function deleteMacro(id: string): Promise<boolean> {
  if (!id.trim()) return false
  const deleted = macroRecorder.delete(id.trim())
  if (deleted) {
    await macroRecorder.saveToDisk()
  }
  return deleted
}
