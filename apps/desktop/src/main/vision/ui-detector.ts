import type { OcrResult, UiElement } from '@shared/types/infrastructure'
import { escapePS, runPS } from '../computer/powershell'
import { getActiveWindow } from '../infrastructure/system-monitor'
import { captureScreen, imageToBase64 } from './screen-analyzer'
import { runOcrFromImage } from './ocr-engine'

export interface UiAnalysisResult {
  screenshot: string
  elements: UiElement[]
  ocr: OcrResult
}

interface RawAutomationElement {
  label?: string
  controlType?: string
  x?: number
  y?: number
  width?: number
  height?: number
}

const MAX_AUTOMATION_ELEMENTS = 320

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
  if (lowerType.includes('button') || lowerType.includes('menuitem') || lowerType.includes('tabitem')) return 'button'
  if (lowerType.includes('edit') || lowerType.includes('combobox')) return 'input'
  if (lowerType.includes('hyperlink')) return 'link'
  if (lowerType.includes('image')) return 'image'
  if (lowerType.includes('text') || lowerType.includes('document')) return 'text'
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

function parseAutomationJson(raw: string): RawAutomationElement[] {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '[]') return []
  try {
    const parsed = JSON.parse(trimmed) as RawAutomationElement | RawAutomationElement[]
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') return [parsed]
    return []
  } catch {
    return []
  }
}

async function collectAutomationElements(): Promise<UiElement[]> {
  const activeWindow = await getActiveWindow().catch(() => null)
  const windowTitle = activeWindow?.title?.trim() ?? ''
  const escapedTitle = escapePS(windowTitle.slice(0, 160))

  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$windowTitle = '${escapedTitle}'
$root = [System.Windows.Automation.AutomationElement]::RootElement
$target = $null

if (-not [string]::IsNullOrWhiteSpace($windowTitle)) {
  $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($w in $windows) {
    if ($w.Current.Name -like "*$windowTitle*") {
      $target = $w
      break
    }
  }
}

if (-not $target) {
  $target = [System.Windows.Automation.AutomationElement]::FocusedElement
}

if (-not $target) {
  '[]'
  exit 0
}

$controlTypes = @(
  [System.Windows.Automation.ControlType]::Button,
  [System.Windows.Automation.ControlType]::MenuItem,
  [System.Windows.Automation.ControlType]::Hyperlink,
  [System.Windows.Automation.ControlType]::TabItem,
  [System.Windows.Automation.ControlType]::ListItem,
  [System.Windows.Automation.ControlType]::Edit,
  [System.Windows.Automation.ControlType]::ComboBox,
  [System.Windows.Automation.ControlType]::CheckBox,
  [System.Windows.Automation.ControlType]::Text
)

$items = New-Object System.Collections.ArrayList
foreach ($type in $controlTypes) {
  $condition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    $type
  )
  $elements = $target.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
  foreach ($element in $elements) {
    $rect = $element.Current.BoundingRectangle
    if ($rect.Width -lt 3 -or $rect.Height -lt 3) { continue }

    $name = $element.Current.Name
    if ([string]::IsNullOrWhiteSpace($name)) {
      try {
        $vp = $element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        if ($vp -and $vp.Current.Value) {
          $name = $vp.Current.Value
        }
      } catch { }
    }

    if ([string]::IsNullOrWhiteSpace($name)) { continue }

    $typeName = $element.Current.ControlType.ProgrammaticName -replace '^ControlType\\.', ''
    $obj = [PSCustomObject]@{
      label = $name.Trim()
      controlType = $typeName
      x = [int][Math]::Round($rect.X)
      y = [int][Math]::Round($rect.Y)
      width = [int][Math]::Round($rect.Width)
      height = [int][Math]::Round($rect.Height)
    }
    [void]$items.Add($obj)
  }
}

if ($items.Count -eq 0) {
  '[]'
  exit 0
}

$items | Select-Object -First ${MAX_AUTOMATION_ELEMENTS} | ConvertTo-Json -Depth 4 -Compress
`

  const raw = await runPS(script, 15000).catch(() => '[]')
  const parsed = parseAutomationJson(raw)

  const mapped = parsed
    .map((item) => {
      const label = String(item.label ?? '').trim()
      if (!label) return null

      const width = Math.max(1, Math.floor(Number(item.width) || 0))
      const height = Math.max(1, Math.floor(Number(item.height) || 0))
      if (width < 3 || height < 3) return null

      const x = Math.floor(Number(item.x) || 0)
      const y = Math.floor(Number(item.y) || 0)
      const controlType = String(item.controlType ?? '')

      const element: UiElement = {
        label,
        type: mapAutomationControlType(controlType, label),
        bounds: { x, y, width, height },
        confidence: 0.93,
      }
      return element
    })
    .filter((item): item is UiElement => item !== null)

  return dedupeElements(mapped)
}

export async function analyzeUiFromScreen(): Promise<UiAnalysisResult> {
  const screenshotBuffer = await captureScreen()
  const screenshot = await imageToBase64(screenshotBuffer)

  const [ocr, automationElements] = await Promise.all([
    runOcrFromImage(screenshotBuffer),
    collectAutomationElements(),
  ])

  const elements = dedupeElements([
    ...automationElements,
    ...toUiElements(ocr),
  ])

  return { screenshot, elements, ocr }
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
