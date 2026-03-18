import { describe, expect, it } from 'vitest'

import { buildComposerPrompt } from '../../src/renderer/src/components/composer'
import { setLocale } from '../../src/renderer/src/i18n'

describe('buildComposerPrompt', () => {
  it('combines text, mode guidance, and attachment context into a single prompt', () => {
    setLocale('en')

    const result = buildComposerPrompt({
      text: 'Review this draft',
      mode: 'documents',
      attachments: [
        {
          id: 'selection-1',
          kind: 'selection',
          label: 'Selected text',
          value: 'Paragraph one\nParagraph two',
        },
        {
          id: 'file-1',
          kind: 'file',
          label: 'brief.txt',
          value: 'C:\\Users\\admin\\Desktop\\brief.txt',
        },
      ],
    })

    expect(result).toContain('Review this draft')
    expect(result).toContain('Focus on drafting, editing, and document-style output.')
    expect(result).toContain('Attached context')
    expect(result).toContain('File path: C:\\Users\\admin\\Desktop\\brief.txt')
    expect(result).toContain('Paragraph one')
  })
})
