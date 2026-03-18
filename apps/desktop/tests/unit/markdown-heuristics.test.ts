import { describe, expect, it } from 'vitest'
import { shouldRenderMarkdown } from '../../src/renderer/src/components/chat/markdown-heuristics'

describe('shouldRenderMarkdown', () => {
  it('returns false for plain text', () => {
    expect(shouldRenderMarkdown('Please open the settings page for me.')).toBe(false)
  })

  it('returns true for fenced code blocks', () => {
    expect(shouldRenderMarkdown('```ts\nconsole.log(1)\n```')).toBe(true)
  })

  it('returns true for headings and lists', () => {
    expect(shouldRenderMarkdown('# Steps\n- Open Settings\n- Try again')).toBe(true)
  })

  it('returns true for inline code and links', () => {
    expect(shouldRenderMarkdown('Open `Settings` and visit [Usan](https://usan.ai).')).toBe(true)
  })

  it('returns false for empty text', () => {
    expect(shouldRenderMarkdown('   ')).toBe(false)
  })
})
