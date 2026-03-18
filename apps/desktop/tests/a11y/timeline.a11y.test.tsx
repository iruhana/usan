// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'
import { Timeline, type TimelineStep } from '../../src/renderer/src/components/agent'
import { setLocale } from '../../src/renderer/src/i18n'

const steps: TimelineStep[] = [
  {
    id: 'step-1',
    kind: 'tool',
    status: 'completed',
    title: 'Indexed folder',
    description: 'The selected folder was indexed for search.',
    durationMs: 1240,
  },
  {
    id: 'step-2',
    kind: 'response',
    status: 'running',
    title: 'Writing response',
    description: 'Usan is drafting the final answer.',
  },
]

describe('Timeline accessibility', () => {
  afterEach(() => {
    cleanup()
  })

  it('has no serious or critical axe violations', async () => {
    setLocale('en')
    const { container } = render(<Timeline steps={steps} isStreaming />)

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
