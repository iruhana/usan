import { afterEach, describe, expect, it, vi } from 'vitest'
import { logObsInfo, logObsWarn } from '@main/observability'

describe('observability', () => {
  afterEach(() => {
    process.env.USAN_OBS_LEVEL = 'off'
    vi.restoreAllMocks()
  })

  it('does not emit info logs when level is warn', () => {
    process.env.USAN_OBS_LEVEL = 'warn'
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    logObsInfo('sample_event', { ok: true })

    expect(infoSpy).not.toHaveBeenCalled()
  })

  it('does not emit warn logs when level is off', () => {
    process.env.USAN_OBS_LEVEL = 'off'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    logObsWarn('sample_event', { ok: true })

    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('redacts sensitive keys in emitted payload', () => {
    process.env.USAN_OBS_LEVEL = 'info'
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    logObsInfo('credential_test', {
      apiKey: 'sk-1234567890abcdefghijkl',
      token: 'szn_abcdefghijklmnopqrstuv',
      nested: { password: 'secret-value' },
    })

    const output = infoSpy.mock.calls[0]?.[0] as string
    expect(output).toContain('[REDACTED]')
    expect(output).not.toContain('sk-1234567890abcdefghijkl')
    expect(output).not.toContain('szn_abcdefghijklmnopqrstuv')
    expect(output).not.toContain('secret-value')
  })
})
