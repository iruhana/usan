import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { app } from 'electron'
import type { ClipboardEntry } from '@shared/types/infrastructure'

const FILE_NAME = 'clipboard-history.json'
const MAX_PERSISTED_ITEMS = 500

function getStorePath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

function normalize(entries: ClipboardEntry[]): ClipboardEntry[] {
  return entries
    .filter((entry) => typeof entry.id === 'string' && typeof entry.text === 'string')
    .slice(0, MAX_PERSISTED_ITEMS)
}

export async function loadClipboardHistory(): Promise<ClipboardEntry[]> {
  try {
    const raw = await readFile(getStorePath(), 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return normalize(parsed as ClipboardEntry[])
  } catch {
    return []
  }
}

export async function saveClipboardHistory(entries: ClipboardEntry[]): Promise<void> {
  const target = getStorePath()
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(normalize(entries), null, 2), 'utf-8')
}
