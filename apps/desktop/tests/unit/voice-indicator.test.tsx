// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import VoiceIndicator from '../../src/renderer/src/components/voice/VoiceIndicator'
import { setLocale } from '../../src/renderer/src/i18n'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'
import { useVoiceStore } from '../../src/renderer/src/stores/voice.store'

describe('VoiceIndicator', () => {
  beforeEach(() => {
    setLocale('en')
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        locale: 'en',
        voiceOverlayEnabled: true,
      },
    }))
    useVoiceStore.setState({
      status: { status: 'idle' },
      lastText: '',
      hidden: false,
      listening: false,
      eventVersion: 0,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('shows voice status when the helper UI is enabled', () => {
    useVoiceStore.setState({ status: { status: 'listening' } })

    render(<VoiceIndicator />)

    expect(screen.getByText('Listening')).toBeInTheDocument()
  })

  it('hides voice status when the helper UI is disabled', () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        voiceOverlayEnabled: false,
      },
    }))
    useVoiceStore.setState({ status: { status: 'listening' } })

    const { container } = render(<VoiceIndicator />)

    expect(container).toBeEmptyDOMElement()
  })
})
