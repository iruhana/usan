import type {
  AccessibilityNode,
  AccessibilityTreeSummary,
  OcrResult,
  Rect,
  UiAnalysisResult,
  UiElement,
} from '@shared/types/infrastructure'
import { escapePS, runPS } from '../computer/powershell'
import { getActiveWindow } from '../infrastructure/system-monitor'
import { captureScreen, imageToBase64 } from './screen-analyzer'
import { runOcrFromImage } from './ocr-engine'

interface RawAccessibilityBounds {
  x?: number
  y?: number
  width?: number
  height?: number
}

interface RawAccessibilityNode {
  id?: string
  label?: string
  role?: string
  automationId?: string
  helpText?: string
  value?: string
  bounds?: RawAccessibilityBounds | null
  isEnabled?: boolean
  isOffscreen?: boolean
  hasKeyboardFocus?: boolean
  children?: RawAccessibilityNode[]
}

interface RawAccessibilitySnapshot {
  scope?: string
  nodeCount?: number
  maxDepth?: number
  truncated?: boolean
  root?: RawAccessibilityNode | null
}

interface AutomationSnapshot {
  elements: UiElement[]
  accessibilityTree: AccessibilityNode | null
  summary: AccessibilityTreeSummary
}

const MAX_AUTOMATION_NODES = 180
const MAX_AUTOMATION_DEPTH = 6
const MAX_AUTOMATION_CHILDREN = 28

