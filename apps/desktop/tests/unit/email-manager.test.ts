import { beforeEach, describe, expect, it, vi } from 'vitest'

const emailAccountStoreMock = vi.hoisted(() => ({
  loadEmailAccountConfig: vi.fn(),
  normalizeEmailAccountConfigInput: vi.fn(),
  saveEmailAccountConfig: vi.fn(),
  clearEmailAccountConfig: vi.fn(),
  toEmailAccountStatus: vi.fn(),
}))

const imapSmtpClientMock = vi.hoisted(() => ({
  listImapSmtpMessages: vi.fn(),
  readImapSmtpMessage: vi.fn(),
  sendImapSmtpMessage: vi.fn(),
  verifyImapSmtpConnection: vi.fn(),
}))

const gmailClientMock = vi.hoisted(() => ({
  createGmailOAuthAuthorizationRequest: vi.fn(),
  exchangeGmailAuthorizationCode: vi.fn(),
  listGmailMessages: vi.fn(),
  readGmailMessage: vi.fn(),
  sendGmailMessage: vi.fn(),
}))

const outlookClientMock = vi.hoisted(() => ({
  createOutlookOAuthAuthorizationRequest: vi.fn(),
  exchangeOutlookAuthorizationCode: vi.fn(),
  listOutlookMessages: vi.fn(),
  readOutlookMessage: vi.fn(),
  sendOutlookMessage: vi.fn(),
}))

const oauthGoogleMock = vi.hoisted(() => ({
  loadGoogleTokens: vi.fn(),
}))

vi.mock('../../src/main/email/email-account-store', () => emailAccountStoreMock)
vi.mock('../../src/main/email/imap-smtp-client', () => imapSmtpClientMock)
vi.mock('../../src/main/email/gmail-client', () => gmailClientMock)
vi.mock('../../src/main/email/outlook-client', () => outlookClientMock)
vi.mock('../../src/main/auth/oauth-google', () => oauthGoogleMock)

import {
  getEmailAccountStatus,
  listEmails,
  saveEmailAccountConfig as saveEmailIntegrationConfig,
} from '../../src/main/email/email-manager'

describe('email-manager', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    emailAccountStoreMock.toEmailAccountStatus.mockImplementation((config) => {
      if (!config) {
        return {
          provider: 'none',
          configured: false,
          hasStoredPassword: false,
          lastVerifiedAt: null,
        }
      }

      return {
        provider: 'imap-smtp',
        configured: true,
        emailAddress: config.emailAddress,
        username: config.username,
        preset: config.preset,
        hasStoredPassword: Boolean(config.password),
        lastVerifiedAt: config.lastVerifiedAt ?? null,
      }
    })

    emailAccountStoreMock.normalizeEmailAccountConfigInput.mockImplementation((input, options) => ({
      ...input,
      password: input.password || options?.fallbackPassword || '',
      updatedAt: 1742342400000,
      lastVerifiedAt: options?.lastVerifiedAt ?? null,
    }))

    emailAccountStoreMock.saveEmailAccountConfig.mockImplementation(async (input, options) => ({
      ...input,
      password: input.password || options?.fallbackPassword || '',
      updatedAt: 1742342400000,
      lastVerifiedAt: options?.lastVerifiedAt ?? null,
    }))

    oauthGoogleMock.loadGoogleTokens.mockReturnValue(null)
  })

  it('prefers the IMAP/SMTP account when one is saved locally', async () => {
    const savedAccount = {
      preset: 'gmail',
      emailAddress: 'team@example.com',
      username: 'team@example.com',
      password: 'secret',
      imap: { host: 'imap.gmail.com', port: 993, secure: true },
      smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
      updatedAt: 1742342400000,
      lastVerifiedAt: 1742342400000,
    }

    emailAccountStoreMock.loadEmailAccountConfig.mockReturnValue(savedAccount)
    imapSmtpClientMock.listImapSmtpMessages.mockResolvedValue([
      {
        id: '101',
        from: 'sender@example.com',
        to: ['team@example.com'],
        subject: 'Hello',
        body: '',
        date: 1742342400000,
        read: true,
        snippet: 'Hello',
      },
    ])

    const result = await listEmails(5)

    expect(imapSmtpClientMock.listImapSmtpMessages).toHaveBeenCalledWith(savedAccount, 5)
    expect(gmailClientMock.listGmailMessages).not.toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('101')
  })

  it('reuses the saved password when the form leaves password blank', async () => {
    const savedAccount = {
      preset: 'gmail',
      emailAddress: 'team@example.com',
      username: 'team@example.com',
      password: 'saved-app-password',
      imap: { host: 'imap.gmail.com', port: 993, secure: true },
      smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
      updatedAt: 1742342400000,
      lastVerifiedAt: 1742342400000,
    }

    emailAccountStoreMock.loadEmailAccountConfig.mockReturnValue(savedAccount)

    await saveEmailIntegrationConfig({
      preset: 'gmail',
      emailAddress: 'team@example.com',
      username: 'team@example.com',
      password: '',
      imap: { host: 'imap.gmail.com', port: 993, secure: true },
      smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    })

    expect(emailAccountStoreMock.normalizeEmailAccountConfigInput).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: 'team@example.com',
      }),
      expect.objectContaining({
        fallbackPassword: 'saved-app-password',
      }),
    )
    expect(imapSmtpClientMock.verifyImapSmtpConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'saved-app-password',
      }),
    )
    expect(emailAccountStoreMock.saveEmailAccountConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: 'team@example.com',
      }),
      expect.objectContaining({
        fallbackPassword: 'saved-app-password',
      }),
    )
  })

  it('reports the OAuth provider when no IMAP account is stored', () => {
    emailAccountStoreMock.loadEmailAccountConfig.mockReturnValue(null)
    oauthGoogleMock.loadGoogleTokens.mockReturnValue({ accessToken: 'google-token' })

    const status = getEmailAccountStatus()

    expect(status).toEqual({
      provider: 'google',
      configured: true,
      hasStoredPassword: false,
      lastVerifiedAt: null,
    })
  })
})
