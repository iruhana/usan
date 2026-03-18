const NAVER_OPENAPI_BASE = 'https://openapi.naver.com/v1/search'

export type NaverSearchKind = 'news' | 'blog' | 'cafearticle' | 'shop' | 'encyc'

export interface NaverSearchItem {
  title: string
  link: string
  description: string
  source?: string
  publishedAt?: string
}

export interface NaverSearchResponse {
  kind: NaverSearchKind
  total: number
  start: number
  display: number
  items: NaverSearchItem[]
}

interface RawNaverSearchItem {
  title?: string
  link?: string
  description?: string
  bloggername?: string
  cafeName?: string
  mallName?: string
  pubDate?: string
  postdate?: string
}

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

function getNaverClientId(): string {
  return process.env['USAN_NAVER_CLIENT_ID']?.trim() ?? ''
}

function getNaverClientSecret(): string {
  return process.env['USAN_NAVER_CLIENT_SECRET']?.trim() ?? ''
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39);/g, (match) => HTML_ENTITY_MAP[match] ?? match)
}

function stripHtml(value?: string): string {
  return decodeHtmlEntities((value ?? '').replace(/<[^>]+>/g, '')).trim()
}

function normalizePublishedAt(item: RawNaverSearchItem): string | undefined {
  if (item.pubDate) return item.pubDate

  const postDate = item.postdate?.trim()
  if (!postDate || !/^\d{8}$/.test(postDate)) return undefined

  const year = Number(postDate.slice(0, 4))
  const month = Number(postDate.slice(4, 6)) - 1
  const day = Number(postDate.slice(6, 8))
  return new Date(Date.UTC(year, month, day)).toISOString()
}

function normalizeSource(item: RawNaverSearchItem): string | undefined {
  return stripHtml(item.bloggername || item.cafeName || item.mallName) || undefined
}

export function isNaverSearchConfigured(): boolean {
  return Boolean(getNaverClientId() && getNaverClientSecret())
}

export async function searchNaver(options: {
  query: string
  kind?: NaverSearchKind
  display?: number
  start?: number
  sort?: string
}): Promise<NaverSearchResponse> {
  const clientId = getNaverClientId()
  const clientSecret = getNaverClientSecret()
  if (!clientId || !clientSecret) {
    throw new Error('Naver Search를 사용하려면 USAN_NAVER_CLIENT_ID와 USAN_NAVER_CLIENT_SECRET이 필요합니다.')
  }

  const query = options.query.trim()
  if (!query) {
    throw new Error('검색어를 입력해 주세요.')
  }

  const kind = options.kind ?? 'news'
  const display = Math.min(100, Math.max(1, Math.floor(options.display ?? 10)))
  const start = Math.min(1000, Math.max(1, Math.floor(options.start ?? 1)))

  const url = new URL(`${NAVER_OPENAPI_BASE}/${kind}.json`)
  url.searchParams.set('query', query)
  url.searchParams.set('display', String(display))
  url.searchParams.set('start', String(start))
  if (options.sort?.trim()) {
    url.searchParams.set('sort', options.sort.trim())
  }

  const response = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Naver Search 호출 실패 (${response.status}): ${details || response.statusText}`)
  }

  const payload = (await response.json()) as {
    total?: number
    start?: number
    display?: number
    items?: RawNaverSearchItem[]
  }

  return {
    kind,
    total: Number(payload.total ?? 0),
    start: Number(payload.start ?? start),
    display: Number(payload.display ?? display),
    items: (payload.items ?? []).map((item) => ({
      title: stripHtml(item.title),
      link: item.link?.trim() ?? '',
      description: stripHtml(item.description),
      source: normalizeSource(item),
      publishedAt: normalizePublishedAt(item),
    })),
  }
}
