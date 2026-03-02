/**
 * Computer Control — mouse, keyboard, window management via PowerShell
 * No native modules needed — uses Windows API through PowerShell
 */

import { runPS, escapePS } from './powershell'

// ─── Mouse ─────────────────────────────────────────

function validateCoord(v: number, name: string): void {
  if (!Number.isFinite(v) || v < 0 || v > 65535) throw new Error(`Invalid coordinate ${name}: ${v}`)
}

export async function mouseClick(x: number, y: number, button: 'left' | 'right' = 'left'): Promise<void> {
  validateCoord(x, 'x')
  validateCoord(y, 'y')
  const flag = button === 'right' ? '0x0008' : '0x0002'
  const flagUp = button === 'right' ? '0x0010' : '0x0004'
  await runPS(`
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Mouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, int dwExtraInfo);
}
'@
[Mouse]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 50
[Mouse]::mouse_event(${flag}, 0, 0, 0, 0)
[Mouse]::mouse_event(${flagUp}, 0, 0, 0, 0)
`)
}

export async function mouseDoubleClick(x: number, y: number): Promise<void> {
  validateCoord(x, 'x')
  validateCoord(y, 'y')
  await runPS(`
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Mouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, int dwExtraInfo);
}
'@
[Mouse]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 50
[Mouse]::mouse_event(0x0002, 0, 0, 0, 0)
[Mouse]::mouse_event(0x0004, 0, 0, 0, 0)
Start-Sleep -Milliseconds 50
[Mouse]::mouse_event(0x0002, 0, 0, 0, 0)
[Mouse]::mouse_event(0x0004, 0, 0, 0, 0)
`)
}

// ─── Keyboard ──────────────────────────────────────

/** Escape SendKeys special characters for literal text input */
function escapeSendKeys(text: string): string {
  return text.replace(/[+^%~{}[\]()]/g, (ch) => `{${ch}}`)
}

export async function keyboardType(text: string): Promise<void> {
  if (text.length > 2000) throw new Error('Text too long for keyboard input (max 2000 chars)')
  const sendKeysText = escapeSendKeys(text)
  const escaped = escapePS(sendKeysText)
  await runPS(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${escaped}')
`)
}

export async function keyboardHotkey(keys: string[]): Promise<void> {
  // keys like ['ctrl', 'c'] → PowerShell SendKeys format
  const mapped = keys.map(mapKey)
  const combo = mapped.join('')
  await runPS(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${escapePS(combo)}')
`)
}

function mapKey(key: string): string {
  const map: Record<string, string> = {
    ctrl: '^',
    alt: '%',
    shift: '+',
    enter: '{ENTER}',
    tab: '{TAB}',
    escape: '{ESC}',
    esc: '{ESC}',
    backspace: '{BACKSPACE}',
    delete: '{DELETE}',
    del: '{DELETE}',
    home: '{HOME}',
    end: '{END}',
    up: '{UP}',
    down: '{DOWN}',
    left: '{LEFT}',
    right: '{RIGHT}',
    pageup: '{PGUP}',
    pagedown: '{PGDN}',
    space: ' ',
    f1: '{F1}', f2: '{F2}', f3: '{F3}', f4: '{F4}',
    f5: '{F5}', f6: '{F6}', f7: '{F7}', f8: '{F8}',
    f9: '{F9}', f10: '{F10}', f11: '{F11}', f12: '{F12}',
  }
  return map[key.toLowerCase()] ?? key
}

// ─── Window Management ─────────────────────────────

export interface WindowInfo {
  title: string
  processName: string
  id: number
}

export async function listWindows(): Promise<WindowInfo[]> {
  const raw = await runPS(`
Get-Process | Where-Object { $_.MainWindowTitle -ne '' } |
  Select-Object Id, ProcessName, MainWindowTitle |
  ConvertTo-Json -Compress
`)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    return arr.map((w: { Id: number; ProcessName: string; MainWindowTitle: string }) => ({
      id: w.Id,
      processName: w.ProcessName,
      title: w.MainWindowTitle,
    }))
  } catch {
    return []
  }
}

export async function focusWindow(titleOrProcess: string): Promise<boolean> {
  if (titleOrProcess.length > 500) throw new Error('Window search string too long')
  // Escape wildcards used by -like operator to prevent unintended matches
  const safeValue = titleOrProcess.replace(/[[\]*?]/g, '`$&')
  const escaped = escapePS(safeValue)
  const result = await runPS(`
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
'@
$proc = Get-Process | Where-Object {
  $_.MainWindowTitle -like '*${escaped}*' -or $_.ProcessName -like '*${escaped}*'
} | Select-Object -First 1
if ($proc -and $proc.MainWindowHandle -ne 0) {
  [Win]::ShowWindow($proc.MainWindowHandle, 9)
  [Win]::SetForegroundWindow($proc.MainWindowHandle)
  Write-Output 'OK'
} else {
  Write-Output 'NOT_FOUND'
}
`)
  return result === 'OK'
}
