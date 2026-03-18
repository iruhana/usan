import type {
  HometaxEvidenceQuery,
  TaxAccountConfigInput,
  TaxAccountStatus,
  TaxBusinessStatusLookup,
} from '@shared/types/ipc'
import {
  clearTaxAccountConfig,
  loadTaxAccountConfig,
  normalizeTaxAccountConfigInput,
  saveStoredTaxAccountConfig,
  toTaxAccountStatus,
  type StoredTaxAccountConfig,
} from './tax-account-store'
import { lookupBarobillBusinessStatus, queryBarobillHometaxEvidence } from './barobill-client'

function getConfiguredAccount(): StoredTaxAccountConfig | null {
  return loadTaxAccountConfig()
}

export function isTaxConfigured(): boolean {
  return getConfiguredAccount() !== null
}

export function getTaxAccountStatus(): TaxAccountStatus {
  return toTaxAccountStatus(getConfiguredAccount())
}

export async function saveTaxAccountConfig(
  input: TaxAccountConfigInput,
): Promise<TaxAccountStatus> {
  const existing = getConfiguredAccount()
  const normalized = normalizeTaxAccountConfigInput(input, {
    fallbackApiKey: existing?.apiKey,
    lastVerifiedAt: existing?.lastVerifiedAt ?? null,
  })

  let lastVerifiedAt = existing?.lastVerifiedAt ?? null
  if (normalized.businessStatePath) {
    await lookupBarobillBusinessStatus(normalized, {
      businessNumbers: ['0000000000'],
    })
    lastVerifiedAt = Date.now()
  }

  const stored: StoredTaxAccountConfig = {
    ...normalized,
    lastVerifiedAt,
    updatedAt: Date.now(),
  }
  await saveStoredTaxAccountConfig(stored)
  return toTaxAccountStatus(stored)
}

export async function clearTaxAccount(): Promise<TaxAccountStatus> {
  await clearTaxAccountConfig()
  return getTaxAccountStatus()
}

async function withStoredTaxAccount<T>(
  action: (config: StoredTaxAccountConfig) => Promise<T>,
): Promise<T> {
  const config = getConfiguredAccount()
  if (!config) {
    throw new Error('Hometax / Barobill integration is not configured. Open Settings and connect a tax service first.')
  }

  return action(config)
}

export async function lookupTaxBusinessStatus(
  lookup: TaxBusinessStatusLookup,
) {
  return withStoredTaxAccount((config) => lookupBarobillBusinessStatus(config, lookup))
}

export async function listHometaxEvidence(
  query: HometaxEvidenceQuery,
) {
  return withStoredTaxAccount((config) => queryBarobillHometaxEvidence(config, query))
}
