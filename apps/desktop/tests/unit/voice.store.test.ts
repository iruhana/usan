import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useVoiceStore } from '../../src/renderer/src/stores/voice.store'

describe('voice.store', () => {
  beforeEach(() => {
    useVoiceStore.getState().stopListening()
    useVoiceStore.setState({
      status: { status: 'idle' },
      lastText: '',
      hidden: false,
      listening: false,
      eventVersion: 0,
})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('subscribes to the preload voice bridge once', () => {
    const unsubscribe = vi.fn()
    const onStatus = vi.fn(() => unsubscribe)

    vi.stubGlobal('window', {
      usan: {
        voice: {
          onStatus,
        },
      },
    })

    useVoiceStore.getState().startListening()
    useVoiceStore.getState().startListening()

    expect(onStatus).toHaveBeenCalledTimes(1)

    useVoiceStore.getState().stopListening()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('unhides on active events and keeps final voice text', () => {
    let statusHandler: ((event: { status: 'idle' | 'listening' | 'processing' | 'error'; text?: string; error?: string }) => void) | undefined
    const unsubscribe = vi.fn()

    vi.stubGlobal('window', {
      usan: {
        voice: {
          onStatus: vi.fn((callback) => {
            statusHandler = callback
            return unsubscribe
          }),
        },
      },
    })

    useVoiceStore.setState({ hidden: true })
    useVoiceStore.getState().startListening()

    statusHandler?.({ status: 'listening' })
    expect(useVoiceStore.getState().status.status).toBe('listening')
    expect(useVoiceStore.getState().hidden).toBe(false)
    expect(useVoiceStore.getState().eventVersion).toBe(1)

    statusHandler?.({ status: 'idle', text: 'voice sample' })
    expect(useVoiceStore.getState().status.text).toBe('voice sample')
    expect(useVoiceStore.getState().lastText).toBe('voice sample')
    expect(useVoiceStore.getState().eventVersion).toBe(2)

    useVoiceStore.getState().stopListening()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})

