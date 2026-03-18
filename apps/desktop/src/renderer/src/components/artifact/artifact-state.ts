import type { ChatMessage } from '@shared/types/ipc'
import type { ToolResult } from '@shared/types/tools'
import { t } from '../../i18n'
import { shouldRenderMarkdown } from '../chat/markdown-heuristics'
import type { ArtifactItem, ArtifactKind, ArtifactTableData } from './types'

interface ArtifactDeriveOptions {
  streamingText?: string
  activeToolName?: string | null
}

interface TextArtifactPayload {
  kind: ArtifactKind
  content?: string
  language?: string
  table?: ArtifactTableData
  copyText?: string
}

const FENCED_CODE_RE = /```([\w-]+)?\n([\s\S]*?)```/m

function trimToSentence(value: string, maxLength = 56): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trimEnd()}...`
}

function extractHeading(content: string): string {
  const heading = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith('# '))

  if (!heading) return ''
  return heading.replace(/^#\s+/, '').trim()
}

function parseMarkdownTable(content: string): ArtifactTableData | null {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) return null
  if (!lines.every((line) => line.startsWith('|') && line.endsWith('|'))) return null

  const separator = lines[1]
  if (!/^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(separator)) {
    return null
  }

  const splitRow = (row: string) =>
    row
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim())

  const headers = splitRow(lines[0])
  const rows = lines.slice(2).map(splitRow)

  if (headers.length === 0) return null

  return {
    headers,
    rows,
  }
}

function deriveTextArtifact(content: string): TextArtifactPayload {
  const normalized = content.trim()
  const table = parseMarkdownTable(normalized)

  if (table) {
    return {
      kind: 'table',
      content: normalized,
      table,
      copyText: normalized,
    }
  }

  const fenced = normalized.match(FENCED_CODE_RE)
  if (fenced && normalized.replace(FENCED_CODE_RE, '').trim().length === 0) {
    return {
      kind: 'code',
      content: fenced[2].trimEnd(),
      language: fenced[1] || undefined,
      copyText: fenced[2].trimEnd(),
    }
  }

  if (shouldRenderMarkdown(normalized)) {
    return {
      kind: 'markdown',
      content: normalized,
      copyText: normalized,
    }
  }

  return {
    kind: 'text',
    content: normalized,
    copyText: normalized,
  }
}

function getAssistantTitle(content: string, index: number): string {
  return (
    extractHeading(content) ||
    trimToSentence(content) ||
    `${t('artifact.fallback.assistant')} ${index + 1}`
  )
}

function getToolLabel(name: string): string {
  const localized = t(`tool.${name}`)
  return localized !== `tool.${name}` ? localized : name
}

function deriveToolArtifact(toolResult: ToolResult, timestamp: number, index: number): ArtifactItem | null {
  if (toolResult.error) {
    return null
  }

  const label = getToolLabel(toolResult.name)

  if (toolResult.result && typeof toolResult.result === 'object') {
    const record = toolResult.result as Record<string, unknown>
    if (typeof record.image === 'string' && record.image.length > 0) {
      return {
        id: `${toolResult.id}-image`,
        title: `${label} ${t('artifact.kind.image')}`,
        kind: 'image',
        source: 'tool',
        createdAt: timestamp,
        image: record.image,
        copyText: undefined,
        sourceLabel: label,
      }
    }

    const jsonContent = JSON.stringify(toolResult.result, null, 2)
    return {
      id: `${toolResult.id}-json`,
      title: `${label} ${t('artifact.kind.json')}`,
      kind: 'json',
      source: 'tool',
      createdAt: timestamp + index,
      content: jsonContent,
      copyText: jsonContent,
      language: 'json',
      sourceLabel: label,
    }
  }

  if (typeof toolResult.result === 'string' && toolResult.result.trim()) {
    const payload = deriveTextArtifact(toolResult.result)
    return {
      id: `${toolResult.id}-text`,
      title: `${label} ${trimToSentence(toolResult.result, 40) || t('artifact.kind.text')}`,
      kind: payload.kind,
      source: 'tool',
      createdAt: timestamp + index,
      content: payload.content,
      copyText: payload.copyText,
      language: payload.language,
      table: payload.table,
      sourceLabel: label,
    }
  }

  return null
}

export function deriveArtifactsFromMessages(
  messages: ChatMessage[],
  options: ArtifactDeriveOptions = {},
): ArtifactItem[] {
  const artifacts: ArtifactItem[] = []

  messages.forEach((message, messageIndex) => {
    if (message.role === 'assistant' && message.content.trim()) {
      const payload = deriveTextArtifact(message.content)

      artifacts.push({
        id: message.id,
        title: getAssistantTitle(message.content, messageIndex),
        kind: payload.kind,
        source: 'assistant',
        createdAt: message.timestamp,
        content: payload.content,
        copyText: payload.copyText,
        language: payload.language,
        table: payload.table,
        sourceLabel: t('artifact.source.assistant'),
      })
    }

    if (message.role === 'tool' && message.toolResults?.length) {
      message.toolResults.forEach((toolResult, toolIndex) => {
        const artifact = deriveToolArtifact(toolResult, message.timestamp, toolIndex)
        if (artifact) {
          artifacts.push(artifact)
        }
      })
    }
  })

  const streamingText = options.streamingText?.trim() ?? ''
  if (streamingText) {
    const payload = deriveTextArtifact(streamingText)
    artifacts.unshift({
      id: 'streaming-draft',
      title: options.activeToolName
        ? `${options.activeToolName} ${t('artifact.draftSuffix')}`
        : t('artifact.draftTitle'),
      kind: payload.kind,
      source: 'draft',
      createdAt: Date.now(),
      content: payload.content,
      copyText: payload.copyText,
      language: payload.language,
      table: payload.table,
      sourceLabel: t('artifact.source.draft'),
    })
  }

  return artifacts.sort((left, right) => right.createdAt - left.createdAt)
}
