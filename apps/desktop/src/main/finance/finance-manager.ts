import type {
  FinanceAccountConfigInput,
  FinanceAccountStatus,
  FinanceAccountSummary,
  FinanceTransactionQuery,
  FinanceTransferDraft,
  FinanceTransferResult,
} from '@shared/types/ipc'
import {
  clearFinanceAccountConfig,
  loadFinanceAccountConfig,
  normalizeFinanceAccountConfigInput,
  saveStoredFinanceAccountConfig,
  toFinanceAccountStatus,
  type StoredFinanceAccountConfig,
} from './finance-account-store'
import {
  createOpenBankingTransfer,
  fetchOpenBankingAccountSummary,
  fetchOpenBankingTransactions,
  OpenBankingApiError,
  refreshOpenBankingToken,
} from './open-banking-client'

function getConfiguredAccount(): StoredFinanceAccountConfig | null {
  return loadFinanceAccountConfig()
}

async function refreshStoredTokens(
  config: StoredFinanceAccountConfig,
): Promise<StoredFinanceAccountConfig> {
  const nextTokens = await refreshOpenBankingToken(config)
  const updated: StoredFinanceAccountConfig = {
    ...config,
    accessToken: nextTokens.accessToken,
    refreshToken: nextTokens.refreshToken ?? config.refreshToken,
    scope: nextTokens.scope ?? config.scope,
    userSeqNo: nextTokens.userSeqNo ?? config.userSeqNo,
    updatedAt: Date.now(),
  }
  await saveStoredFinanceAccountConfig(updated)
  return updated
}

async function withStoredFinanceAccount<T>(
  action: (config: StoredFinanceAccountConfig) => Promise<T>,
): Promise<T> {
  const config = getConfiguredAccount()
  if (!config) {
    throw new Error('Finance integration is not configured. Open Settings and connect an Open Banking account first.')
  }

  try {
    return await action(config)
  } catch (error) {
    if (
      error instanceof OpenBankingApiError &&
      error.status === 401 &&
      config.refreshToken &&
      config.clientSecret
    ) {
      const refreshed = await refreshStoredTokens(config)
      return action(refreshed)
    }
    throw error
  }
}

export function isFinanceConfigured(): boolean {
  return getConfiguredAccount() !== null
}

export function getFinanceAccountStatus(): FinanceAccountStatus {
  return toFinanceAccountStatus(getConfiguredAccount())
}

export async function saveFinanceAccountConfig(
  input: FinanceAccountConfigInput,
): Promise<FinanceAccountStatus> {
  const existing = getConfiguredAccount()
  let normalized = normalizeFinanceAccountConfigInput(input, {
    fallbackClientSecret: existing?.clientSecret,
    fallbackAccessToken: existing?.accessToken,
    fallbackRefreshToken: existing?.refreshToken,
    fallbackTransferDefaults: existing?.transferDefaults,
    bankName: existing?.bankName,
    accountMask: existing?.accountMask,
    lastBalance: existing?.lastBalance,
    currency: existing?.currency,
    lastVerifiedAt: existing?.lastVerifiedAt ?? null,
  })

  if (!normalized.accessToken && normalized.refreshToken && normalized.clientSecret) {
    const nextTokens = await refreshOpenBankingToken(normalized)
    normalized = {
      ...normalized,
      accessToken: nextTokens.accessToken,
      refreshToken: nextTokens.refreshToken ?? normalized.refreshToken,
      scope: nextTokens.scope ?? normalized.scope,
      userSeqNo: nextTokens.userSeqNo ?? normalized.userSeqNo,
      updatedAt: Date.now(),
    }
  }

  const summary = await fetchOpenBankingAccountSummary(normalized)
  const stored: StoredFinanceAccountConfig = {
    ...normalized,
    accountAlias: summary.accountAlias ?? normalized.accountAlias,
    bankName: summary.bankName ?? normalized.bankName,
    accountMask: summary.accountMask ?? normalized.accountMask,
    lastBalance: summary.balance,
    currency: summary.currency,
    lastVerifiedAt: Date.now(),
    updatedAt: Date.now(),
  }
  await saveStoredFinanceAccountConfig(stored)
  return toFinanceAccountStatus(stored)
}

export async function clearFinanceAccount(): Promise<FinanceAccountStatus> {
  await clearFinanceAccountConfig()
  return getFinanceAccountStatus()
}

export async function getFinanceAccountSummary(): Promise<FinanceAccountSummary> {
  return withStoredFinanceAccount(async (config) => {
    const summary = await fetchOpenBankingAccountSummary(config)
    const updated: StoredFinanceAccountConfig = {
      ...config,
      accountAlias: summary.accountAlias ?? config.accountAlias,
      bankName: summary.bankName ?? config.bankName,
      accountMask: summary.accountMask ?? config.accountMask,
      lastBalance: summary.balance,
      currency: summary.currency,
      lastVerifiedAt: Date.now(),
      updatedAt: Date.now(),
    }
    await saveStoredFinanceAccountConfig(updated)
    return summary
  })
}

export async function listFinanceTransactions(query: FinanceTransactionQuery) {
  return withStoredFinanceAccount((config) => fetchOpenBankingTransactions(config, query))
}

export async function sendFinanceTransfer(
  draft: FinanceTransferDraft,
): Promise<FinanceTransferResult> {
  return withStoredFinanceAccount((config) => createOpenBankingTransfer(config, draft))
}
