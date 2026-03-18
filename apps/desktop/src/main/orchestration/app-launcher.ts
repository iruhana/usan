/**
 * App orchestration helpers.
 * Launch uses direct process spawning so argument boundaries stay intact.
 * PowerShell remains for process listing, window activation, and COM automation.
 */
import { execFile, spawn } from 'child_process'
import { win32 as pathWin32 } from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
const SAFE_BARE_COMMANDS = new Set([
  'brave',
  'brave.exe',
  'calc',
  'calc.exe',
  'chrome',
  'chrome.exe',
  'code',
  'code.exe',
  'explorer',
  'explorer.exe',
  'firefox',
  'firefox.exe',
  'msedge',
  'msedge.exe',
  'mspaint',
  'mspaint.exe',
  'notepad',
  'notepad.exe',
  'wt',
  'wt.exe',
])
const BLOCKED_BARE_COMMANDS = new Set(['assistant', 'assistant.exe'])

type QuoteChar = '"' | "'"
export type LaunchArgs = string | string[]

function psEscape(str: string): string {
  return str.replace(/'/g, "''")
}

function validateName(name: string): string {
  if (!/^[a-zA-Z0-9\s._\-\\/:]+$/.test(name)) {
    throw new Error('Invalid name: contains disallowed characters')
  }
  return psEscape(name)
}

export function tokenizeLaunchArgs(args?: LaunchArgs): string[] {
  if (args == null) return []

  if (Array.isArray(args)) {
    return args
      .map((item) => String(item).trim())
      .filter(Boolean)
  }

  const input = args.trim()
  if (!input) return []

  const tokens: string[] = []
  let current = ''
  let quote: QuoteChar | null = null

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]

    if (quote) {
      if (char === '\\' && input[i + 1] === quote) {
        current += quote
        i += 1
        continue
      }
      if (char === quote) {
        quote = null
        continue
      }
      current += char
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (quote) {
    throw new Error('Launch arguments contain an unclosed quote')
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

export function validateLaunchTargetInput(name: string): { normalized: string; needsResolution: boolean } {
  const normalized = name.trim()

  if (!normalized) {
    throw new Error('앱 이름 또는 경로가 필요합니다.')
  }

  if (/[\0\r\n]/.test(normalized)) {
    throw new Error('앱 이름에 사용할 수 없는 문자가 있습니다.')
  }

  const hasPathSeparator = normalized.includes('\\') || normalized.includes('/')
  if (hasPathSeparator) {
    if (!pathWin32.isAbsolute(normalized)) {
      throw new Error('사용자 지정 앱은 전체 경로로 입력해 주세요.')
    }
    return { normalized, needsResolution: false }
  }

  const lower = normalized.toLowerCase()
  if (BLOCKED_BARE_COMMANDS.has(lower)) {
    throw new Error('assistant 같은 일반 명령 이름은 다른 프로그램과 충돌할 수 있습니다. 전체 경로를 입력해 주세요.')
  }

  if (!SAFE_BARE_COMMANDS.has(lower)) {
    throw new Error('기본 앱 이름이 아니면 전체 경로로 입력해 주세요.')
  }

  return { normalized, needsResolution: true }
}

async function runPS(script: string): Promise<string> {
  const { stdout } = await execFileAsync('powershell', [
    '-NoProfile', '-NonInteractive', '-Command', script,
  ], { timeout: 15000, windowsHide: true })
  return stdout.trim()
}

async function resolveLaunchPath(name: string): Promise<string> {
  const { normalized, needsResolution } = validateLaunchTargetInput(name)

  if (!needsResolution) {
    return normalized
  }

  const resolved = await runPS(`
$cmd = Get-Command '${psEscape(normalized)}' -CommandType Application -ErrorAction Stop |
  Select-Object -First 1 -ExpandProperty Source
$cmd`)

  const fullPath = resolved
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!fullPath) {
    throw new Error(`앱을 찾을 수 없습니다: ${normalized}`)
  }

  return fullPath
}

export async function launchApp(name: string, args?: LaunchArgs): Promise<{ pid: number }> {
  const filePath = await resolveLaunchPath(name)
  const argv = tokenizeLaunchArgs(args)

  const pid = await new Promise<number>((resolve, reject) => {
    const child = spawn(filePath, argv, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })

    child.once('error', reject)
    child.once('spawn', () => {
      if (!child.pid) {
        reject(new Error(`앱을 실행하지 못했습니다: ${filePath}`))
        return
      }
      child.unref()
      resolve(child.pid)
    })
  })

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
