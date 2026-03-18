import type {
  FinanceAccountSummary,
  FinanceTransactionQuery,
  FinanceTransferDraft,
  FinanceTransferResult,
} from '@shared/types/ipc'
import type { StoredFinanceAccountConfig } from './finance-account-store'

export class OpenBankingApiError extends Error {
  readonly status: number
  readonly details?: unknown

  constructor(message: string, status = 500, details?: unknown) {
    super(message)
    this.name = 'OpenBankingApiError'
    this.status = status
    this.details = details
  }
}

export interface OpenBankingTokenSet {
  accessToken: string
  refreshToken?: string
  scope?: string
  userSeqNo?: string
}

interface OpenBankingJsonResponse {
  rsp_code?: string
  rsp_message?: string
  [key: string]: unknown
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function buildApiUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string | number | undefined>,
): URL {
  const url = new URL(`${trimTrailingSlash(baseUrl)}${path}`)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null || value === '') continue
    url.searchParams.set(key, String(value))
  }
  return url
}

function createBankTranId(): string {
  const prefix = (process.env['USAN_OPENBANKING_TRAN_PREFIX']?.trim() || 'T991234567').slice(0, 10)
  const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, '0')}`
  return `${prefix}U${suffix}`.slice(0, 20)
}

function createApiTranDtm(date = new Date()): string {
  const pad = (value: number, size = 2) => String(value).padStart(size, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    pad(date.getMilliseconds(), 3),
  ].join('')
}

function formatDateOnly(input: string | undefined, fallback: Date): string {
  const value = input?.trim()
  if (!value) {
    return createApiTranDtm(fallback).slice(0, 8)
  }

  const digits = value.replace(/[^0-9]/g, '')
  if (digits.length === 8) {
    return digits
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid finance transaction date')
  }
  return createApiTranDtm(parsed).slice(0, 8)
}

function parseJsonResponse(text: string): OpenBankingJsonResponse {
  if (!text.trim()) {
    return {}
  }

  try {
    return JSON.parse(text) as OpenBankingJsonResponse
  } catch {
    throw new OpenBankingApiError('Open Banking API returned invalid JSON', 502, text)
  }
}

function getResponseMessage(payload: OpenBankingJsonResponse, fallback: string): string {
  return typeof payload.rsp_message === 'string' && payload.rsp_message.trim()
    ? payload.rsp_message
    : fallback
}

async function requestOpenBanking<T extends OpenBankingJsonResponse>(
  config: StoredFinanceAccountConfig,
  path: string,
  init: RequestInit,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = buildApiUrl(config.apiBaseUrl, path, params)
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
      ...(init.headers ?? {}),
    },
  })

  const text = await response.text()
  const payload = parseJsonResponse(text)

  if (!response.ok) {
    throw new OpenBankingApiError(
      getResponseMessage(payload, `Open Banking API request failed with status ${response.status}`),
      response.status,
      payload,
    )
  }

  const rspCode = typeof payload.rsp_code === 'string' ? payload.rsp_code : 'A0000'
  if (!['A0000', '0000'].includes(rspCode)) {
    throw new OpenBankingApiError(
      getResponseMessage(payload, 'Open Banking API returned an error response'),
      response.status || 400,
      payload,
    )
  }

  return payload as T
}

function getOAuthBaseUrl(config: StoredFinanceAccountConfig): string {
  const override = process.env['USAN_OPENBANKING_OAUTH_BASE_URL']?.trim()
  return trimTrailingSlash(override || config.apiBaseUrl)
}

export async function refreshOpenBankingToken(
  config: StoredFinanceAccountConfig,
): Promise<OpenBankingTokenSet> {
  if (!config.refreshToken) {
    throw new Error('No Open Banking refresh token is stored')
  }
  if (!config.clientSecret) {
    throw new Error('Client secret is required to refresh the Open Banking token')
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
  })

  const response = await fetch(`${getOAuthBaseUrl(config)}/oauth/2.0/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: body.toString(),
  })

  const text = await response.text()
  const payload = parseJsonResponse(text)

  if (!response.ok) {
    throw new OpenBankingApiError(
      getResponseMessage(payload, `Open Banking token refresh failed with status ${response.status}`),
      response.status,
      payload,
    )
  }

  const accessToken = typeof payload.access_token === 'string' ? payload.access_token.trim() : ''
  if (!accessToken) {
    throw new OpenBankingApiError('Open Banking token refresh did not return an access token', response.status, payload)
  }

  return {
    accessToken,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token.trim() : config.refreshToken,
    scope: typeof payload.scope === 'string' ? payload.scope.trim() : config.scope,
    userSeqNo: typeof payload.user_seq_no === 'string' ? payload.user_seq_no.trim() : config.userSeqNo,
  }
}

export async function fetchOpenBankingAccountSummary(
  config: StoredFinanceAccountConfig,
): Promise<FinanceAccountSummary> {
  const payload = await requestOpenBanking<OpenBankingJsonResponse>(
    config,
    '/v2.0/account/balance/fin_num',
    { method: 'GET' },
    {
      bank_tran_id: createBankTranId(),
      fintech_use_num: config.fintechUseNum,
      tran_dtime: createApiTranDtm(),
    },
  )

  return {
    fintechUseNum: String(payload.fintech_use_num ?? config.fintechUseNum),
    accountAlias:
      (typeof payload.account_alias === 'string' && payload.account_alias.trim()) ||
      config.accountAlias,
    bankName: (typeof payload.bank_name === 'string' && payload.bank_name.trim()) || config.bankName,
    accountMask:
      (typeof payload.account_num_masked === 'string' && payload.account_num_masked.trim()) ||
      (typeof payload.account_num === 'string' && payload.account_num.trim()) ||
      config.accountMask,
    balance: String(payload.balance_amt ?? payload.available_amt ?? config.lastBalance ?? '0'),
    availableAmount:
      payload.available_amt != null ? String(payload.available_amt) : undefined,
    currency: String(payload.currency ?? config.currency ?? 'KRW'),
    updatedAt: Date.now(),
  }
}

