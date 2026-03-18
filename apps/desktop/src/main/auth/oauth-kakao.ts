import type { ExternalOAuthStatus } from '@shared/types/ipc'
import { getKakaoProfile, logoutKakaoAccessToken, type KakaoProfile } from '../kakao/kakao-client'
import {
  clearDesktopOAuthTokens,
  loadDesktopOAuthTokens,
  saveDesktopOAuthTokens,
  splitOAuthScope,
  startDesktopOAuthFlow,
  type DesktopOAuthTokenResponse,
  type StoredDesktopOAuthTokens,
} from './oauth-desktop'

const KAKAO_AUTH_ENDPOINT = 'https://kauth.kakao.com/oauth/authorize'
const KAKAO_TOKEN_ENDPOINT = 'https://kauth.kakao.com/oauth/token'
const TOKEN_FILENAME = 'kakao-oauth-tokens.enc'
const DEFAULT_REDIRECT_PORT = 18112
const DEFAULT_SCOPES = ['talk_message', 'account_email', 'profile_nickname', 'profile_image']

interface KakaoTokenResponse extends DesktopOAuthTokenResponse {
  refresh_token_expires_in?: number | string
}

function getKakaoRestApiKey(): string {
  return process.env['USAN_KAKAO_REST_API_KEY']?.trim() ?? ''
}

function getKakaoClientSecret(): string {
  return process.env['USAN_KAKAO_CLIENT_SECRET']?.trim() ?? ''
}

function getKakaoRedirectPort(): number {
  const value = Number(process.env['USAN_KAKAO_REDIRECT_PORT'] ?? DEFAULT_REDIRECT_PORT)
  return Number.isInteger(value) && value >= 1024 && value <= 65535 ? value : DEFAULT_REDIRECT_PORT
}

export function loadKakaoTokens(): StoredDesktopOAuthTokens<KakaoProfile> | null {
  return loadDesktopOAuthTokens<KakaoProfile>(TOKEN_FILENAME)
}

export function isKakaoConfigured(): boolean {
  return Boolean(getKakaoRestApiKey())
}

export async function clearKakaoTokens(): Promise<{ success: boolean }> {
  const accessToken = await getKakaoAccessToken().catch(() => null)
  if (accessToken) {
    await logoutKakaoAccessToken(accessToken).catch(() => {})
  }

  await clearDesktopOAuthTokens(TOKEN_FILENAME)
  return { success: true }
}

export async function getKakaoAccessToken(): Promise<string | null> {
  const tokens = loadKakaoTokens()
  if (!tokens) return null

  if (Date.now() <= tokens.expiresAt - 60_000) {
    return tokens.accessToken
  }

  const clientId = getKakaoRestApiKey()
  if (!clientId || !tokens.refreshToken) return null

  try {
    const refreshed = await refreshKakaoToken(clientId, tokens.refreshToken, getKakaoClientSecret())
    const updated: StoredDesktopOAuthTokens<KakaoProfile> = {
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

export async function getKakaoAuthStatus(): Promise<ExternalOAuthStatus> {
  const configured = isKakaoConfigured()
  const stored = loadKakaoTokens()
  if (!stored) {
    return {
      provider: 'kakao',
      configured,
      authenticated: false,
      expiresAt: null,
      scopes: [],
    }
  }

  const accessToken = await getKakaoAccessToken()
  if (!accessToken) {
    return {
      provider: 'kakao',
      configured,
      authenticated: false,
      expiresAt: stored.expiresAt,
      scopes: splitOAuthScope(stored.scope),
      profile: stored.profile,
    }
  }

  const profile = await getKakaoProfile(accessToken).catch(() => stored.profile)
  if (profile && JSON.stringify(profile) !== JSON.stringify(stored.profile)) {
    await saveDesktopOAuthTokens(TOKEN_FILENAME, { ...loadKakaoTokens()!, profile })
  }

  const latest = loadKakaoTokens() ?? stored
  return {
    provider: 'kakao',
    configured,
    authenticated: true,
    expiresAt: latest.expiresAt,
    scopes: splitOAuthScope(latest.scope),
    profile: profile ?? latest.profile,
  }
}

export async function startKakaoOAuthFlow(
  restApiKey?: string,
  clientSecret?: string,
): Promise<{ success: boolean; error?: string }> {
  const resolvedRestApiKey = restApiKey?.trim() || getKakaoRestApiKey()
  const resolvedClientSecret = clientSecret?.trim() || getKakaoClientSecret()

  if (!resolvedRestApiKey) {
    return {
      success: false,
      error: 'Kakao OAuth를 사용하려면 USAN_KAKAO_REST_API_KEY를 설정해 주세요.',
    }
  }

  return startDesktopOAuthFlow({
    provider: 'kakao',
    clientId: resolvedRestApiKey,
    authEndpoint: KAKAO_AUTH_ENDPOINT,
    tokenFilename: TOKEN_FILENAME,
    scopes: DEFAULT_SCOPES,
    redirectPort: getKakaoRedirectPort(),
    extraAuthParams: {
      prompt: 'select_account',
      scope: DEFAULT_SCOPES.join(','),
    },
    exchangeCode: ({ clientId: flowClientId, code, redirectUri, codeVerifier }) =>
      exchangeCodeForTokens(flowClientId, code, redirectUri, codeVerifier, resolvedClientSecret),
    fetchProfile: getKakaoProfile,
    getMissingClientError: () => 'Kakao OAuth 설정이 비어 있습니다.',
  })
}

async function exchangeCodeForTokens(
  clientId: string,
  code: string,
  redirectUri: string,
  codeVerifier: string,
  clientSecret?: string,
): Promise<KakaoTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier,
  })

  if (clientSecret?.trim()) {
    body.set('client_secret', clientSecret.trim())
  }

  const response = await fetch(KAKAO_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`카카오 토큰 발급 실패 (${response.status}): ${details || response.statusText}`)
  }

  return (await response.json()) as KakaoTokenResponse
}

async function refreshKakaoToken(
  clientId: string,
  refreshToken: string,
  clientSecret?: string,
): Promise<KakaoTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  })

  if (clientSecret?.trim()) {
    body.set('client_secret', clientSecret.trim())
  }

  const response = await fetch(KAKAO_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`카카오 토큰 갱신 실패 (${response.status}): ${details || response.statusText}`)
  }

  return (await response.json()) as KakaoTokenResponse
}
