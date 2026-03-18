import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const startNaverOAuthFlowMock = vi.fn()
const getNaverAuthStatusMock = vi.fn()
const clearNaverTokensMock = vi.fn()
const startKakaoOAuthFlowMock = vi.fn()
const getKakaoAuthStatusMock = vi.fn()
const clearKakaoTokensMock = vi.fn()
const getKakaoAccessTokenMock = vi.fn()
const sendKakaoMemoMock = vi.fn()
const isNaverSearchConfiguredMock = vi.fn()
const searchNaverMock = vi.fn()

vi.mock('../../src/main/auth/oauth-naver', () => ({
  startNaverOAuthFlow: () => startNaverOAuthFlowMock(),
  getNaverAuthStatus: () => getNaverAuthStatusMock(),
  clearNaverTokens: () => clearNaverTokensMock(),
}))

vi.mock('../../src/main/auth/oauth-kakao', () => ({
  startKakaoOAuthFlow: () => startKakaoOAuthFlowMock(),
  getKakaoAuthStatus: () => getKakaoAuthStatusMock(),
  clearKakaoTokens: () => clearKakaoTokensMock(),
  getKakaoAccessToken: () => getKakaoAccessTokenMock(),
}))

vi.mock('../../src/main/kakao/kakao-client', () => ({
  sendKakaoMemo: (...args: unknown[]) => sendKakaoMemoMock(...args),
}))

vi.mock('../../src/main/naver/naver-client', () => ({
  isNaverSearchConfigured: () => isNaverSearchConfiguredMock(),
  searchNaver: (...args: unknown[]) => searchNaverMock(...args),
}))

describe('korean-platform-tools', () => {
  beforeEach(() => {
    startNaverOAuthFlowMock.mockReset()
    getNaverAuthStatusMock.mockReset()
    clearNaverTokensMock.mockReset()
    startKakaoOAuthFlowMock.mockReset()
    getKakaoAuthStatusMock.mockReset()
    clearKakaoTokensMock.mockReset()
    getKakaoAccessTokenMock.mockReset()
    sendKakaoMemoMock.mockReset()
    isNaverSearchConfiguredMock.mockReset()
    searchNaverMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a configuration error when Naver search is unavailable', async () => {
    isNaverSearchConfiguredMock.mockReturnValue(false)

    const { handlers } = await import('../../src/main/ai/tools/korean-platform-tools')
    const result = await handlers.naver_search({ query: '우산' })

    expect((result as { error: string }).error).toContain('USAN_NAVER_CLIENT_ID')
  })

  it('routes Kakao send-to-me through the stored access token', async () => {
    getKakaoAccessTokenMock.mockResolvedValue('kakao-token')
    sendKakaoMemoMock.mockResolvedValue({ success: true })

    const { handlers } = await import('../../src/main/ai/tools/korean-platform-tools')
    const result = await handlers.kakao_send_to_me({ text: '안부 확인' })

    expect(sendKakaoMemoMock).toHaveBeenCalledWith('kakao-token', {
      text: '안부 확인',
      webUrl: undefined,
      mobileWebUrl: undefined,
      buttonTitle: undefined,
    })
    expect((result as { success: boolean }).success).toBe(true)
  })

  it('exposes the Kakao OAuth status handler', async () => {
    getKakaoAuthStatusMock.mockResolvedValue({
      provider: 'kakao',
      configured: true,
      authenticated: true,
      expiresAt: null,
      scopes: ['talk_message'],
    })

    const { handlers } = await import('../../src/main/ai/tools/korean-platform-tools')
    const result = await handlers.kakao_oauth_status({})

    expect((result as { authenticated: boolean }).authenticated).toBe(true)
  })
})
