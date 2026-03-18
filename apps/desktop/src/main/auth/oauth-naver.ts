import type { ExternalOAuthStatus } from '@shared/types/ipc'
import {
  clearDesktopOAuthTokens,
  loadDesktopOAuthTokens,
  saveDesktopOAuthTokens,
  splitOAuthScope,
  startDesktopOAuthFlow,
  type DesktopOAuthTokenResponse,
  type OAuthAccountProfile,
  type StoredDesktopOAuthTokens,
} from './oauth-desktop'

const NAVER_AUTH_ENDPOINT = 'https://nid.naver.com/oauth2/authorize'
const NAVER_TOKEN_ENDPOINT = 'https://nid.naver.com/oauth2/token'
const NAVER_PROFILE_ENDPOINT = 'https://openapi.naver.com/v1/nid/me'
const TOKEN_FILENAME = 'naver-oauth-tokens.enc'
const DEFAULT_REDIRECT_PORT = 18111
const DEFAULT_SCOPES = ['openid']

export interface NaverProfile extends OAuthAccountProfile {
  id: string
}

interface NaverTokenResponse extends DesktopOAuthTokenResponse {
  id_token?: string
}

function getNaverClientId(): string {
  return process.env['USAN_NAVER_CLIENT_ID']?.trim() ?? ''
}

function getNaverClientSecret(): string {
  return process.env['USAN_NAVER_CLIENT_SECRET']?.trim() ?? ''
}

function getNaverRedirectPort(): number {
  const value = Number(process.env['USAN_NAVER_REDIRECT_PORT'] ?? DEFAULT_REDIRECT_PORT)
  return Number.isInteger(value) && value >= 1024 && value <= 65535 ? value : DEFAULT_REDIRECT_PORT
}

export function loadNaverTokens(): StoredDesktopOAuthTokens<NaverProfile> | null {
  return loadDesktopOAuthTokens<NaverProfile>(TOKEN_FILENAME)
}

export function isNaverConfigured(): boolean {
  return Boolean(getNaverClientId() && getNaverClientSecret())
}

export async function clearNaverTokens(): Promise<{ success: boolean }> {
  const accessToken = await getNaverAccessToken().catch(() => null)
  const clientId = getNaverClientId()
  const clientSecret = getNaverClientSecret()

  if (accessToken && clientId && clientSecret) {
    await revokeNaverAccessToken(clientId, clientSecret, accessToken).catch(() => {})
  }

  await clearDesktopOAuthTokens(TOKEN_FILENAME)
  return { success: true }
}

export async function getNaverAccessToken(): Promise<string | null> {
  const tokens = loadNaverTokens()
  if (!tokens) return null

  if (Date.now() <= tokens.expiresAt - 60_000) {
    return tokens.accessToken
  }

  const clientId = getNaverClientId()
  const clientSecret = getNaverClientSecret()
  if (!clientId || !clientSecret || !tokens.refreshToken) return null

  try {
    const refreshed = await refreshNaverToken(clientId, clientSecret, tokens.refreshToken)
    const updated: StoredDesktopOAuthTokens<NaverProfile> = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + Number(refreshed.expires_in ?? 3600) * 1000,
      scope: refreshed.scope || tokens.scope,
      tokenType: refreshed.token_type || tokens.tokenType,
      profile: tokens.profile,
    }
    await saveDesktopOAuthTokens(TOKEN_FILENAME, updated)
    return updated.accessToken
  } catch {
    return null
  }
}

export async function getNaverAuthStatus(): Promise<ExternalOAuthStatus> {
  const configured = isNaverConfigured()
  const stored = loadNaverTokens()
  if (!stored) {
    return {
      provider: 'naver',
      configured,
      authenticated: false,
      expiresAt: null,
      scopes: [],
    }
  }

  const accessToken = await getNaverAccessToken()
  if (!accessToken) {
    return {
      provider: 'naver',
      configured,
      authenticated: false,
      expiresAt: stored.expiresAt,
      scopes: splitOAuthScope(stored.scope),
      profile: stored.profile,
    }
  }

  const profile = await fetchNaverProfile(accessToken).catch(() => stored.profile)
  if (profile && JSON.stringify(profile) !== JSON.stringify(stored.profile)) {
    await saveDesktopOAuthTokens(TOKEN_FILENAME, { ...loadNaverTokens()!, profile })
  }

  const latest = loadNaverTokens() ?? stored
  return {
    provider: 'naver',
    configured,
    authenticated: true,
    expiresAt: latest.expiresAt,
    scopes: splitOAuthScope(latest.scope),
    profile: profile ?? latest.profile,
  }
}

export async function startNaverOAuthFlow(
  clientId?: string,
  clientSecret?: string,
): Promise<{ success: boolean; error?: string }> {
  const resolvedClientId = clientId?.trim() || getNaverClientId()
  const resolvedClientSecret = clientSecret?.trim() || getNaverClientSecret()

  if (!resolvedClientId || !resolvedClientSecret) {
    return {
      success: false,
      error: 'Naver OAuth를 사용하려면 USAN_NAVER_CLIENT_ID와 USAN_NAVER_CLIENT_SECRET을 설정해 주세요.',
    }
  }

  return startDesktopOAuthFlow({
    provider: 'naver',
    clientId: resolvedClientId,
    authEndpoint: NAVER_AUTH_ENDPOINT,
    tokenFilename: TOKEN_FILENAME,
    scopes: DEFAULT_SCOPES,
    redirectPort: getNaverRedirectPort(),
    exchangeCode: ({ clientId: flowClientId, code, redirectUri, codeVerifier, state }) =>
      exchangeCodeForTokens(resolvedClientSecret, flowClientId, code, redirectUri, codeVerifier, state),
    fetchProfile: fetchNaverProfile,
    getMissingClientError: () => 'Naver OAuth 설정이 비어 있습니다.',
  })
}

async function exchangeCodeForTokens(
  clientSecret: string,
  clientId: string,
  code: string,
  redirectUri: string,
  codeVerifier: string,
  state: string,
): Promise<NaverTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    state,
    code_verifier: codeVerifier,
  })

  const response = await fetch(NAVER_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`네이버 토큰 발급 실패 (${response.status}): ${details || response.statusText}`)
  }

  return (await response.json()) as NaverTokenResponse
}

async function refreshNaverToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<NaverTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  })

  const response = await fetch(NAVER_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`네이버 토큰 갱신 실패 (${response.status}): ${details || response.statusText}`)
  }

  return (await response.json()) as NaverTokenResponse
}

async function revokeNaverAccessToken(
  clientId: string,
  clientSecret: string,
  accessToken: string,
): Promise<void> {
  const body = new URLSearchParams({
    grant_type: 'delete',
    client_id: clientId,
    client_secret: clientSecret,
    access_token: accessToken,
  })

  await fetch('https://nid.naver.com/oauth2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  }).catch(() => {})
}

async function fetchNaverProfile(accessToken: string): Promise<NaverProfile> {
  const response = await fetch(NAVER_PROFILE_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`네이버 프로필 조회 실패 (${response.status}): ${details || response.statusText}`)
  }

  const payload = (await response.json()) as {
    resultcode?: string
    message?: string
    response?: {
      id?: string
      name?: string
      nickname?: string
      email?: string
      profile_image?: string
    }
  }

  if (!payload.response?.id) {
    throw new Error(payload.message || '네이버 프로필 응답이 올바르지 않습니다.')
  }

  return {
    id: payload.response.id,
    name: payload.response.name,
    nickname: payload.response.nickname,
    email: payload.response.email,
    avatarUrl: payload.response.profile_image,
  }
}
