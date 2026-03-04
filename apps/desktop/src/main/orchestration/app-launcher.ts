/**
 * App Orchestration — launch, close, and send keystrokes to apps.
 * Uses PowerShell COM bridge for Office automation.
 */
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** Escape single quotes for PowerShell single-quoted strings */
function psEscape(str: string): string {
  return str.replace(/'/g, "''")
}

/** Validate identifier-like strings (process names, app names) */
function validateName(name: string): string {
  // Allow alphanumeric, spaces, dots, hyphens, underscores, backslashes, colons, forward slashes
  if (!/^[a-zA-Z0-9\s._\-\\/:]+$/.test(name)) {
    throw new Error(`Invalid name: contains disallowed characters`)
  }
  return psEscape(name)
}

async function runPS(script: string): Promise<string> {
  const { stdout } = await execFileAsync('powershell', [
    '-NoProfile', '-NonInteractive', '-Command', script,
  ], { timeout: 15000, windowsHide: true })
  return stdout.trim()
}

export async function launchApp(name: string, args?: string): Promise<{ pid: number }> {
  const safeName = validateName(name)
  const script = args
    ? `$p = Start-Process -FilePath '${safeName}' -ArgumentList '${psEscape(args)}' -PassThru; $p.Id`
    : `$p = Start-Process -FilePath '${safeName}' -PassThru; $p.Id`
  const pid = parseInt(await runPS(script), 10)
  return { pid }
}

export async function closeApp(processName: string): Promise<{ closed: number }> {
  const safeName = validateName(processName)
  const script = `
$procs = Get-Process -Name '${safeName}' -ErrorAction SilentlyContinue
$count = ($procs | Measure-Object).Count
$procs | ForEach-Object { $_.CloseMainWindow() | Out-Null }
$count`
  const count = parseInt(await runPS(script), 10) || 0
  return { closed: count }
}

export async function sendKeys(processName: string, keys: string): Promise<void> {
  const normalizedProcess = processName.trim()
  const safeKeys = psEscape(keys)
  const script = normalizedProcess
    ? `
Add-Type -AssemblyName System.Windows.Forms
$p = Get-Process -Name '${validateName(normalizedProcess)}' -ErrorAction Stop | Select-Object -First 1
$wshell = New-Object -ComObject WScript.Shell
$wshell.AppActivate($p.Id) | Out-Null
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('${safeKeys}')`
    : `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${safeKeys}')`
  await runPS(script)
}

export async function listRunningApps(): Promise<Array<{ name: string; pid: number; title: string }>> {
  const script = `
Get-Process | Where-Object { $_.MainWindowTitle -ne '' } |
  Select-Object -First 30 ProcessName, Id, MainWindowTitle |
  ConvertTo-Json -Compress`
  const raw = await runPS(script)
  if (!raw) return []
  const data = JSON.parse(raw)
  const arr = Array.isArray(data) ? data : [data]
  return arr.map((p: Record<string, unknown>) => ({
    name: p.ProcessName as string,
    pid: p.Id as number,
    title: p.MainWindowTitle as string,
  }))
}

/** Allowed COM classes for safety */
const ALLOWED_COM_CLASSES = new Set([
  'Excel.Application',
  'Word.Application',
  'PowerPoint.Application',
  'Outlook.Application',
  'Shell.Application',
])

export async function comInvoke(comClass: string, method: string, args?: string[]): Promise<string> {
  if (!ALLOWED_COM_CLASSES.has(comClass)) {
    throw new Error(`COM class not allowed: ${comClass}. Allowed: ${[...ALLOWED_COM_CLASSES].join(', ')}`)
  }
  // Validate method is a simple identifier
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(method)) {
    throw new Error('Invalid COM method name')
  }
  const argsStr = args?.map((a) => `'${psEscape(a)}'`).join(', ') || ''
  const script = `
$obj = New-Object -ComObject '${psEscape(comClass)}'
$result = $obj.${method}(${argsStr})
$result | ConvertTo-Json -Compress`
  return runPS(script)
}
