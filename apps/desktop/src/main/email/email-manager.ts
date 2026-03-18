/**
 * Email manager with provider adapters.
 * Preferred order: IMAP/SMTP local account -> Gmail OAuth -> Outlook OAuth.
 */
import type { EmailAccountConfigInput, EmailAccountStatus } from '@shared/types/ipc'
import {
  clearEmailAccountConfig,
  loadEmailAccountConfig,
  normalizeEmailAccountConfigInput,
  saveEmailAccountConfig as persistEmailAccountConfig,
  toEmailAccountStatus,
} from './email-account-store'
import {
  listImapSmtpMessages,
  readImapSmtpMessage,
  sendImapSmtpMessage,
  verifyImapSmtpConnection,
} from './imap-smtp-client'
import {
  createGmailOAuthAuthorizationRequest,
  exchangeGmailAuthorizationCode,
  listGmailMessages,
  readGmailMessage,
  sendGmailMessage,
  type GmailOAuthExchangeInput,
  type OAuthTokenResponse,
} from './gmail-client'
import {
  createOutlookOAuthAuthorizationRequest,
  exchangeOutlookAuthorizationCode,
  listOutlookMessages,
  readOutlookMessage,
  sendOutlookMessage,
  type MicrosoftOAuthExchangeInput,
} from './outlook-client'
import { loadGoogleTokens } from '../auth/oauth-google'
import type { DesktopOAuthAuthorizationRequest } from '../auth/oauth-policy'

export interface EmailMessage {
  id: string
  from: string
  to: string[]
  subject: string
  body: string
  date: number
  read: boolean
  snippet: string
  cc?: string[]
  attachments?: Array<{ name: string; size: number }>
}

export interface EmailDraft {
  to: string[]
  subject: string
  body: string
}

export type EmailProvider = 'imap-smtp' | 'google' | 'microsoft'

const DEFAULT_PROVIDER: Extract<EmailProvider, 'google' | 'microsoft'> = 'google'

function resolveOauthProvider(
  explicit?: Extract<EmailProvider, 'google' | 'microsoft'>,
): Extract<EmailProvider, 'google' | 'microsoft'> {
  if (explicit === 'google' || explicit === 'microsoft') return explicit
  const envProvider = process.env['USAN_EMAIL_PROVIDER']?.trim().toLowerCase()
  if (envProvider === 'google' || envProvider === 'microsoft') return envProvider
  return DEFAULT_PROVIDER
}

function getProviderAccessToken(provider: Extract<EmailProvider, 'google' | 'microsoft'>): string {
  if (provider === 'google') {
    const tokens = loadGoogleTokens()
    if (tokens?.accessToken) return tokens.accessToken
    return process.env['USAN_GOOGLE_ACCESS_TOKEN']?.trim() ?? ''
  }
  return process.env['USAN_MICROSOFT_ACCESS_TOKEN']?.trim() ?? ''
}

function getConfiguredProvider(): EmailProvider | null {
  if (loadEmailAccountConfig()) {
    return 'imap-smtp'
  }

  const oauthProvider = resolveOauthProvider()
  return getProviderAccessToken(oauthProvider) ? oauthProvider : null
}

export function createEmailOAuthAuthorizationRequest(options: {
  clientId: string
  redirectUri: string
  provider?: Extract<EmailProvider, 'google' | 'microsoft'>
  authEndpoint?: string
  scopes?: string[]
  state?: string
  tenantId?: string
}): DesktopOAuthAuthorizationRequest {
  const provider = resolveOauthProvider(options.provider)

  if (provider === 'google') {
    return createGmailOAuthAuthorizationRequest({
      clientId: options.clientId,
      redirectUri: options.redirectUri,
      scopes: options.scopes,
      state: options.state,
    })
  }

  return createOutlookOAuthAuthorizationRequest({
    clientId: options.clientId,
    redirectUri: options.redirectUri,
    scopes: options.scopes,
    state: options.state,
    tenantId: options.tenantId,
  })
}

