import type { OAuthAccountProfile } from '../auth/oauth-desktop'

const KAKAO_API_BASE = 'https://kapi.kakao.com'
const DEFAULT_LINK_URL = 'https://usan.ai'

export interface KakaoProfile extends OAuthAccountProfile {
  id: string
}

export async function getKakaoProfile(accessToken: string): Promise<KakaoProfile> {
  const response = await fetch(`${KAKAO_API_BASE}/v2/user/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`카카오 사용자 정보 조회 실패 (${response.status}): ${details || response.statusText}`)
  }

  const payload = (await response.json()) as {
    id: number | string
    properties?: {
      nickname?: string
      profile_image?: string
      thumbnail_image?: string
    }
    kakao_account?: {
      email?: string
      profile?: {
        nickname?: string
        profile_image_url?: string
        thumbnail_image_url?: string
      }
    }
  }

  const profile = payload.kakao_account?.profile
  const properties = payload.properties

  return {
    id: String(payload.id),
    nickname: profile?.nickname ?? properties?.nickname,
    email: payload.kakao_account?.email,
    avatarUrl:
      profile?.profile_image_url ??
      properties?.profile_image ??
      profile?.thumbnail_image_url ??
      properties?.thumbnail_image,
  }
}

export async function logoutKakaoAccessToken(accessToken: string): Promise<void> {
  await fetch(`${KAKAO_API_BASE}/v1/user/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    signal: AbortSignal.timeout(15000),
  }).catch(() => {})
}

export async function sendKakaoMemo(
  accessToken: string,
  options: {
    text: string
    webUrl?: string
    mobileWebUrl?: string
    buttonTitle?: string
  },
): Promise<{ success: boolean; warning?: string }> {
  const text = options.text.trim()
  if (!text) {
    throw new Error('카카오톡 메시지 본문을 입력해 주세요.')
  }

  const webUrl = options.webUrl?.trim() || DEFAULT_LINK_URL
  const mobileWebUrl = options.mobileWebUrl?.trim() || webUrl
  const templateObject = {
    object_type: 'text',
    text,
    link: {
      web_url: webUrl,
      mobile_web_url: mobileWebUrl,
    },
    ...(options.buttonTitle?.trim() ? { button_title: options.buttonTitle.trim() } : {}),
  }

  const body = new URLSearchParams({
    template_object: JSON.stringify(templateObject),
  })

  const response = await fetch(`${KAKAO_API_BASE}/v2/api/talk/memo/default/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body,
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`카카오톡 나에게 보내기 실패 (${response.status}): ${details || response.statusText}`)
  }

  const payload = (await response.json()) as { result_code?: number; warning_msg?: string }
  return {
    success: payload.result_code === 0,
    warning: payload.warning_msg,
  }
}
