import type {
  HometaxEvidenceEntry,
  HometaxEvidenceQuery,
  TaxBusinessStatusEntry,
  TaxBusinessStatusLookup,
} from '@shared/types/ipc'
import type { StoredTaxAccountConfig } from './tax-account-store'

export class BarobillApiError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

function buildBarobillUrl(
  config: StoredTaxAccountConfig,
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): URL {
  const url = new URL(
    path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${config.apiBaseUrl}/${path.replace(/^\/+/, '')}`,
  )

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value == null || value === '') continue
    url.searchParams.set(key, String(value))
  }

  if (config.authMode === 'query') {
    url.searchParams.set('apiKey', config.apiKey)
  }

  return url
}

function buildBarobillHeaders(config: StoredTaxAccountConfig): Record<string, string> {
  const headers: Record<string, string> = {}

  if (config.authMode === 'header') {
    headers['X-API-Key'] = config.apiKey
  } else if (config.authMode === 'bearer') {
    headers.Authorization = `Bearer ${config.apiKey}`
  }

  if (config.memberId) headers['X-Barobill-Member-Id'] = config.memberId
  if (config.corporationNumber) headers['X-Barobill-Corp-Num'] = config.corporationNumber
  if (config.userId) headers['X-Barobill-User-Id'] = config.userId

  return headers
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

function extractRecordList(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) {
    return body.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  }

  if (!body || typeof body !== 'object') return []
  const candidate = body as Record<string, unknown>
  const keys = ['data', 'items', 'results', 'result', 'list', 'rows']

  for (const key of keys) {
    const value = candidate[key]
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    }
  }

  return []
}

async function requestBarobillJson(
  config: StoredTaxAccountConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const url = buildBarobillUrl(config, path)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildBarobillHeaders(config),
    },
    body: JSON.stringify(body),
  })

  const parsed = await response.json().catch(async () => response.text())
  if (!response.ok) {
    throw new BarobillApiError(
      `Barobill request failed with status ${response.status}`,
      response.status,
      parsed,
    )
  }

  return parsed
}

export async function lookupBarobillBusinessStatus(
  config: StoredTaxAccountConfig,
  lookup: TaxBusinessStatusLookup,
): Promise<TaxBusinessStatusEntry[]> {
  const targetPath = lookup.pathOverride?.trim() || config.businessStatePath?.trim()
  if (!targetPath) {
    throw new Error('Barobill business state path is not configured')
  }

  const businessNumbers = sanitizeBusinessNumbers(lookup.businessNumbers)
  if (businessNumbers.length === 0) {
    throw new Error('At least one valid business number is required')
  }

  const response = await requestBarobillJson(config, targetPath, {
    businessNumbers,
    memberId: config.memberId,
    corporationNumber: config.corporationNumber,
    userId: config.userId,
  })

  return extractRecordList(response).map((item) => ({
    businessNumber:
      coerceString(item['businessNumber']) ||
      coerceString(item['corpNum']) ||
      coerceString(item['corp_no']) ||
      coerceString(item['b_no']) ||
      '',
    statusText:
      coerceString(item['statusText']) ||
      coerceString(item['status']) ||
      coerceString(item['b_stt']) ||
      coerceString(item['state']),
    taxType:
      coerceString(item['taxType']) ||
      coerceString(item['tax_type']) ||
      coerceString(item['tax_type_nm']),
    closedOn:
      coerceString(item['closedOn']) ||
      coerceString(item['closeDate']) ||
      coerceString(item['end_dt']),
    raw: item,
  }))
}

export async function queryBarobillHometaxEvidence(
  config: StoredTaxAccountConfig,
  query: HometaxEvidenceQuery,
): Promise<HometaxEvidenceEntry[]> {
  const targetPath = query.pathOverride?.trim() || config.hometaxPath?.trim()
  if (!targetPath) {
    throw new Error('Barobill hometax path is not configured')
  }

  const response = await requestBarobillJson(config, targetPath, {
    memberId: config.memberId,
    corporationNumber: config.corporationNumber,
    userId: config.userId,
    businessNumber: query.businessNumber?.replace(/\D/g, '') || undefined,
    counterpartyNumber: query.counterpartyNumber?.replace(/\D/g, '') || undefined,
    fromDate: query.fromDate,
    toDate: query.toDate,
    direction: query.direction ?? 'all',
    documentType: query.documentType ?? 'all',
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 50,
  })

  return extractRecordList(response).map((item, index) => ({
    id:
      coerceString(item['id']) ||
      coerceString(item['invoiceId']) ||
      coerceString(item['documentNumber']) ||
      coerceString(item['txId']) ||
      `hometax-${index + 1}`,
    issuedAt:
      coerceString(item['issuedAt']) ||
      coerceString(item['issueDate']) ||
      coerceString(item['writeDate']) ||
      coerceString(item['regDate']),
    direction:
      coerceString(item['direction']) ||
      coerceString(item['tradeType']) ||
      coerceString(item['kind']),
    documentType:
      coerceString(item['documentType']) ||
      coerceString(item['evidenceType']) ||
      coerceString(item['invoiceType']),
    counterpartyName:
      coerceString(item['counterpartyName']) ||
      coerceString(item['customerName']) ||
      coerceString(item['supplierName']) ||
      coerceString(item['tradeName']),
    counterpartyNumber:
      coerceString(item['counterpartyNumber']) ||
      coerceString(item['buyerCorpNum']) ||
      coerceString(item['sellerCorpNum']) ||
      coerceString(item['bizNo']),
    supplyAmount:
      coerceString(item['supplyAmount']) ||
      coerceString(item['supplyCost']) ||
      coerceString(item['supplyPrice']),
    taxAmount:
      coerceString(item['taxAmount']) ||
      coerceString(item['tax']) ||
      coerceString(item['vat']),
    totalAmount:
      coerceString(item['totalAmount']) ||
      coerceString(item['totalPrice']) ||
      coerceString(item['amount']),
    status:
      coerceString(item['status']) ||
      coerceString(item['state']) ||
      coerceString(item['progress']),
    summary:
      coerceString(item['summary']) ||
      coerceString(item['remark']) ||
      coerceString(item['description']) ||
      coerceString(item['title']),
    raw: item,
  }))
}
