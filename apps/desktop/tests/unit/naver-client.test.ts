import { afterEach, describe, expect, it, vi } from 'vitest'
import { isNaverSearchConfigured, searchNaver } from '../../src/main/naver/naver-client'

const originalFetch = global.fetch
const originalClientId = process.env['USAN_NAVER_CLIENT_ID']
const originalClientSecret = process.env['USAN_NAVER_CLIENT_SECRET']

describe('naver-client', () => {
  afterEach(() => {
    global.fetch = originalFetch
    process.env['USAN_NAVER_CLIENT_ID'] = originalClientId
    process.env['USAN_NAVER_CLIENT_SECRET'] = originalClientSecret
    vi.restoreAllMocks()
  })

  it('returns false when Naver credentials are missing', () => {
    delete process.env['USAN_NAVER_CLIENT_ID']
    delete process.env['USAN_NAVER_CLIENT_SECRET']

    expect(isNaverSearchConfigured()).toBe(false)
  })

  it('normalizes Naver search results', async () => {
    process.env['USAN_NAVER_CLIENT_ID'] = 'naver-id'
    process.env['USAN_NAVER_CLIENT_SECRET'] = 'naver-secret'

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      total: 1,
      start: 1,
      display: 1,
      items: [
        {
          title: '<b>우산</b> 뉴스',
          link: 'https://example.com/news/1',
          description: '생활을 <b>돕는</b> 서비스',
          bloggername: '우산팀',
          pubDate: 'Wed, 19 Mar 2026 10:00:00 +0900',
        },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    global.fetch = fetchMock as typeof fetch

    const result = await searchNaver({ query: '우산', kind: 'news' })

    expect(result.kind).toBe('news')
    expect(result.items[0]).toEqual({
      title: '우산 뉴스',
      link: 'https://example.com/news/1',
      description: '생활을 돕는 서비스',
      source: '우산팀',
      publishedAt: 'Wed, 19 Mar 2026 10:00:00 +0900',
    })
  })
})
