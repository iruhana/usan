import { escapePS, runPS } from '../computer/powershell'
import { logObsInfo, logObsWarn } from '../observability'

export type AutomationFramework = 'qt' | 'browser' | 'electron' | 'cef' | 'webview2' | 'windows' | 'unknown'
export type AutomationProvider = 'qt-bridge' | 'playwright' | 'chrome-devtools' | 'windows-mcp'

export interface ProcessSnapshot {
  pid: number
  processName: string
  title: string
  path?: string
  modules: string[]
}

export interface AppDetectionResult extends ProcessSnapshot {
  framework: AutomationFramework
  provider: AutomationProvider
  evidence: string[]
  qtVersion?: string
}

function hasElectronAsar(path: string | undefined): boolean {
  return typeof path === 'string' && path.toLowerCase().includes('.asar')
}

function hasEmbeddedWebViewPath(path: string | undefined): boolean {
  if (typeof path !== 'string') return false
  const lower = path.toLowerCase()
  return lower.includes('ebwebview') || lower.includes('webview')
}

const BROWSER_PROCESS_NAMES = new Set([
  'brave',
  'brave.exe',
  'chrome',
  'chrome.exe',
  'firefox',
  'firefox.exe',
  'msedge',
  'msedge.exe',
])

const CHROME_DEVTOOLS_PROCESS_NAMES = new Set([
  'electron',
  'electron.exe',
])

const QT_MODULE_PATTERNS = [
  /^qt(?:5|6)?core/i,
  /^qt(?:5|6)?gui/i,
  /^qt(?:5|6)?widgets/i,
  /^qt(?:5|6)?qml/i,
  /^qt(?:5|6)?quick/i,
]

interface RawProcessSnapshot {
  Id?: number
  ProcessName?: string
  MainWindowTitle?: string
  Path?: string
  Modules?: string[]
}

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return 30
  return Math.max(1, Math.min(100, Math.floor(limit as number)))
}

function normalizeModules(modules: string[] | undefined): string[] {
  const unique = new Set<string>()
  for (const entry of modules ?? []) {
    const normalized = String(entry).trim()
    if (!normalized) continue
    unique.add(normalized)
  }
  return [...unique]
}

function matchesQtModule(moduleName: string): boolean {
  return QT_MODULE_PATTERNS.some((pattern) => pattern.test(moduleName))
}

function parseQtVersion(modules: string[]): string | undefined {
  for (const moduleName of modules) {
    const match = /^qt(?:(5|6))(?:core|gui|widgets|qml|quick)/i.exec(moduleName)
    if (match) {
      return `Qt ${match[1]}`
    }
  }
  return undefined
}

function normalizeSnapshot(raw: RawProcessSnapshot): ProcessSnapshot | null {
  if (!Number.isFinite(raw.Id) || !raw.ProcessName) return null
  return {
    pid: Number(raw.Id),
    processName: String(raw.ProcessName),
    title: String(raw.MainWindowTitle ?? ''),
    path: raw.Path ? String(raw.Path) : undefined,
    modules: normalizeModules(raw.Modules),
  }
}

export function classifyProcessSnapshot(snapshot: ProcessSnapshot): AppDetectionResult {
  const lowerName = snapshot.processName.toLowerCase()
  const lowerModules = snapshot.modules.map((entry) => entry.toLowerCase())
  const evidence: string[] = []
  let framework: AutomationFramework = 'windows'
  let provider: AutomationProvider = 'windows-mcp'

  if (lowerModules.some((entry) => matchesQtModule(entry)) || lowerName.startsWith('qml')) {
    framework = 'qt'
    provider = 'qt-bridge'
    evidence.push('qt-module')
  } else if (hasElectronAsar(snapshot.path)) {
    framework = 'electron'
    provider = 'chrome-devtools'
    evidence.push('asar-path')
  } else if (BROWSER_PROCESS_NAMES.has(lowerName)) {
    framework = 'browser'
    provider = 'playwright'
    evidence.push('browser-process')
  } else if (CHROME_DEVTOOLS_PROCESS_NAMES.has(lowerName)) {
    framework = 'electron'
    provider = 'chrome-devtools'
    evidence.push('electron-process')
  } else if (lowerModules.includes('libcef.dll')) {
    framework = 'cef'
    provider = 'chrome-devtools'
    evidence.push('libcef.dll')
  } else if (
    lowerModules.includes('webview2loader.dll') ||
    lowerModules.includes('msedgewebview2.exe') ||
    hasEmbeddedWebViewPath(snapshot.path)
  ) {
    framework = 'webview2'
    provider = 'chrome-devtools'
    evidence.push('webview2')
  } else if (!snapshot.title) {
    framework = 'unknown'
  }

  if (hasElectronAsar(snapshot.path) && !evidence.includes('asar-path')) {
    evidence.push('asar-path')
  }

  return {
    ...snapshot,
    framework,
    provider,
    evidence,
    qtVersion: framework === 'qt' ? parseQtVersion(lowerModules) : undefined,
  }
}

