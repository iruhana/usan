import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../../src/shared/types/ipc'
import { setLocale } from '../../src/renderer/src/i18n'
import { deriveArtifactsFromMessages } from '../../src/renderer/src/components/artifact'

describe('artifact-state', () => {
  it('derives markdown, code, image, json, and draft artifacts', () => {
    setLocale('en')

    const messages: ChatMessage[] = [
      {
        id: 'assistant-markdown',
        role: 'assistant',
        content: '# Weekly summary\n\n- One\n- Two',
        timestamp: 1000,
      },
      {
        id: 'assistant-code',
        role: 'assistant',
        content: '```ts\nconsole.log(\"hello\")\n```',
        timestamp: 1100,
      },
      {
        id: 'tool-result',
        role: 'tool',
        content: 'Screenshot ready',
        timestamp: 1200,
        toolResults: [
          {
            id: 'tool-image',
            name: 'screenshot',
            duration: 12,
            result: { image: 'abc123' },
          },
          {
            id: 'tool-json',
            name: 'fs_read',
            duration: 18,
            result: { path: 'C:\\temp\\note.md', size: 44 },
          },
        ],
      },
    ]

    const artifacts = deriveArtifactsFromMessages(messages, {
      streamingText: 'Drafting the final answer',
      activeToolName: 'Web search',
    })

    expect(artifacts[0]?.source).toBe('draft')
    expect(artifacts[0]?.kind).toBe('text')
    expect(artifacts.some((artifact) => artifact.kind === 'markdown')).toBe(true)
    expect(artifacts.some((artifact) => artifact.kind === 'image')).toBe(true)
    expect(artifacts.some((artifact) => artifact.kind === 'json')).toBe(true)
    expect(artifacts.some((artifact) => artifact.kind === 'code')).toBe(true)
  })
})
