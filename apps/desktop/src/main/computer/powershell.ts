/**
 * PowerShell execution helper — safe wrapper around child_process
 * Used for mouse/keyboard/window control without native modules
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const PS_PATH = 'powershell.exe'
const DEFAULT_TIMEOUT = 10000

/** Execute a PowerShell script and return stdout */
export async function runPS(script: string, timeout = DEFAULT_TIMEOUT): Promise<string> {
  const { stdout } = await execFileAsync(PS_PATH, [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-Command', script,
  ], {
    timeout,
    maxBuffer: 5 * 1024 * 1024,
    windowsHide: true,
  })
  return stdout.trim()
}

/** Escape a string for safe use inside PowerShell single-quoted strings */
export function escapePS(value: string): string {
  // Strip control characters (newlines, tabs, null bytes) that could break out of PS context
  const sanitized = value.replace(/[\x00-\x1f\x7f]/g, '')
  // Escape backticks (PowerShell escape char) then single quotes
  return sanitized.replace(/`/g, '``').replace(/'/g, "''")
}
