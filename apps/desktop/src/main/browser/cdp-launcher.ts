/**
 * CDP Launcher — find or launch Chrome/Edge with remote debugging enabled
 * Connects to user's existing browser rather than running headless
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { runPS } from '../computer/powershell'

const CDP_PORT = 9222

/** Known Chrome/Edge paths on Windows */
const BROWSER_PATHS = [
  // Edge (pre-installed on Windows 10/11)
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  // Chrome
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ...(process.env.LOCALAPPDATA
    ? [`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`]
    : []),
]

/** Find first available browser executable */
function findBrowserPath(): string | null {
  for (const p of BROWSER_PATHS) {
    if (existsSync(p)) return p
  }
  return null
}

/** Check if CDP is already available on the port */
export async function isCdpAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Get CDP WebSocket URL from running instance */
export async function getCdpEndpoint(): Promise<string | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(2000),
    })
    const data = (await res.json()) as { webSocketDebuggerUrl?: string }
    return data.webSocketDebuggerUrl ?? null
  } catch {
    return null
  }
}

/** Launch browser with CDP enabled (if not already running with CDP) */
export async function ensureCdpBrowser(): Promise<string | null> {
  // 1. Check if CDP is already running
  const existing = await getCdpEndpoint()
  if (existing) return existing

  // 2. Check if a browser is running WITHOUT CDP → need user to restart
  const browserRunning = await runPS(
    "Get-Process -Name chrome,msedge -ErrorAction SilentlyContinue | Select-Object -First 1 | ConvertTo-Json -Compress"
  )

  if (browserRunning) {
    // Browser is running but not with CDP — can't inject CDP into existing process
    // We'll try to launch a new instance with a separate user data dir
  }

  // 3. Find and launch browser with CDP
  const browserPath = findBrowserPath()
  if (!browserPath) return null

  // Use isolated profile to avoid exposing user's cookies/passwords to AI automation
  const isolatedProfile = join(app.getPath('userData'), 'browser-profile')
  const child = spawn(browserPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--remote-debugging-address=127.0.0.1',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${isolatedProfile}`,
  ], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  // Wait for CDP to become available
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500))
    const endpoint = await getCdpEndpoint()
    if (endpoint) return endpoint
  }

  return null
}

export { CDP_PORT }
