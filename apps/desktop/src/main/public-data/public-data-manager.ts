import type {
  PublicBusinessStatusLookup,
  PublicDataAccountConfigInput,
  PublicDataAccountStatus,
  PublicDataQuery,
} from '@shared/types/ipc'
import {
  clearPublicDataAccountConfig,
  loadPublicDataAccountConfig,
  normalizePublicDataAccountConfigInput,
  saveStoredPublicDataAccountConfig,
  toPublicDataAccountStatus,
  type StoredPublicDataAccountConfig,
} from './public-data-account-store'
import { lookupPublicBusinessStatus, requestPublicData } from './data-go-kr-client'

function getConfiguredAccount(): StoredPublicDataAccountConfig | null {
  return loadPublicDataAccountConfig()
}

function shouldAttemptDefaultVerification(config: StoredPublicDataAccountConfig): boolean {
  return config.preset !== 'custom' || config.apiBaseUrl.includes('odcloud.kr')
}

export function isPublicDataConfigured(): boolean {
  return getConfiguredAccount() !== null
}

export function getPublicDataAccountStatus(): PublicDataAccountStatus {
  return toPublicDataAccountStatus(getConfiguredAccount())
}

export async function savePublicDataAccountConfig(
  input: PublicDataAccountConfigInput,
): Promise<PublicDataAccountStatus> {
  const existing = getConfiguredAccount()
  const normalized = normalizePublicDataAccountConfigInput(input, {
    fallbackServiceKey: existing?.serviceKey,
    lastVerifiedAt: existing?.lastVerifiedAt ?? null,
  })

  let lastVerifiedAt = existing?.lastVerifiedAt ?? null
  if (shouldAttemptDefaultVerification(normalized)) {
    await lookupPublicBusinessStatus(normalized, ['0000000000'], '/api/nts-businessman/v1/status')
    lastVerifiedAt = Date.now()
  }

  const stored: StoredPublicDataAccountConfig = {
    ...normalized,
    lastVerifiedAt,
    updatedAt: Date.now(),
  }
  await saveStoredPublicDataAccountConfig(stored)
  return toPublicDataAccountStatus(stored)
}

export async function clearPublicDataAccount(): Promise<PublicDataAccountStatus> {
  await clearPublicDataAccountConfig()
  return getPublicDataAccountStatus()
}

async function withStoredPublicDataAccount<T>(
  action: (config: StoredPublicDataAccountConfig) => Promise<T>,
): Promise<T> {
  const config = getConfiguredAccount()
  if (!config) {
    throw new Error('Government24 / public data integration is not configured. Open Settings and connect a data.go.kr route first.')
  }

  return action(config)
}

export async function queryGovernmentPublicData(query: PublicDataQuery) {
  return withStoredPublicDataAccount((config) => requestPublicData(config, query))
}

export async function lookupGovernmentBusinessStatus(
  lookup: PublicBusinessStatusLookup,
) {
  return withStoredPublicDataAccount((config) =>
    lookupPublicBusinessStatus(config, lookup.businessNumbers, lookup.pathOverride),
  )
}
