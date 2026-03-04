import { createDesktopOAuthAuthorizationRequest, type DesktopOAuthAuthorizationRequest } from '../auth/oauth-policy'

export interface MicrosoftOAuthExchangeInput {
  clientId: string
  code: string
  redirectUri: string
  codeVerifier: string
  tenantId?: string
}

export interface OAuthTokenResponse {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  scope?: string
  tokenType?: string
}

export interface OutlookEmailMessage {
  id: string
  from: string
  to: string[]
  subject: string
  body: string
  date: number
  read: boolean
  snippet: string
}

const MICROSOFT_AUTH_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MICROSOFT_TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const DEFAULT_MICROSOFT_SCOPES = ['openid', 'offline_access', 'User.Read', 'Mail.Read', 'Mail.Send']

type GraphRecipient = {
  emailAddress?: {
    address?: string
    name?: string
  }
}

type GraphMessage = {
  id: string
  subject?: string
  bodyPreview?: string
  body?: { content?: string; contentType?: string }
  from?: GraphRecipient
  toRecipients?: GraphRecipient[]
  isRead?: boolean
  receivedDateTime?: string
}

function parseRecipient(recipient?: GraphRecipient): string {
  return recipient?.emailAddress?.address ?? ''
}

function parseRecipients(recipients?: GraphRecipient[]): string[] {
  return (recipients ?? [])
    .map((recipient) => parseRecipient(recipient))
    .filter((address) => address.length > 0)
}

async function graphFetchJson<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Microsoft Graph request failed (${response.status}): ${body || response.statusText}`)
  }

  return (await response.json()) as T
}

export function createOutlookOAuthAuthorizationRequest(options: {
  clientId: string
  redirectUri: string
  scopes?: string[]
  state?: string
  tenantId?: string
}): DesktopOAuthAuthorizationRequest {
  const tenantId = options.tenantId?.trim() || 'common'
  return createDesktopOAuthAuthorizationRequest({
    provider: 'microsoft',
    clientId: options.clientId,
    authEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    redirectUri: options.redirectUri,
    scopes: options.scopes ?? DEFAULT_MICROSOFT_SCOPES,
    state: options.state,
    extraParams: {
      response_mode: 'query',
    },
  })
}

export async function exchangeOutlookAuthorizationCode(input: MicrosoftOAuthExchangeInput): Promise<OAuthTokenResponse> {
  const tenantId = input.tenantId?.trim() || 'common'
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const body = new URLSearchParams({
    client_id: input.clientId,
    code: input.code,
    code_verifier: input.codeVerifier,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  })

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Microsoft token exchange failed (${response.status}): ${details || response.statusText}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    token_type?: string
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
    tokenType: data.token_type,
  }
}

export async function listOutlookMessages(accessToken: string, limit = 20): Promise<OutlookEmailMessage[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 50))
  const response = await graphFetchJson<{ value?: GraphMessage[] }>(
    accessToken,
    `https://graph.microsoft.com/v1.0/me/messages?$top=${safeLimit}&$select=id,subject,bodyPreview,isRead,receivedDateTime,from,toRecipients&$orderby=receivedDateTime desc`,
  )

  return (response.value ?? []).map((message) => ({
    id: message.id,
    from: parseRecipient(message.from),
    to: parseRecipients(message.toRecipients),
    subject: message.subject ?? '',
    body: '',
    date: message.receivedDateTime ? Date.parse(message.receivedDateTime) : Date.now(),
    read: message.isRead ?? false,
    snippet: message.bodyPreview ?? '',
  }))
}

export async function readOutlookMessage(accessToken: string, id: string): Promise<OutlookEmailMessage | null> {
  if (!id.trim()) return null

  const message = await graphFetchJson<GraphMessage>(
    accessToken,
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}?$select=id,subject,body,bodyPreview,isRead,receivedDateTime,from,toRecipients`,
  )

  return {
    id: message.id,
    from: parseRecipient(message.from),
    to: parseRecipients(message.toRecipients),
    subject: message.subject ?? '',
    body: message.body?.content ?? '',
    date: message.receivedDateTime ? Date.parse(message.receivedDateTime) : Date.now(),
    read: message.isRead ?? false,
    snippet: message.bodyPreview ?? '',
  }
}

export async function sendOutlookMessage(
  accessToken: string,
  draft: { to: string[]; subject: string; body: string },
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const recipients = draft.to
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((address) => ({ emailAddress: { address } }))

  if (recipients.length === 0) {
    return { success: false, error: 'Recipient list is empty' }
  }

  await graphFetchJson<unknown>(accessToken, 'https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: draft.subject,
        body: {
          contentType: 'Text',
          content: draft.body,
        },
        toRecipients: recipients,
      },
      saveToSentItems: true,
    }),
  })

  return { success: true }
}

export { MICROSOFT_AUTH_ENDPOINT, MICROSOFT_TOKEN_ENDPOINT }
