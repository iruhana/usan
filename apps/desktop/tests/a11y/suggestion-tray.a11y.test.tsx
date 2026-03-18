// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'
import type { ContextSnapshot, Suggestion } from '../../src/shared/types/infrastructure'
import SuggestionTray from '../../src/renderer/src/components/proactive/SuggestionTray'
import { setLocale } from '../../src/renderer/src/i18n'

const contextSnapshot: ContextSnapshot = {
  activeWindow: null,
  activeApp: 'explorer',
  timeOfDay: 'afternoon',
  idleTimeMs: 180000,
  monitors: [],
  timestamp: Date.now(),
}

const suggestions: Suggestion[] = [
  {
    id: 'suggestion-1',
    type: 'action',
    title: 'Clipboard looks like JSON',
    description: 'Prettify the latest clipboard content before pasting it somewhere else.',
    actions: [{ label: 'Prettify clipboard', action: 'clipboard_transform', params: { format: 'json_pretty' } }],
    priority: 5,
    timestamp: Date.now(),
  },
]

describe('SuggestionTray accessibility', () => {
  afterEach(() => {
    cleanup()
  })

  it('has no serious or critical axe violations', async () => {
    setLocale('en')
    const { container } = render(<SuggestionTray suggestions={suggestions} contextSnapshot={contextSnapshot} />)

    const result = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: {
        'color-contrast': { enabled: false },
      },
    })

    const importantViolations = result.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    )

    expect(
      importantViolations,
      JSON.stringify(
        importantViolations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          help: violation.help,
          nodeCount: violation.nodes.length,
        })),
        null,
        2,
      ),
    ).toHaveLength(0)
  })
})