const EMPTY_TREE_SUMMARY: AccessibilityTreeSummary = {
  scope: 'unavailable',
  nodeCount: 0,
  maxDepth: 0,
  truncated: false,
  rootLabel: '',
  rootRole: '',
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function inferElementType(label: string): UiElement['type'] {
  const lower = normalizeText(label)
  if (!lower) return 'unknown'

  if (/(button|submit|save|cancel|ok|next|close|apply|confirm)/.test(lower)) return 'button'
  if (/(input|search|email|password|username|field|textbox|edit)/.test(lower)) return 'input'
  if (/(http|www|link|url|href|open|visit)/.test(lower)) return 'link'
  if (/(image|icon|logo|thumbnail|photo|picture)/.test(lower)) return 'image'
  return 'text'
}

function mapAutomationControlType(value: string, label: string): UiElement['type'] {
  const lowerType = normalizeText(value)
  if (
    lowerType.includes('button')
    || lowerType.includes('menuitem')
    || lowerType.includes('tabitem')
    || lowerType.includes('checkbox')
  ) {
    return 'button'
  }
  if (lowerType.includes('edit') || lowerType.includes('combobox') || lowerType.includes('spinner')) return 'input'
  if (lowerType.includes('hyperlink')) return 'link'
  if (lowerType.includes('image')) return 'image'
  if (lowerType.includes('text') || lowerType.includes('document') || lowerType.includes('listitem')) return 'text'
  return inferElementType(label)
}

function overlapRatio(a: UiElement, b: UiElement): number {
  const left = Math.max(a.bounds.x, b.bounds.x)
  const top = Math.max(a.bounds.y, b.bounds.y)
  const right = Math.min(a.bounds.x + a.bounds.width, b.bounds.x + b.bounds.width)
  const bottom = Math.min(a.bounds.y + a.bounds.height, b.bounds.y + b.bounds.height)
  const overlapWidth = Math.max(0, right - left)
  const overlapHeight = Math.max(0, bottom - top)
  const overlapArea = overlapWidth * overlapHeight
  const aArea = Math.max(1, a.bounds.width * a.bounds.height)
  const bArea = Math.max(1, b.bounds.width * b.bounds.height)
  return overlapArea / Math.min(aArea, bArea)
}

function dedupeElements(elements: UiElement[]): UiElement[] {
  const sorted = [...elements].sort((a, b) => b.confidence - a.confidence)
  const kept: UiElement[] = []
  for (const item of sorted) {
    const duplicate = kept.some((existing) => {
      const sameLabel = normalizeText(existing.label) === normalizeText(item.label)
      const highOverlap = overlapRatio(existing, item) >= 0.8
      return sameLabel && highOverlap
    })
    if (!duplicate) kept.push(item)
  }
  return kept
}

function getTypeHints(query: string): Set<UiElement['type']> {
  const hints = new Set<UiElement['type']>()
  const normalized = normalizeText(query)
  if (!normalized) return hints

  if (/(button|click|tap|press|submit|confirm|cancel)/.test(normalized)) hints.add('button')
  if (/(input|field|textbox|type|write|search|email|password)/.test(normalized)) hints.add('input')
  if (/(link|url|open|website|site)/.test(normalized)) hints.add('link')
  if (/(image|icon|logo|picture|photo)/.test(normalized)) hints.add('image')
  if (/(text|label|title|heading)/.test(normalized)) hints.add('text')

  return hints
}

function scoreElement(query: string, element: UiElement): number {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return 0

  const label = normalizeText(element.label)
  let score = 0

  if (!label) {
    score -= 0.2
  } else if (label === normalizedQuery) {
    score += 1.4
  } else {
    if (label.startsWith(normalizedQuery)) score += 1.0
    if (label.includes(normalizedQuery)) score += 0.8
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  if (tokens.length > 0) {
    let matchedTokenCount = 0
    for (const token of tokens) {
      if (label.includes(token)) {
        matchedTokenCount += 1
        score += 0.22
      }
      if (element.type === token) score += 0.35
    }
    if (matchedTokenCount === tokens.length) {
      score += 0.35
    }
  }

  const typeHints = getTypeHints(normalizedQuery)
  if (typeHints.size > 0 && typeHints.has(element.type)) {
    score += 0.45
  }

  return score + Math.max(0, Math.min(element.confidence, 1)) * 0.25
}

function toUiElements(ocr: OcrResult): UiElement[] {
  const ocrConfidence = Math.max(0.1, Math.min(1, (ocr.confidence || 0.4) * 0.85))
  return ocr.regions
    .filter((region) => region?.text && region.bounds.width > 0 && region.bounds.height > 0)
    .map((region) => ({
      label: region.text.trim(),
      type: inferElementType(region.text),
      bounds: region.bounds,
      confidence: ocrConfidence,
    }))
}

function sanitizeBounds(raw?: RawAccessibilityBounds | null): Rect | null {
  if (!raw || typeof raw !== 'object') return null

  const width = Math.max(0, Math.floor(Number(raw.width) || 0))
  const height = Math.max(0, Math.floor(Number(raw.height) || 0))
  if (width < 1 || height < 1) return null

  return {
    x: Math.floor(Number(raw.x) || 0),
    y: Math.floor(Number(raw.y) || 0),
    width,
    height,
  }
}

function hasVisibleBounds(bounds: Rect | null): bounds is Rect {
  return Boolean(bounds && bounds.width >= 3 && bounds.height >= 3)
}

function fallbackLabel(label: string, value: string, automationId: string, role: string): string {
  const nextLabel = label.trim() || value.trim() || automationId.trim()
  if (nextLabel) return nextLabel
  return role.trim() || 'Unknown element'
}

function mapRawNode(raw: RawAccessibilityNode, fallbackId: string): AccessibilityNode {
  const role = String(raw.role ?? 'unknown').trim() || 'unknown'
  const automationId = String(raw.automationId ?? '').trim()
  const value = String(raw.value ?? '').trim()
  const label = fallbackLabel(String(raw.label ?? ''), value, automationId, role)

  return {
    id: String(raw.id ?? fallbackId).trim() || fallbackId,
    label,
    role,
    automationId: automationId || undefined,
    helpText: String(raw.helpText ?? '').trim() || undefined,
    value: value || undefined,
    bounds: sanitizeBounds(raw.bounds),
    isEnabled: raw.isEnabled !== false,
    isOffscreen: raw.isOffscreen === true,
    hasKeyboardFocus: raw.hasKeyboardFocus === true,
    children: Array.isArray(raw.children)
      ? raw.children.map((child, index) => mapRawNode(child, `${fallbackId}.${index}`))
      : [],
  }
}

function normalizeTreeScope(value: string): AccessibilityTreeSummary['scope'] {
  if (value === 'active-window' || value === 'focused-window') return value
  return 'unavailable'
}

function collectTreeElements(node: AccessibilityNode, items: UiElement[], depth = 0): void {
  const genericNode = normalizeText(node.label) === normalizeText(node.role)

  if (
    depth > 0
    && hasVisibleBounds(node.bounds)
    && !node.isOffscreen
    && (!genericNode || node.hasKeyboardFocus)
  ) {
    items.push({
      label: node.label,
      type: mapAutomationControlType(node.role, node.label),
      bounds: node.bounds,
      confidence: node.hasKeyboardFocus ? 0.98 : node.isEnabled ? 0.93 : 0.74,
    })
  }

  for (const child of node.children) {
    collectTreeElements(child, items, depth + 1)
  }
}

function parseAccessibilitySnapshot(raw: string): AutomationSnapshot {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      elements: [],
      accessibilityTree: null,
      summary: EMPTY_TREE_SUMMARY,
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as RawAccessibilitySnapshot
    const accessibilityTree = parsed.root ? mapRawNode(parsed.root, '0') : null
    const summary: AccessibilityTreeSummary = {
      scope: normalizeTreeScope(String(parsed.scope ?? 'unavailable')),
      nodeCount: Math.max(0, Math.floor(Number(parsed.nodeCount) || 0)),
      maxDepth: Math.max(0, Math.floor(Number(parsed.maxDepth) || 0)),
      truncated: parsed.truncated === true,
      rootLabel: accessibilityTree?.label ?? '',
      rootRole: accessibilityTree?.role ?? '',
    }

    const elements = accessibilityTree
      ? (() => {
          const items: UiElement[] = []
          collectTreeElements(accessibilityTree, items)
          return dedupeElements(items)
        })()
      : []

    return {
      elements,
      accessibilityTree,
      summary,
    }
  } catch {
    return {
      elements: [],
      accessibilityTree: null,
      summary: EMPTY_TREE_SUMMARY,
    }
  }
}

async function collectAutomationSnapshot(): Promise<AutomationSnapshot> {
  const activeWindow = await getActiveWindow().catch(() => null)
  const windowTitle = activeWindow?.title?.trim() ?? ''
  const escapedTitle = escapePS(windowTitle.slice(0, 160))

  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$windowTitle = '${escapedTitle}'
$script:maxNodes = ${MAX_AUTOMATION_NODES}
$script:maxDepth = ${MAX_AUTOMATION_DEPTH}
$script:maxChildrenPerNode = ${MAX_AUTOMATION_CHILDREN}
$script:nodeCount = 0
$script:maxObservedDepth = 0
$script:truncated = $false
$root = [System.Windows.Automation.AutomationElement]::RootElement
$controlWalker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$target = $null
$scope = 'unavailable'

function Get-TopLevelWindow($element, $walker) {
  if (-not $element) { return $null }

  $current = $element
  while ($current -ne $null) {
    $parent = $null
    try { $parent = $walker.GetParent($current) } catch { $parent = $null }
    if (-not $parent) { break }
    if ($parent -eq [System.Windows.Automation.AutomationElement]::RootElement) {
      return $current
    }
    $current = $parent
  }

  return $current
}

function Get-SafeText($element) {
  $text = ''
  try { $text = $element.Current.Name } catch { $text = '' }

  if ([string]::IsNullOrWhiteSpace($text)) {
    try {
      $valuePattern = $element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
      if ($valuePattern -and $valuePattern.Current.Value) {
        $text = $valuePattern.Current.Value
      }
    } catch { }
  }

  if ([string]::IsNullOrWhiteSpace($text)) {
    try { $text = $element.Current.AutomationId } catch { $text = '' }
  }

  if ([string]::IsNullOrWhiteSpace($text)) { return '' }
  return $text.Trim()
}

function Get-SafeValue($element) {
  $value = ''
  try {
    $valuePattern = $element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    if ($valuePattern -and $valuePattern.Current.Value) {
      $value = $valuePattern.Current.Value
    }
  } catch { }

  if ([string]::IsNullOrWhiteSpace($value)) { return '' }
  return $value.Trim()
}

function Get-Bounds($element) {
  try {
    $rect = $element.Current.BoundingRectangle
  } catch {
    return $null
  }

  if ($rect.Width -lt 1 -or $rect.Height -lt 1) {
    return $null
  }

  return [PSCustomObject]@{
    x = [int][Math]::Round($rect.X)
    y = [int][Math]::Round($rect.Y)
    width = [int][Math]::Round($rect.Width)
    height = [int][Math]::Round($rect.Height)
  }
}

function New-TreeNode($element, [int]$depth, [string]$nodeId) {
  if (-not $element) { return $null }
  if ($script:nodeCount -ge $script:maxNodes) {
    $script:truncated = $true
    return $null
  }

  $script:nodeCount += 1
  if ($depth -gt $script:maxObservedDepth) {
    $script:maxObservedDepth = $depth
  }

  $role = 'unknown'
  try {
    $programmaticName = $element.Current.ControlType.ProgrammaticName
    if (-not [string]::IsNullOrWhiteSpace($programmaticName)) {
      $role = ($programmaticName -replace '^ControlType\\.', '').Trim()
    }
  } catch { }

  $automationId = ''
  try { $automationId = $element.Current.AutomationId } catch { $automationId = '' }
  $helpText = ''
  try { $helpText = $element.Current.HelpText } catch { $helpText = '' }
  $isEnabled = $true
  try { $isEnabled = [bool]$element.Current.IsEnabled } catch { }
  $isOffscreen = $false
  try { $isOffscreen = [bool]$element.Current.IsOffscreen } catch { }
  $hasKeyboardFocus = $false
  try { $hasKeyboardFocus = [bool]$element.Current.HasKeyboardFocus } catch { }

  $children = New-Object System.Collections.ArrayList
  if ($depth -lt $script:maxDepth -and -not $script:truncated) {
    $child = $null
    try { $child = $script:controlWalker.GetFirstChild($element) } catch { $child = $null }
    $childIndex = 0
    while ($child -ne $null) {
      if ($childIndex -ge $script:maxChildrenPerNode) {
        $script:truncated = $true
        break
      }

      $childNode = New-TreeNode $child ($depth + 1) "$nodeId.$childIndex"
      if ($childNode -ne $null) {
        [void]$children.Add($childNode)
      }

      if ($script:truncated) { break }

      try { $child = $script:controlWalker.GetNextSibling($child) } catch { $child = $null }
      $childIndex += 1
    }
  } else {
    try {
      $probeChild = $script:controlWalker.GetFirstChild($element)
      if ($probeChild -ne $null) {
        $script:truncated = $true
      }
    } catch { }
  }

  return [PSCustomObject][ordered]@{
    id = $nodeId
    label = Get-SafeText $element
    role = $role
    automationId = $automationId
    helpText = $helpText
    value = Get-SafeValue $element
    bounds = Get-Bounds $element
    isEnabled = $isEnabled
    isOffscreen = $isOffscreen
    hasKeyboardFocus = $hasKeyboardFocus
    children = @($children)
  }
}

if (-not [string]::IsNullOrWhiteSpace($windowTitle)) {
  $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($window in $windows) {
    try {
      if ($window.Current.Name -like "*$windowTitle*") {
        $target = $window
        $scope = 'active-window'
        break
      }
    } catch { }
  }
}

if (-not $target) {
  $focused = $null
  try { $focused = [System.Windows.Automation.AutomationElement]::FocusedElement } catch { $focused = $null }
  if ($focused) {
    $target = Get-TopLevelWindow $focused $controlWalker
    if ($target) {
      $scope = 'focused-window'
    }
  }
}

if (-not $target) {
  [PSCustomObject]@{
    scope = 'unavailable'
    nodeCount = 0
    maxDepth = 0
    truncated = $false
    root = $null
  } | ConvertTo-Json -Depth 20 -Compress
  exit 0
}

$tree = New-TreeNode $target 0 '0'

[PSCustomObject][ordered]@{
  scope = $scope
  nodeCount = $script:nodeCount
  maxDepth = $script:maxObservedDepth
  truncated = [bool]$script:truncated
  root = $tree
} | ConvertTo-Json -Depth 20 -Compress
`

  const raw = await runPS(script, 15000).catch(() => '')
  return parseAccessibilitySnapshot(raw)
}

export async function analyzeUiFromScreen(): Promise<UiAnalysisResult> {
  const screenshotBuffer = await captureScreen()
  const screenshot = await imageToBase64(screenshotBuffer)

  const [ocr, automation] = await Promise.all([
    runOcrFromImage(screenshotBuffer),
    collectAutomationSnapshot(),
  ])

  const elements = dedupeElements([
    ...automation.elements,
    ...toUiElements(ocr),
  ])

  return {
    screenshot,
    elements,
    ocr,
    accessibilityTree: automation.accessibilityTree,
    summary: automation.summary,
  }
}

export async function findUiElement(query: string): Promise<UiElement | null> {
  const normalized = query.trim()
  if (!normalized) return null

  const { elements } = await analyzeUiFromScreen()
  if (elements.length === 0) return null

  const ranked = elements
    .map((element) => ({ element, score: scoreElement(normalized, element) }))
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  if (!best || best.score < 0.6) return null
  return best.element
}
