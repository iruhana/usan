import type {
  PublicBusinessStatusEntry,
  PublicDataQuery,
  PublicDataQueryResult,
} from '@shared/types/ipc'
import type { StoredPublicDataAccountConfig } from './public-data-account-store'

export class PublicDataApiError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

function buildRequestUrl(
  config: StoredPublicDataAccountConfig,
  path?: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): URL {
  const targetPath = path?.trim() || config.defaultPath?.trim()
  if (!targetPath) {
    throw new Error('Missing public data endpoint path')
  }

  const url = new URL(
    targetPath.startsWith('http://') || targetPath.startsWith('https://')
      ? targetPath
      : `${config.apiBaseUrl}/${targetPath.replace(/^\/+/, '')}`,
  )

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value == null || value === '') continue
    url.searchParams.set(key, String(value))
  }

  if (config.authMode === 'query' || config.authMode === 'both') {
    url.searchParams.set('serviceKey', config.serviceKey)
  }

  return url
}

function getAuthHeaders(config: StoredPublicDataAccountConfig): Record<string, string> {
  if (config.authMode !== 'header' && config.authMode !== 'both') {
    return {}
  }

  return {
    Authorization: config.serviceKey,
  }
}

function sanitizeBusinessNumbers(businessNumbers: string[]): string[] {
  const seen = new Set<string>()
  const sanitized: string[] = []
  for (const businessNumber of businessNumbers) {
    const digits = businessNumber.replace(/\D/g, '')
    if (digits.length !== 10 || seen.has(digits)) continue
    seen.add(digits)
    sanitized.push(digits)
  }
  return sanitized
}

function extractStatusArray(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) {
    return body.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  }

  if (!body || typeof body !== 'object') return []
  const candidate = body as Record<string, unknown>

  const keys = ['data', 'items', 'results', 'result', 'list']
  for (const key of keys) {
    const value = candidate[key]
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    }
  }

  return []
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return undefined
}

export async function requestPublicData(
  config: StoredPublicDataAccountConfig,
  request: PublicDataQuery,
): Promise<PublicDataQueryResult> {
  const method = request.method === 'POST' ? 'POST' : 'GET'
  const url = buildRequestUrl(config, request.path, request.query)
  const headers: Record<string, string> = {
    ...getAuthHeaders(config),
  }

  let body: string | undefined
  if (method === 'POST' && request.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(request.body)
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  })

  const contentType = response.headers.get('content-type') ?? undefined
  const shouldReadAsJson =
    request.responseType === 'json' ||
    (request.responseType !== 'text' && Boolean(contentType?.includes('json')))
  const parsedBody = shouldReadAsJson ? await response.json().catch(() => null) : await response.text()

  if (!response.ok) {
    throw new PublicDataApiError(
      `Public data request failed with status ${response.status}`,
      response.status,
      parsedBody,
    )
  }

  return {
    ok: response.ok,
    status: response.status,
    url: response.url || url.toString(),
    contentType,
    body: parsedBody,
  }
}

export async function lookupPublicBusinessStatus(
  config: StoredPublicDataAccountConfig,
  businessNumbers: string[],
  pathOverride?: string,
): Promise<PublicBusinessStatusEntry[]> {
  const normalizedNumbers = sanitizeBusinessNumbers(businessNumbers)
  if (normalizedNumbers.length === 0) {
    throw new Error('At least one valid business number is required')
  }

  const response = await requestPublicData(config, {
    path: pathOverride || '/api/nts-businessman/v1/status',
    method: 'POST',
    body: { b_no: normalizedNumbers },
    responseType: 'json',
  })

  return extractStatusArray(response.body).map((item) => ({
    businessNumber:
      coerceString(item['b_no']) ||
      coerceString(item['businessNumber']) ||
      coerceString(item['bizNo']) ||
      '',
    statusCode: coerceString(item['b_stt_cd']) || coerceString(item['statusCode']),
    statusText: coerceString(item['b_stt']) || coerceString(item['statusText']) || coerceString(item['status']),
    taxType: coerceString(item['tax_type']) || coerceString(item['taxType']),
    closedOn: coerceString(item['end_dt']) || coerceString(item['closedOn']) || coerceString(item['closeDate']),
    openedOn: coerceString(item['start_dt']) || coerceString(item['openedOn']) || coerceString(item['openDate']),
    raw: item,
  }))
}
