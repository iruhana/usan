import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import {
  clearKakaoTokens,
  getKakaoAccessToken,
  getKakaoAuthStatus,
  startKakaoOAuthFlow,
} from '../../auth/oauth-kakao'
import {
  clearNaverTokens,
  getNaverAuthStatus,
  startNaverOAuthFlow,
} from '../../auth/oauth-naver'
import { sendKakaoMemo } from '../../kakao/kakao-client'
import { isNaverSearchConfigured, searchNaver } from '../../naver/naver-client'

export const definitions: ProviderTool[] = [
  {
    name: 'naver_search',
    description: '네이버 검색 API로 뉴스, 블로그, 카페, 쇼핑, 백과 결과를 조회합니다.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색어' },
        kind: {
          type: 'string',
          enum: ['news', 'blog', 'cafearticle', 'shop', 'encyc'],
          description: '검색 종류',
        },
        display: { type: 'number', description: '결과 개수 (기본 10, 최대 100)' },
        start: { type: 'number', description: '시작 위치 (기본 1, 최대 1000)' },
        sort: { type: 'string', description: '정렬 방식. news는 sim/date 사용 가능' },
      },
      required: ['query'],
    },
  },
  {
    name: 'naver_news_search',
    description: '네이버 뉴스 검색 결과를 조회합니다.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색어' },
        display: { type: 'number', description: '결과 개수 (기본 10, 최대 100)' },
        start: { type: 'number', description: '시작 위치 (기본 1, 최대 1000)' },
        sort: { type: 'string', description: '정렬 방식: sim 또는 date' },
      },
      required: ['query'],
    },
  },
  {
    name: 'naver_oauth_start',
    description: '네이버 계정 연결을 시작합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'naver_oauth_status',
    description: '네이버 계정 연결 상태를 확인합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'naver_oauth_logout',
    description: '네이버 계정 연결을 해제합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'kakao_oauth_start',
    description: '카카오 계정 연결을 시작합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'kakao_oauth_status',
    description: '카카오 계정 연결 상태를 확인합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'kakao_oauth_logout',
    description: '카카오 계정 연결을 해제합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'kakao_send_to_me',
    description: '카카오톡 나에게 보내기 API로 메모를 전송합니다.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '메시지 본문' },
        webUrl: { type: 'string', description: '버튼/본문 링크로 사용할 웹 주소' },
        mobileWebUrl: { type: 'string', description: '모바일 링크 주소' },
        buttonTitle: { type: 'string', description: '버튼 제목' },
      },
      required: ['text'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async naver_search(args) {
    if (!isNaverSearchConfigured()) {
      return { error: 'Naver Search를 사용하려면 USAN_NAVER_CLIENT_ID와 USAN_NAVER_CLIENT_SECRET을 설정해 주세요.' }
    }

    return searchNaver({
      query: String(args.query ?? ''),
      kind: (args.kind as 'news' | 'blog' | 'cafearticle' | 'shop' | 'encyc' | undefined) ?? 'news',
      display: typeof args.display === 'number' ? args.display : undefined,
      start: typeof args.start === 'number' ? args.start : undefined,
      sort: typeof args.sort === 'string' ? args.sort : undefined,
    })
  },

  async naver_news_search(args) {
    if (!isNaverSearchConfigured()) {
      return { error: 'Naver Search를 사용하려면 USAN_NAVER_CLIENT_ID와 USAN_NAVER_CLIENT_SECRET을 설정해 주세요.' }
    }

    return searchNaver({
      query: String(args.query ?? ''),
      kind: 'news',
      display: typeof args.display === 'number' ? args.display : undefined,
      start: typeof args.start === 'number' ? args.start : undefined,
      sort: typeof args.sort === 'string' ? args.sort : undefined,
    })
  },

  async naver_oauth_start() {
    return startNaverOAuthFlow()
  },

  async naver_oauth_status() {
    return getNaverAuthStatus()
  },

  async naver_oauth_logout() {
    return clearNaverTokens()
  },

  async kakao_oauth_start() {
    return startKakaoOAuthFlow()
  },

  async kakao_oauth_status() {
    return getKakaoAuthStatus()
  },

  async kakao_oauth_logout() {
    return clearKakaoTokens()
  },

  async kakao_send_to_me(args) {
    const accessToken = await getKakaoAccessToken()
    if (!accessToken) {
      return { error: '카카오 계정을 먼저 연결해 주세요.' }
    }

    return sendKakaoMemo(accessToken, {
      text: String(args.text ?? ''),
      webUrl: typeof args.webUrl === 'string' ? args.webUrl : undefined,
      mobileWebUrl: typeof args.mobileWebUrl === 'string' ? args.mobileWebUrl : undefined,
      buttonTitle: typeof args.buttonTitle === 'string' ? args.buttonTitle : undefined,
    })
  },
}
