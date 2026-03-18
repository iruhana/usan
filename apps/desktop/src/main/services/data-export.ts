/**
 * Data Export Utility — PIPA Data Portability Compliance
 *
 * Korea PIPA (2025-03): Users can request data transfer in machine-readable format.
 * Exports conversations, settings, notes, and memory to a JSON archive.
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'

export interface ExportResult {
  outputPath: string
  conversations: number
  notes: number
  settings: boolean
  memory: boolean
  timestamp: string
}

/**
 * Export all user data to a JSON file in the specified directory.
 * If no directory is specified, exports to the desktop.
 */
export async function exportUserData(
  outputDir?: string,
  options?: {
    conversations?: unknown[]
    notes?: unknown[]
    settings?: Record<string, unknown>
    memory?: { facts: unknown[]; preferences: unknown[] }
  }
): Promise<ExportResult> {
  const dir = outputDir ?? join(app.getPath('desktop'), 'usan-export')
  await mkdir(dir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `usan-data-export-${timestamp}.json`
  const outputPath = join(dir, filename)

  const exportData = {
    exportVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    app: {
      name: 'Usan',
      version: app.getVersion(),
    },
    data: {
      conversations: options?.conversations ?? [],
      notes: options?.notes ?? [],
      settings: options?.settings ?? {},
      memory: options?.memory ?? { facts: [], preferences: [] },
    },
  }

  await writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8')

  return {
    outputPath,
    conversations: (exportData.data.conversations as unknown[]).length,
    notes: (exportData.data.notes as unknown[]).length,
    settings: Object.keys(exportData.data.settings).length > 0,
    memory: exportData.data.memory.facts.length > 0 || exportData.data.memory.preferences.length > 0,
    timestamp: exportData.exportedAt,
  }
}
