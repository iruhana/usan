/**
 * Admin elevation via Task Scheduler — runs app as admin without UAC prompt.
 *
 * How it works:
 * 1. NSIS installer (already elevated) creates a scheduled task "Usan"
 *    with HIGHEST run level and ONLOGON trigger.
 * 2. On app start, if not elevated, we re-launch via `schtasks /run /tn "Usan"`
 *    which starts the process as admin with no UAC prompt.
 * 3. The ONLOGON trigger doubles as auto-start-on-boot.
 */

import { app } from 'electron'
import { execFileSync } from 'child_process'

const TASK_NAME = 'Usan'

/** Check if the current process has administrator privileges */
export function isElevated(): boolean {
  try {
    // `net session` succeeds only when running as admin
    execFileSync('net', ['session'], { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

/** Check if the "Usan" scheduled task exists */
export function isTaskInstalled(): boolean {
  try {
    execFileSync('schtasks', ['/query', '/tn', TASK_NAME], { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

/**
 * If not already elevated and the task exists, re-launch via Task Scheduler.
 * Returns true if the app should quit (re-launching), false to continue normally.
 */
export function ensureElevated(): boolean {
  // Already admin or in development — skip
  if (!app.isPackaged || isElevated()) return false

  // Task not installed (e.g. portable/dev build) — run without elevation
  if (!isTaskInstalled()) return false

  try {
    execFileSync('schtasks', ['/run', '/tn', TASK_NAME], { stdio: 'ignore', timeout: 5000 })
    app.quit()
    return true
  } catch {
    // Failed to run task — continue without elevation
    return false
  }
}

/**
 * Enable or disable the auto-start (ONLOGON) scheduled task.
 * Only works when the task already exists (installed via NSIS).
 */
export function setAutoStart(enabled: boolean): boolean {
  if (!isTaskInstalled()) return false

  try {
    const flag = enabled ? '/enable' : '/disable'
    execFileSync('schtasks', ['/change', '/tn', TASK_NAME, flag], { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}
