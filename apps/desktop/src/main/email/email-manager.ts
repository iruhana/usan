/**
 * Email manager with provider adapters (Gmail / Outlook).
 * OAuth policy is enforced via oauth-policy.ts through provider client helpers.
 */
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
}

export interface EmailDraft {
  to: string[]
  subject: string
  body: string
}

export type EmailProvider = 'google' | 'microsoft'

const DEFAULT_PROVIDER: EmailProvider = 'google'

function resolveEmailProvider(explicit?: EmailProvider): EmailProvider {
  if (explicit === 'google' || explicit === 'microsoft') return explicit
  const envProvider = process.env['USAN_EMAIL_PROVIDER']?.trim().toLowerCase()
  if (envProvider === 'google' || envProvider === 'microsoft') return envProvider
  return DEFAULT_PROVIDER
}

function getProviderAccessToken(provider: EmailProvider): string {
  if (provider === 'google') {
    // Try stored OAuth token first, fall back to env var
    const tokens = loadGoogleTokens()
    if (tokens?.accessToken) return tokens.accessToken
    return process.env['USAN_GOOGLE_ACCESS_TOKEN']?.trim() ?? ''
  }
  return process.env['USAN_MICROSOFT_ACCESS_TOKEN']?.trim() ?? ''
}

export function createEmailOAuthAuthorizationRequest(options: {
  clientId: string
  redirectUri: string
  provider?: EmailProvider
  authEndpoint?: string
  scopes?: string[]
  state?: string
  tenantId?: string
}): DesktopOAuthAuthorizationRequest {
  const provider = resolveEmailProvider(options.provider)

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
  provider?: EmailProvider
  clientId: string
  code: string
  redirectUri: string
  codeVerifier: string
  tenantId?: string
}): Promise<OAuthTokenResponse> {
  const provider = resolveEmailProvider(options.provider)

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
  const provider = resolveEmailProvider()
  const accessToken = getProviderAccessToken(provider)
  if (!accessToken) return []

  if (provider === 'google') {
    return listGmailMessages(accessToken, limit)
  }

  return listOutlookMessages(accessToken, limit)
}

export async function readEmail(id: string): Promise<EmailMessage | null> {
  const provider = resolveEmailProvider()
  const accessToken = getProviderAccessToken(provider)
  if (!accessToken) return null

  if (provider === 'google') {
    return readGmailMessage(accessToken, id)
  }

  return readOutlookMessage(accessToken, id)
}

export async function sendEmail(draft: EmailDraft): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const provider = resolveEmailProvider()
    const accessToken = getProviderAccessToken(provider)
    if (!accessToken) {
      return {
        success: false,
        error: 'Email integration is not configured. Set provider access token and run desktop OAuth.',
      }
    }

    if (provider === 'google') {
      return sendGmailMessage(accessToken, draft)
    }

    return sendOutlookMessage(accessToken, draft)
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message,
    }
  }
}

export function isEmailConfigured(): boolean {
  const provider = resolveEmailProvider()
  const accessToken = getProviderAccessToken(provider)
  return accessToken.length > 0
}