export async function fetchOpenBankingTransactions(
  config: StoredFinanceAccountConfig,
  query: FinanceTransactionQuery,
) {
  const now = new Date()
  const defaultFrom = new Date(now.getTime() - 30 * 86_400_000)
  const payload = await requestOpenBanking<OpenBankingJsonResponse>(
    config,
    '/v2.0/account/transaction_list/fin_num',
    { method: 'GET' },
    {
      bank_tran_id: createBankTranId(),
      fintech_use_num: config.fintechUseNum,
      inquiry_type: 'A',
      from_date: formatDateOnly(query.fromDate, defaultFrom),
      to_date: formatDateOnly(query.toDate, now),
      sort_order: query.sortOrder === 'A' ? 'A' : 'D',
      page_index: query.pageIndex ?? 1,
      page_record_cnt: Math.max(1, Math.min(query.limit ?? 20, 100)),
      tran_dtime: createApiTranDtm(),
    },
  )

  const resList = Array.isArray(payload.res_list) ? payload.res_list : []
  return resList.map((entry, index) => {
    const record = entry as Record<string, unknown>
    const tranDate = String(record.tran_date ?? '').trim()
    const tranTime = String(record.tran_time ?? '').trim()
    const identifier = String(record.bank_tran_id ?? `${tranDate}${tranTime}${index}`)

    return {
      id: identifier,
      postedAt: `${tranDate}${tranTime}`.trim(),
      kind:
        typeof record.inout_type === 'string'
          ? record.inout_type
          : typeof record.tran_type === 'string'
            ? record.tran_type
            : undefined,
      summary:
        String(record.print_content ?? record.branch_name ?? record.tran_type ?? '거래내역').trim(),
      amount: String(record.tran_amt ?? '0'),
      balanceAfter:
        record.after_balance_amt != null ? String(record.after_balance_amt) : undefined,
      branchName:
        typeof record.branch_name === 'string' ? record.branch_name.trim() : undefined,
    }
  })
}

export async function createOpenBankingTransfer(
  config: StoredFinanceAccountConfig,
  draft: FinanceTransferDraft,
): Promise<FinanceTransferResult> {
  const defaults = config.transferDefaults
  if (!defaults?.contractAccountNum) {
    throw new Error('Open Banking contract account number is missing in Settings')
  }
  if (!defaults.clientName || !defaults.clientIdentifier) {
    throw new Error('Request client information is missing in Settings')
  }
  if (!draft.toFintechUseNum && !(draft.toBankCode && draft.toAccountNum)) {
    throw new Error('A recipient fintech use number or bank/account number is required')
  }

  const amount = String(draft.amount ?? '').trim()
  if (!/^\d+$/.test(amount) || Number(amount) <= 0) {
    throw new Error('Transfer amount must be a positive integer string')
  }

  const endpoint = draft.toFintechUseNum
    ? '/v2.0/transfer/deposit/fin_num'
    : '/v2.0/transfer/deposit/acnt_num'
  const bankTranId = createBankTranId()
  const reqItem: Record<string, string> = {
    tran_no: '1',
    bank_tran_id: bankTranId,
    print_content: (draft.summary?.trim() || 'Usan transfer').slice(0, 20),
    tran_amt: amount,
    req_client_name: defaults.clientName,
    req_client_num: defaults.clientIdentifier,
    transfer_purpose: defaults.transferPurpose?.trim() || 'TR',
  }

  if (defaults.clientBankCode?.trim()) {
    reqItem.req_client_bank_code = defaults.clientBankCode.trim()
  }
  if (defaults.clientAccountNum?.trim()) {
    reqItem.req_client_account_num = defaults.clientAccountNum.trim()
  }

  if (draft.toFintechUseNum) {
    reqItem.fintech_use_num = draft.toFintechUseNum.trim()
  } else {
    reqItem.bank_code_std = draft.toBankCode!.trim()
    reqItem.account_num = draft.toAccountNum!.trim()
  }

  const payload = await requestOpenBanking<OpenBankingJsonResponse>(
    config,
    endpoint,
    {
      method: 'POST',
      body: JSON.stringify({
        cntr_account_type: defaults.contractAccountType?.trim() || 'N',
        cntr_account_num: defaults.contractAccountNum.trim(),
        wd_pass_phrase: defaults.withdrawPassPhrase?.trim() || 'NONE',
        wd_print_content: (defaults.withdrawPrintContent?.trim() || 'Usan payment').slice(0, 20),
        name_check_option: defaults.nameCheckOption === 'on' ? 'on' : 'off',
        tran_dtime: createApiTranDtm().slice(0, 14),
        req_cnt: '1',
        req_list: [reqItem],
      }),
    },
  )

  return {
    success: true,
    bankTranId,
    apiTranId: typeof payload.api_tran_id === 'string' ? payload.api_tran_id : undefined,
    message: getResponseMessage(payload, '이체 요청이 접수되었습니다.'),
    raw: payload,
  }
}
