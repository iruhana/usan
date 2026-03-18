// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'
import NotesPage from '../../src/renderer/src/pages/NotesPage'
import { setLocale } from '../../src/renderer/src/i18n'
import { useNotesStore } from '../../src/renderer/src/stores/notes.store'

function createUsanMock(notes: Array<{ id: string; title: string; content: string; updatedAt: number }>) {
  return {
    notes: {
      load: vi.fn().mockResolvedValue(notes),
      save: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe('NotesPage accessibility', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en'
    setLocale('en')
    useNotesStore.setState((state) => ({
      ...state,
      notes: [],
      selectedId: null,
      loading: true,
    }))
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe violations on empty state', async () => {
    ;(window as any).usan = createUsanMock([])

    const { container } = render(<NotesPage />)

    await screen.findByText('No notes')

    const result = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: {
        'color-contrast': { enabled: false },
      },
    })

    const importantViolations = result.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    )

    expect(importantViolations).toHaveLength(0)
  })

  it('does not nest buttons inside note rows', async () => {
    ;(window as any).usan = createUsanMock([
      {
        id: 'note-1',
        title: 'Shopping',
        content: 'Milk',
        updatedAt: Date.now(),
      },
    ])

    const { container } = render(<NotesPage />)

    await screen.findByText('Shopping')

    expect(container.querySelector('button button')).toBeNull()
    expect(screen.getByRole('listbox', { name: 'Saved notes' })).toBeInTheDocument()
  })
})
