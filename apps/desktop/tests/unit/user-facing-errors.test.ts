import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/renderer/src/i18n', async () => {
  const actual = await vi.importActual<typeof import('../../src/renderer/src/i18n')>('../../src/renderer/src/i18n')
  const { en } = await vi.importActual<typeof import('../../src/renderer/src/i18n/locales/en')>('../../src/renderer/src/i18n/locales/en')

  return {
    ...actual,
    getLocale: () => 'en' as const,
    setLocale: vi.fn(),
    t: (key: string) => en[key] ?? key,
  }
})

import {
  toAppControlErrorMessage,
  toAuthErrorMessage,
  toChatErrorMessage,
  toEmailErrorMessage,
  toFilesErrorMessage,
  toMarketplaceErrorMessage,
  toMcpErrorMessage,
  toToolExecutionErrorMessage,
  toUpdaterErrorMessage,
  toVoiceErrorMessage,
} from '../../src/renderer/src/lib/user-facing-errors'

describe('user-facing error mapping', () => {
  it('maps login credential failures to plain language', () => {
    expect(toAuthErrorMessage('Invalid login credentials', 'login')).toBe('That email or password does not match.')
  })

  it('maps signup duplicate-email failures to plain language', () => {
    expect(toAuthErrorMessage('User already registered', 'signup')).toBe('This email is already in use. Try logging in instead.')
  })

  it('maps risky bare command launch failures to a full-path instruction', () => {
    expect(toAppControlErrorMessage('assistant is a risky bare command. Use a full path instead.', 'launch'))
      .toBe('For custom programs, enter the full app path instead of a short command name.')
  })

  it('maps updater rollback guards to a calm status message', () => {
    expect(toUpdaterErrorMessage('rollback_guard_applied')).toBe('Usan returned to a safe version after an update problem. Please check again later.')
  })

  it('maps folder permission failures to plain language', () => {
    expect(toFilesErrorMessage('EACCES: permission denied')).toBe('This folder could not be opened because access is blocked.')
  })

  it('maps marketplace network failures to a retry hint', () => {
    expect(toMarketplaceErrorMessage('network timeout', 'install')).toBe(
      'Usan could not reach the extra tools list. Check the internet and try again.',
    )
  })

  it('maps email setup failures to a setup hint', () => {
    expect(toEmailErrorMessage('email is not configured', 'send')).toBe(
      'Email is not set up yet. Open Settings and connect an account first.',
    )
  })

  it('maps MCP json failures to a simple input warning', () => {
    expect(toMcpErrorMessage('Unexpected token } in JSON', 'callTool')).toBe('The input format is not valid.')
  })

  it('maps tool execution failures to tool-specific plain language', () => {
    expect(toToolExecutionErrorMessage('email_send', 'email is not configured')).toBe(
      'Email is not set up yet. Open Settings and connect an account first.',
    )
  })

  it('maps voice setup failures without exposing API details', () => {
    expect(toVoiceErrorMessage('API key is not configured')).toBe(
      'Voice input needs more setup before it can work.',
    )
  })

  it('maps chat provider failures to beginner-friendly copy', () => {
    expect(toChatErrorMessage('429 rate limit exceeded')).toBe(
      'Usan is busy right now. Please wait a moment and try again.',
    )
  })
})
