import { createServer } from 'http'
import { readFileSync } from 'fs'
import { unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { decryptString, encryptString } from '../security'
import {
  createDesktopOAuthAuthorizationRequest,
  launchDesktopOAuthInExternalBrowser,
  type OAuthProvider,
} from './oauth-policy'

export interface OAuthAccountProfile {
  id: string
  name?: string
  nickname?: string
  email?: string
  avatarUrl?: string
}

export interface StoredDesktopOAuthTokens<TProfile extends OAuthAccountProfile = OAuthAccountProfile> {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  scope: string
  tokenType?: string
  profile?: TProfile
}

export interface DesktopOAuthTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number | string
  scope?: string
  token_type?: string
}

interface StartDesktopOAuthFlowOptions<
  TProfile extends OAuthAccountProfile,
  TResponse extends DesktopOAuthTokenResponse,
> {
  provider: OAuthProvider
  clientId: string
  authEndpoint: string
  tokenFilename: string
  scopes: string[]
  redirectPort: number
  extraAuthParams?: Record<string, string>
  exchangeCode: (params: {
    clientId: string
    code: string
    redirectUri: string
    codeVerifier: string
    state: string
  }) => Promise<TResponse>
  fetchProfile?: (accessToken: string) => Promise<TProfile>
  getMissingClientError?: () => string
}

function getTokenPath(filename: string): string {
  return join(app.getPath('userData'), filename)
}

export function loadDesktopOAuthTokens<TProfile extends OAuthAccountProfile = OAuthAccountProfile>(
  filename: string,
): StoredDesktopOAuthTokens<TProfile> | null {
  try {
    const encrypted = readFileSync(getTokenPath(filename))
    return JSON.parse(decryptString(encrypted)) as StoredDesktopOAuthTokens<TProfile>
  } catch {
    return null
  }
}

export async function saveDesktopOAuthTokens<TProfile extends OAuthAccountProfile = OAuthAccountProfile>(
  filename: string,
  tokens: StoredDesktopOAuthTokens<TProfile>,
): Promise<void> {
  const encrypted = encryptString(JSON.stringify(tokens))
  await writeFile(getTokenPath(filename), encrypted)
}

export async function clearDesktopOAuthTokens(filename: string): Promise<void> {
  await unlink(getTokenPath(filename)).catch(() => {})
}

export function splitOAuthScope(scope?: string): string[] {
  return (scope ?? '')
    .split(/[\s,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseExpiresIn(expiresIn?: number | string): number {
  const seconds = Number(expiresIn ?? 3600)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 3600
}

function renderCallbackPage(title: string, body: string): string {
  return [
    '<html><body style="font-family:Segoe UI, sans-serif; padding:24px;">',
    `<h2>${title}</h2>`,
    `<p>${body}</p>`,
    '</body></html>',
  ].join('')
}

export async function startDesktopOAuthFlow<
  TProfile extends OAuthAccountProfile,
  TResponse extends DesktopOAuthTokenResponse,
>(
  options: StartDesktopOAuthFlowOptions<TProfile, TResponse>,
): Promise<{ success: boolean; error?: string }> {
  if (!options.clientId.trim()) {
    return {
      success: false,
      error: options.getMissingClientError?.() ?? 'OAuth 클라이언트 정보가 설정되지 않았습니다.',
    }
  }

  return new Promise((resolve) => {
    const server = createServer()
    let settled = false

    const finalize = (result: { success: boolean; error?: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      server.close()
      resolve(result)
    }

    const timeout = setTimeout(() => {
      finalize({ success: false, error: 'OAuth 인증 시간이 초과되었습니다. 다시 시도해 주세요.' })
    }, 120_000)

    server.on('error', (error) => {
      finalize({
        success: false,
        error: `로컬 인증 포트 ${options.redirectPort}를 열 수 없습니다: ${(error as Error).message}`,
      })
    })

    server.listen(options.redirectPort, '127.0.0.1', async () => {
      const redirectUri = `http://127.0.0.1:${options.redirectPort}/callback`
      const request = createDesktopOAuthAuthorizationRequest({
        provider: options.provider,
        clientId: options.clientId,
        authEndpoint: options.authEndpoint,
        redirectUri,
        scopes: options.scopes,
        extraParams: options.extraAuthParams,
      })

      server.on('request', async (req, res) => {
        if (settled) return

        const url = new URL(req.url || '/', redirectUri)
        if (url.pathname !== '/callback') {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const error = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(renderCallbackPage('연결이 취소되었습니다', '브라우저 창을 닫고 우산으로 돌아오세요.'))
          finalize({
            success: false,
            error: errorDescription ? `${error}: ${errorDescription}` : error,
          })
          return
        }

        if (!code || state !== request.state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(renderCallbackPage('잘못된 요청입니다', '브라우저 창을 닫고 다시 시도해 주세요.'))
          finalize({ success: false, error: 'OAuth 콜백 검증에 실패했습니다.' })
          return
        }

        try {
          const tokenResponse = await options.exchangeCode({
            clientId: options.clientId,
            code,
            redirectUri,
            codeVerifier: request.codeVerifier,
            state: request.state,
          })

          const tokens: StoredDesktopOAuthTokens<TProfile> = {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            expiresAt: Date.now() + parseExpiresIn(tokenResponse.expires_in) * 1000,
            scope: tokenResponse.scope || options.scopes.join(' '),
            tokenType: tokenResponse.token_type,
          }

          if (options.fetchProfile) {
            tokens.profile = await options.fetchProfile(tokens.accessToken).catch(() => undefined)
          }

          await saveDesktopOAuthTokens(options.tokenFilename, tokens)

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(renderCallbackPage('연결이 완료되었습니다', '이 창을 닫고 우산으로 돌아오세요.'))
          finalize({ success: true })
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(renderCallbackPage('토큰 발급에 실패했습니다', '설정을 확인한 뒤 다시 시도해 주세요.'))
          finalize({ success: false, error: (error as Error).message })
        }
      })

      await launchDesktopOAuthInExternalBrowser(request)
    })
  })
}
