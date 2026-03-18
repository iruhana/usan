// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
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

describe('SuggestionTray', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders monitoring summary and action buttons', () => {
    setLocale('en')
    const onAction = vi.fn()
    const onDismiss = vi.fn()

    render(
      <SuggestionTray
        suggestions={suggestions}
        contextSnapshot={contextSnapshot}
        onAction={onAction}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByTestId('proactive-monitoring-card')).toBeInTheDocument()
    expect(screen.getByTestId('proactive-active-app')).toHaveTextContent('explorer is active now.')
    expect(screen.getByTestId('proactive-idle-minutes')).toHaveTextContent('Idle for 3 min.')

    fireEvent.click(screen.getByTestId('suggestion-action-suggestion-1-clipboard_transform'))
    expect(onAction).toHaveBeenCalledWith('suggestion-1', suggestions[0]?.actions[0])

    fireEvent.click(screen.getByTestId('suggestion-dismiss-suggestion-1'))
    expect(onDismiss).toHaveBeenCalledWith('suggestion-1')
  })
})
