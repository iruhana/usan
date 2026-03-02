/**
 * Startup program manager — list and toggle auto-start programs.
 *
 * Sources:
 * 1. HKCU\Software\Microsoft\Windows\CurrentVersion\Run (user registry)
 * 2. HKLM\Software\Microsoft\Windows\CurrentVersion\Run (system, read-only)
 * 3. shell:startup folder
 * 4. Scheduled Tasks (ONLOGON)
 *
 * Toggling only supported for HKCU (user registry) and shell:startup folder.
 * System-critical programs are protected from modification.
 */

import { execFile } from 'child_process'
import { readdir, rename } from 'fs/promises'
import { join } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const PROTECTED_PROGRAMS = new Set([
  'SecurityHealth',
  'Windows Defender',
  'WindowsDefender',
  'WinDefend',
  'MpCmdRun',
  'OneDrive',
])

export type StartupSource = 'hkcu' | 'hklm' | 'startup-folder' | 'task-scheduler'

export interface StartupProgram {
  name: string
  command: string
  source: StartupSource
  enabled: boolean
  protected: boolean
}

async function queryRegistry(key: string): Promise<Array<{ name: string; value: string }>> {
  try {
    const { stdout } = await execFileAsync('reg', ['query', key], {
      timeout: 10000,
      windowsHide: true,
    })
    const results: Array<{ name: string; value: string }> = []
    for (const line of stdout.split('\n')) {
      const match = line.trim().match(/^(\S+)\s+REG_(?:SZ|EXPAND_SZ)\s+(.+)$/)
      if (match) {
        results.push({ name: match[1], value: match[2].trim() })
      }
    }
    return results
  } catch {
    return []
  }
}

async function getStartupFolder(): Promise<string> {
  const appData = process.env.APPDATA
  if (!appData) return ''
  return join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
}

async function listStartupFolderItems(): Promise<StartupProgram[]> {
  const folder = await getStartupFolder()
  if (!folder) return []
  try {
    const entries = await readdir(folder)
    return entries
      .filter((e) => e.endsWith('.lnk') || e.endsWith('.lnk.disabled'))
      .map((e) => {
        const isDisabled = e.endsWith('.disabled')
        const name = isDisabled ? e.replace('.lnk.disabled', '') : e.replace('.lnk', '')
        return {
          name,
          command: join(folder, e),
          source: 'startup-folder' as StartupSource,
          enabled: !isDisabled,
          protected: PROTECTED_PROGRAMS.has(name),
        }
      })
  } catch {
    return []
  }
}

export async function listStartupPrograms(): Promise<StartupProgram[]> {
  const programs: StartupProgram[] = []

  // 1. HKCU Run
  const hkcuItems = await queryRegistry('HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run')
  for (const item of hkcuItems) {
    programs.push({
      name: item.name,
      command: item.value,
      source: 'hkcu',
      enabled: true,
      protected: PROTECTED_PROGRAMS.has(item.name),
    })
  }

  // 2. HKLM Run (read-only)
  const hklmItems = await queryRegistry('HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run')
  for (const item of hklmItems) {
    programs.push({
      name: item.name,
      command: item.value,
      source: 'hklm',
      enabled: true,
      protected: true, // System-level, always protected
    })
  }

  // 3. Startup folder
  const folderItems = await listStartupFolderItems()
  programs.push(...folderItems)

  return programs
}

export async function toggleStartupProgram(
  name: string,
  source: StartupSource,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  // Validate name to prevent path traversal and injection
  if (!name || /[/\\]|\.\./.test(name)) {
    return { success: false, error: '잘못된 프로그램 이름입니다' }
  }

  // Check protection
  if (PROTECTED_PROGRAMS.has(name)) {
    return { success: false, error: '시스템 보호 프로그램은 변경할 수 없습니다' }
  }

  if (source === 'hklm') {
    return { success: false, error: '시스템 레벨 시작 프로그램은 변경할 수 없습니다' }
  }

  if (source === 'hkcu') {
    try {
      if (enabled) {
        // Re-enable: we would need the original value, which we don't store
        return { success: false, error: '레지스트리 항목 재활성화는 아직 지원되지 않습니다' }
      }
      // Disable: delete the registry entry
      await execFileAsync('reg', ['delete', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', name, '/f'], {
        timeout: 10000,
        windowsHide: true,
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  if (source === 'startup-folder') {
    const folder = await getStartupFolder()
    if (!folder) return { success: false, error: '시작 폴더를 찾을 수 없습니다' }

    try {
      if (enabled) {
        // Enable: rename .lnk.disabled → .lnk
        await rename(join(folder, `${name}.lnk.disabled`), join(folder, `${name}.lnk`))
      } else {
        // Disable: rename .lnk → .lnk.disabled
        await rename(join(folder, `${name}.lnk`), join(folder, `${name}.lnk.disabled`))
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  return { success: false, error: '지원되지 않는 소스입니다' }
}
