/**
 * Google OAuth flow for desktop — loopback server + token persistence via safeStorage.
 * Handles Gmail + Calendar scopes in a single consent flow.
 */
import { createServer } from 'http'
import { readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { encryptString, decryptString } from '../security'
import {
  createDesktopOAuthAuthorizationRequest,
  launchDesktopOAuthInExternalBrowser,
} from './oauth-policy'

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

const COMBINED_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
]

interface StoredTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // epoch ms
  scope: string
}

const TOKEN_FILENAME = 'google-oauth-tokens.enc'

function getTokenPath(): string {
  return join(app.getPath('userData'), TOKEN_FILENAME)
}

export function loadGoogleTokens(): StoredTokens | null {
  try {
    const encrypted = readFileSync(getTokenPath())
    const json = decryptString(encrypted)
    return JSON.parse(json) as StoredTokens
  } catch {
    return null
  }
}

async function saveGoogleTokens(tokens: StoredTokens): Promise<void> {
  const encrypted = encryptString(JSON.stringify(tokens))
  await writeFile(getTokenPath(), encrypted)
}

export async function clearGoogleTokens(): Promise<void> {
  const { unlink } = await import('fs/promises')
  await unlink(getTokenPath()).catch(() => {})
}

/**
 * Get a valid Google access token, refreshing if expired.
 * Returns null if not authenticated.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  const tokens = loadGoogleTokens()
  if (!tokens) return null

  // Refresh if expired (with 60s buffer)
  if (Date.now() > tokens.expiresAt - 60_000) {
    const clientId = getGoogleClientId()
    if (!clientId || !tokens.refreshToken) return null

    try {
      const refreshed = await refreshGoogleToken(clientId, tokens.refreshToken)
      const updated: StoredTokens = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token || tokens.refreshToken,
        expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
        scope: refreshed.scope || tokens.scope,
      }
      await saveGoogleTokens(updated)
      return updated.accessToken
    } catch {
      return null
    }
  }

  return tokens.accessToken
}

export function isGoogleAuthenticated(): boolean {
  return loadGoogleTokens() !== null
}

function getGoogleClientId(): string {
  return process.env['USAN_GOOGLE_CLIENT_ID']?.trim() ?? ''
}

/**
 * Start the full Google OAuth flow:
 * 1. Start loopback HTTP server on a random port
 * 2. Open browser with authorization URL
 * 3. Wait for callback with authorization code
 * 4. Exchange code for tokens
 * 5. Save tokens via safeStorage
 */
export async function startGoogleOAuthFlow(clientId?: string): Promise<{ success: boolean; error?: string }> {
  const resolvedClientId = clientId || getGoogleClientId()
  if (!resolvedClientId) {
    return { success: false, error: 'Google OAuth Client ID가 설정되지 않았습니다.' }
  }

  return new Promise((resolve) => {
    const server = createServer()
    let resolved = false

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        server.close()
        resolve({ success: false, error: 'OAuth 인증 시간이 초과되었습니다. (2분)' })
      }
    }, 120_000)

    server.listen(0, '127.0.0.1', async () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        resolved = true
        clearTimeout(timeout)
        server.close()
        resolve({ success: false, error: '로컬 서버를 시작할 수 없습니다.' })
        return
      }

      const port = address.port
      const redirectUri = `http://127.0.0.1:${port}/callback`

      const request = createDesktopOAuthAuthorizationRequest({
        provider: 'google',
        clientId: resolvedClientId,
        authEndpoint: GOOGLE_AUTH_ENDPOINT,
        redirectUri,
        scopes: COMBINED_SCOPES,
        extraParams: {
          access_type: 'offline',
          prompt: 'consent',
          include_granted_scopes: 'true',
        },
      })

      server.on('request', async (req, res) => {
        if (resolved) return

        const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
        if (url.pathname !== '/callback') {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const error = url.searchParams.get('error')

        if (error) {
          resolved = true
          clearTimeout(timeout)
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<html><body><h2>인증 실패</h2><p>브라우저를 닫아주세요.</p></body></html>')
          server.close()
          resolve({ success: false, error: `OAuth 오류: ${error}` })
          return
        }

        if (!code || state !== request.state) {
          resolved = true
          clearTimeout(timeout)
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<html><body><h2>잘못된 요청</h2></body></html>')
          server.close()
          resolve({ success: false, error: '잘못된 OAuth 콜백입니다.' })
          return
        }

        // Exchange code for tokens
        try {
          const tokenResponse = await exchangeCodeForTokens(
            resolvedClientId,
            code,
            redirectUri,
            request.codeVerifier,
          )

          const tokens: StoredTokens = {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token || '',
            expiresAt: Date.now() + (tokenResponse.expires_in ?? 3600) * 1000,
            scope: tokenResponse.scope || COMBINED_SCOPES.join(' '),
          }

          await saveGoogleTokens(tokens)

          resolved = true
          clearTimeout(timeout)
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<html><body><h2>인증 완료!</h2><p>이 창을 닫고 우산으로 돌아가세요.</p></body></html>')
          server.close()
          resolve({ success: true })
        } catch (err) {
          resolved = true
          clearTimeout(timeout)
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<html><body><h2>토큰 교환 실패</h2></body></html>')
          server.close()
          resolve({ success: false, error: (err as Error).message })
        }
      })

      // Open browser
      await launchDesktopOAuthInExternalBrowser(request)
    })
  })
}

interface TokenExchangeResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

async function exchangeCodeForTokens(
  clientId: string,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<TokenExchangeResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`토큰 교환 실패 (${response.status}): ${details || response.statusText}`)
  }

  return (await response.json()) as TokenExchangeResponse
}

async function refreshGoogleToken(
  clientId: string,
  refreshToken: string,
): Promise<TokenExchangeResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`토큰 갱신 실패 (${response.status}): ${details || response.statusText}`)
  }

  return (await response.json()) as TokenExchangeResponse
}
