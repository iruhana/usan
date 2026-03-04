import { createDesktopOAuthAuthorizationRequest, type DesktopOAuthAuthorizationRequest } from '../auth/oauth-policy'

export interface GmailOAuthExchangeInput {
  clientId: string
  code: string
  redirectUri: string
  codeVerifier: string
}

export interface OAuthTokenResponse {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  scope?: string
  tokenType?: string
}

export interface GmailEmailMessage {
  id: string
  from: string
  to: string[]
  subject: string
  body: string
  date: number
  read: boolean
  snippet: string
}

const GMAIL_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GMAIL_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const DEFAULT_GMAIL_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]

type GmailHeader = { name?: string; value?: string }

type GmailMessagePayload = {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailMessagePayload[]
  headers?: GmailHeader[]
}

type GmailMessageResource = {
  id: string
  threadId?: string
  labelIds?: string[]
  snippet?: string
  payload?: GmailMessagePayload
  internalDate?: string
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`
  return Buffer.from(padded, 'base64').toString('utf8')
}

function extractHeader(headers: GmailHeader[] | undefined, name: string): string {
  const target = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
  return target?.value?.trim() ?? ''
}

function parseAddressList(raw: string): string[] {
  if (!raw.trim()) return []
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function extractTextBody(payload?: GmailMessagePayload): string {
  if (!payload) return ''

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      const candidate = extractTextBody(part)
      if (candidate) return candidate
    }
  }

  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  return ''
}

async function gmailFetchJson<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
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
    throw new Error(`Gmail API request failed (${response.status}): ${body || response.statusText}`)
  }

  return (await response.json()) as T
}

export function createGmailOAuthAuthorizationRequest(options: {
  clientId: string
  redirectUri: string
  scopes?: string[]
  state?: string
}): DesktopOAuthAuthorizationRequest {
  return createDesktopOAuthAuthorizationRequest({
    provider: 'google',
    clientId: options.clientId,
    authEndpoint: GMAIL_AUTH_ENDPOINT,
    redirectUri: options.redirectUri,
    scopes: options.scopes ?? DEFAULT_GMAIL_SCOPES,
    state: options.state,
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    },
  })
}

export async function exchangeGmailAuthorizationCode(input: GmailOAuthExchangeInput): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    code: input.code,
    code_verifier: input.codeVerifier,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  })

  const response = await fetch(GMAIL_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Gmail token exchange failed (${response.status}): ${details || response.statusText}`)
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

export async function listGmailMessages(accessToken: string, limit = 20): Promise<GmailEmailMessage[]> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 50))
  const search = await gmailFetchJson<{ messages?: Array<{ id: string }> }>(
    accessToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${safeLimit}`,
  )

  const ids = search.messages?.map((message) => message.id).filter(Boolean) ?? []
  if (ids.length === 0) return []

  const items = await Promise.all(
    ids.map((id) =>
      gmailFetchJson<GmailMessageResource>(
        accessToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
      ),
    ),
  )

  return items.map((item) => {
    const headers = item.payload?.headers
    const internalDate = Number.parseInt(item.internalDate ?? '', 10)

    return {
      id: item.id,
      from: extractHeader(headers, 'From'),
      to: parseAddressList(extractHeader(headers, 'To')),
      subject: extractHeader(headers, 'Subject'),
      body: '',
      date: Number.isFinite(internalDate) ? internalDate : Date.now(),
      read: !item.labelIds?.includes('UNREAD'),
      snippet: item.snippet ?? '',
    }
  })
}

export async function readGmailMessage(accessToken: string, id: string): Promise<GmailEmailMessage | null> {
  if (!id.trim()) return null

  const item = await gmailFetchJson<GmailMessageResource>(
    accessToken,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
  )

  const headers = item.payload?.headers
  const internalDate = Number.parseInt(item.internalDate ?? '', 10)

  return {
    id: item.id,
    from: extractHeader(headers, 'From'),
    to: parseAddressList(extractHeader(headers, 'To')),
    subject: extractHeader(headers, 'Subject'),
    body: extractTextBody(item.payload),
    date: Number.isFinite(internalDate) ? internalDate : Date.now(),
    read: !item.labelIds?.includes('UNREAD'),
    snippet: item.snippet ?? '',
  }
}

export async function sendGmailMessage(
  accessToken: string,
  draft: { to: string[]; subject: string; body: string },
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const recipients = draft.to.filter((value) => value.trim())
  if (recipients.length === 0) {
    return { success: false, error: 'Recipient list is empty' }
  }

  const mimeLines = [
    `To: ${recipients.join(', ')}`,
    `Subject: ${draft.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    draft.body,
  ]

  const raw = toBase64Url(mimeLines.join('\r\n'))

  const response = await gmailFetchJson<{ id?: string }>(
    accessToken,
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    },
  )

  return { success: true, messageId: response.id }
}