function buildProcessQueryScript(options: { pid?: number; target?: string; limit?: number }): string {
  const limit = clampLimit(options.limit)
  const filters: string[] = []

  if (options.pid != null) {
    filters.push(`$_.Id -eq ${Math.floor(options.pid)}`)
  } else {
    filters.push(`$_.MainWindowTitle -ne ''`)
  }

  if (options.target) {
    const safeTarget = escapePS(options.target)
    filters.push(`($_.ProcessName -like '*${safeTarget}*' -or $_.MainWindowTitle -like '*${safeTarget}*')`)
  }

  const filterExpression = filters.join(' -and ')

  return `
$items = Get-Process -ErrorAction SilentlyContinue | Where-Object { ${filterExpression} } |
  Sort-Object ProcessName |
  Select-Object -First ${limit}

$result = foreach ($p in $items) {
  $modules = @()
  try {
    $modules = $p.Modules | Select-Object -ExpandProperty ModuleName
  } catch {
    $modules = @()
  }

  [PSCustomObject]@{
    Id = $p.Id
    ProcessName = $p.ProcessName
    MainWindowTitle = $p.MainWindowTitle
    Path = $p.Path
    Modules = @($modules | Select-Object -First 128)
  }
}

$result | ConvertTo-Json -Depth 5 -Compress
`
}

async function queryProcessSnapshots(options: { pid?: number; target?: string; limit?: number }): Promise<ProcessSnapshot[]> {
  try {
    const raw = await runPS(buildProcessQueryScript(options), 20000)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RawProcessSnapshot | RawProcessSnapshot[]
    const items = Array.isArray(parsed) ? parsed : [parsed]
    return items
      .map(normalizeSnapshot)
      .filter((entry): entry is ProcessSnapshot => entry !== null)
  } catch (error) {
    logObsWarn('app_detector.query_failed', {
      pid: options.pid ?? null,
      target: options.target ?? null,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

export async function listAutomationTargets(options: { limit?: number } = {}): Promise<AppDetectionResult[]> {
  const snapshots = await queryProcessSnapshots({ limit: options.limit })
  const targets = snapshots.map(classifyProcessSnapshot)
  logObsInfo('app_detector.targets_listed', { count: targets.length })
  return targets
}

export async function detectAutomationTarget(query: { pid?: number; target?: string }): Promise<AppDetectionResult | null> {
  const snapshots = await queryProcessSnapshots({
    pid: query.pid,
    target: query.target,
    limit: query.pid != null ? 5 : 20,
  })

  const candidates = snapshots.map(classifyProcessSnapshot)
  if (candidates.length === 0) return null

  if (query.pid != null) {
    const exact = candidates.find((entry) => entry.pid === query.pid)
    if (exact) return exact
  }

  if (query.target) {
    const lowered = query.target.toLowerCase()
    const exactTitle = candidates.find((entry) => entry.title.toLowerCase() === lowered)
    if (exactTitle) return exactTitle
    const exactProcess = candidates.find((entry) => entry.processName.toLowerCase() === lowered)
    if (exactProcess) return exactProcess
  }

  return candidates[0]
}
