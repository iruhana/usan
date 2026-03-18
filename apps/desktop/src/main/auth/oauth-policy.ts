/**
 * Desktop OAuth policy guardrails.
 * Enforces external browser + Authorization Code + PKCE S256 + loopback redirect URI.
 */
import { createHash, randomBytes } from 'crypto'
import { shell } from 'electron'

export type OAuthProvider = 'google' | 'microsoft' | 'naver' | 'kakao'

export interface DesktopOAuthPolicy {
  provider: OAuthProvider
  flow: 'authorization_code'
  pkceMethod: 'S256'
  browserMode: 'external'
  allowInAppWebView: false
  redirectUri: string
}

export interface DesktopOAuthAuthorizationOptions {
  provider: OAuthProvider
  clientId: string
  authEndpoint: string
  redirectUri: string
  scopes: string[]
  state?: string
  extraParams?: Record<string, string>
}

export interface DesktopOAuthAuthorizationRequest {
  provider: OAuthProvider
  authorizationUrl: string
  redirectUri: string
  state: string
  codeVerifier: string
  codeChallenge: string
}

const PKCE_VERIFIER_LENGTH = 64

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function createPkceVerifier(): string {
  return toBase64Url(randomBytes(PKCE_VERIFIER_LENGTH))
}

function createPkceChallenge(codeVerifier: string): string {
  return toBase64Url(createHash('sha256').update(codeVerifier).digest())
}

function createStateToken(): string {
  return toBase64Url(randomBytes(32))
}

function isLoopbackRedirectUri(redirectUri: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(redirectUri)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:') return false

  const hostname = parsed.hostname.toLowerCase()
  const isLoopbackHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
  if (!isLoopbackHost) return false

  if (!parsed.port) return false
  const port = Number(parsed.port)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return false

  return true
}

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function buildDesktopOAuthPolicy(provider: OAuthProvider, redirectUri: string): DesktopOAuthPolicy {
  return {
    provider,
    flow: 'authorization_code',
    pkceMethod: 'S256',
    browserMode: 'external',
    allowInAppWebView: false,
    redirectUri,
  }
}

export function assertDesktopOAuthPolicy(policy: DesktopOAuthPolicy): void {
  if (policy.flow !== 'authorization_code') {
    throw new Error('Desktop OAuth must use Authorization Code flow')
  }
  if (policy.pkceMethod !== 'S256') {
    throw new Error('Desktop OAuth must enforce PKCE S256')
  }
  if (policy.browserMode !== 'external' || policy.allowInAppWebView) {
    throw new Error('Desktop OAuth must use external browser (embedded webview is not allowed)')
  }
  if (!isLoopbackRedirectUri(policy.redirectUri)) {
    throw new Error('Desktop OAuth redirectUri must be a loopback HTTP URL with an explicit high port')
  }
}

export function createDesktopOAuthAuthorizationRequest(
  options: DesktopOAuthAuthorizationOptions,
): DesktopOAuthAuthorizationRequest {
  if (!options.clientId?.trim()) throw new Error('OAuth clientId is required')
  if (!options.scopes || options.scopes.length === 0) throw new Error('OAuth scopes are required')
  if (!isHttpsUrl(options.authEndpoint)) throw new Error('OAuth authEndpoint must be an https URL')

  const policy = buildDesktopOAuthPolicy(options.provider, options.redirectUri)
  assertDesktopOAuthPolicy(policy)

  const codeVerifier = createPkceVerifier()
  const codeChallenge = createPkceChallenge(codeVerifier)
  const state = options.state?.trim() || createStateToken()

  const url = new URL(options.authEndpoint)
  url.searchParams.set('client_id', options.clientId)
  url.searchParams.set('redirect_uri', options.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  url.searchParams.set('scope', options.scopes.join(' '))

  for (const [key, value] of Object.entries(options.extraParams ?? {})) {
    if (value != null && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  return {
    provider: options.provider,
    authorizationUrl: url.toString(),
    redirectUri: options.redirectUri,
    state,
    codeVerifier,
    codeChallenge,
  }
}

export async function launchDesktopOAuthInExternalBrowser(request: DesktopOAuthAuthorizationRequest): Promise<void> {
  await shell.openExternal(request.authorizationUrl)
}