export async function exchangeEmailOAuthCode(options: {
  provider?: Extract<EmailProvider, 'google' | 'microsoft'>
  clientId: string
  code: string
  redirectUri: string
  codeVerifier: string
  tenantId?: string
}): Promise<OAuthTokenResponse> {
  const provider = resolveOauthProvider(options.provider)

  if (provider === 'google') {
    const input: GmailOAuthExchangeInput = {
      clientId: options.clientId,
      code: options.code,
      redirectUri: options.redirectUri,
      codeVerifier: options.codeVerifier,
    }
    return exchangeGmailAuthorizationCode(input)
  }

  const input: MicrosoftOAuthExchangeInput = {
    clientId: options.clientId,
    code: options.code,
    redirectUri: options.redirectUri,
    codeVerifier: options.codeVerifier,
    tenantId: options.tenantId,
  }
  return exchangeOutlookAuthorizationCode(input)
}

export async function listEmails(limit = 20): Promise<EmailMessage[]> {
  const imapConfig = loadEmailAccountConfig()
  if (imapConfig) {
    return listImapSmtpMessages(imapConfig, limit)
  }

  const provider = resolveOauthProvider()
  const accessToken = getProviderAccessToken(provider)
  if (!accessToken) return []

  if (provider === 'google') {
    return listGmailMessages(accessToken, limit)
  }

  return listOutlookMessages(accessToken, limit)
}

export async function readEmail(id: string): Promise<EmailMessage | null> {
  const imapConfig = loadEmailAccountConfig()
  if (imapConfig) {
    return readImapSmtpMessage(imapConfig, id)
  }

  const provider = resolveOauthProvider()
  const accessToken = getProviderAccessToken(provider)
  if (!accessToken) return null

  if (provider === 'google') {
    return readGmailMessage(accessToken, id)
  }

  return readOutlookMessage(accessToken, id)
}

export async function sendEmail(
  draft: EmailDraft,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const imapConfig = loadEmailAccountConfig()
    if (imapConfig) {
      return sendImapSmtpMessage(imapConfig, draft)
    }

    const provider = resolveOauthProvider()
    const accessToken = getProviderAccessToken(provider)
    if (!accessToken) {
      return {
        success: false,
        error: 'Email integration is not configured. Open Settings and connect an email account first.',
      }
    }

    if (provider === 'google') {
      return sendGmailMessage(accessToken, draft)
    }

    return sendOutlookMessage(accessToken, draft)
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}

export function isEmailConfigured(): boolean {
  return getConfiguredProvider() !== null
}

export function getEmailAccountStatus(): EmailAccountStatus {
  const imapConfig = loadEmailAccountConfig()
  if (imapConfig) {
    return toEmailAccountStatus(imapConfig)
  }

  const provider = getConfiguredProvider()
  if (!provider) {
    return {
      provider: 'none',
      configured: false,
      hasStoredPassword: false,
      lastVerifiedAt: null,
    }
  }

  return {
    provider,
    configured: true,
    hasStoredPassword: false,
    lastVerifiedAt: null,
  }
}

export async function saveEmailAccountConfig(input: EmailAccountConfigInput): Promise<EmailAccountStatus> {
  const existing = loadEmailAccountConfig()
  const normalized = normalizeEmailAccountConfigInput(input, {
    fallbackPassword: existing?.password,
    lastVerifiedAt: Date.now(),
  })

  await verifyImapSmtpConnection(normalized)
  const stored = await persistEmailAccountConfig(input, {
    fallbackPassword: existing?.password,
    lastVerifiedAt: normalized.lastVerifiedAt,
  })

  return toEmailAccountStatus(stored)
}

export async function clearEmailAccount(): Promise<EmailAccountStatus> {
  await clearEmailAccountConfig()
  return getEmailAccountStatus()
}
