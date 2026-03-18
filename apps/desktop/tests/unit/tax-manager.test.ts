import { beforeEach, describe, expect, it, vi } from 'vitest'

const accountStoreMock = vi.hoisted(() => ({
  loadTaxAccountConfig: vi.fn(),
  normalizeTaxAccountConfigInput: vi.fn(),
  saveStoredTaxAccountConfig: vi.fn(),
  clearTaxAccountConfig: vi.fn(),
  toTaxAccountStatus: vi.fn(),
}))

const clientMock = vi.hoisted(() => ({
  lookupBarobillBusinessStatus: vi.fn(),
  queryBarobillHometaxEvidence: vi.fn(),
}))

vi.mock('../../src/main/tax/tax-account-store', () => accountStoreMock)
vi.mock('../../src/main/tax/barobill-client', () => clientMock)

import {
  getTaxAccountStatus,
  listHometaxEvidence,
  saveTaxAccountConfig,
} from '../../src/main/tax/tax-manager'

describe('tax-manager', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    accountStoreMock.toTaxAccountStatus.mockImplementation((config) => {
      if (!config) {
        return {
          provider: 'none',
          configured: false,
          hasStoredApiKey: false,
          lastVerifiedAt: null,
        }
      }

      return {
        provider: 'barobill',
        configured: true,
        preset: config.preset,
        apiBaseUrl: config.apiBaseUrl,
        authMode: config.authMode,
        providerLabel: config.providerLabel,
        memberId: config.memberId,
        corporationNumber: config.corporationNumber,
        businessStatePath: config.businessStatePath,
        hometaxPath: config.hometaxPath,
        hasStoredApiKey: Boolean(config.apiKey),
        lastVerifiedAt: config.lastVerifiedAt ?? null,
      }
    })

    accountStoreMock.normalizeTaxAccountConfigInput.mockImplementation((input, options) => ({
      preset: input.preset,
      apiBaseUrl: input.apiBaseUrl,
      apiKey: input.apiKey || options?.fallbackApiKey || '',
      authMode: input.authMode,
      providerLabel: input.providerLabel,
      memberId: input.memberId,
      corporationNumber: input.corporationNumber,
      userId: input.userId,
      businessStatePath: input.businessStatePath,
      hometaxPath: input.hometaxPath,
      taxInvoicePath: input.taxInvoicePath,
      updatedAt: 1742428800000,
      lastVerifiedAt: options?.lastVerifiedAt ?? null,
    }))
  })

  it('returns none when no tax route is stored', () => {
    accountStoreMock.loadTaxAccountConfig.mockReturnValue(null)

    expect(getTaxAccountStatus()).toEqual({
      provider: 'none',
      configured: false,
      hasStoredApiKey: false,
      lastVerifiedAt: null,
    })
  })

  it('reuses the stored API key and verifies the business state route', async () => {
    accountStoreMock.loadTaxAccountConfig.mockReturnValue({
      preset: 'barobill',
      apiBaseUrl: 'https://api.barobill.co.kr',
      apiKey: 'saved-api-key',
      authMode: 'header',
      businessStatePath: '/corp-state',
      updatedAt: 1742342400000,
      lastVerifiedAt: null,
    })
    clientMock.lookupBarobillBusinessStatus.mockResolvedValue([
      { businessNumber: '0000000000', statusText: 'Unknown' },
    ])

    const status = await saveTaxAccountConfig({
      preset: 'barobill',
      apiBaseUrl: 'https://api.barobill.co.kr',
      apiKey: '',
      authMode: 'header',
      providerLabel: 'Barobill',
      businessStatePath: '/corp-state',
      hometaxPath: '/hometax',
    })

    expect(accountStoreMock.normalizeTaxAccountConfigInput).toHaveBeenCalledWith(
      expect.objectContaining({
        apiBaseUrl: 'https://api.barobill.co.kr',
      }),
      expect.objectContaining({
        fallbackApiKey: 'saved-api-key',
      }),
    )
    expect(clientMock.lookupBarobillBusinessStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'saved-api-key',
      }),
      expect.objectContaining({
        businessNumbers: ['0000000000'],
      }),
    )
    expect(status.provider).toBe('barobill')
  })

  it('queries hometax evidence through the configured route', async () => {
    accountStoreMock.loadTaxAccountConfig.mockReturnValue({
      preset: 'barobill',
      apiBaseUrl: 'https://api.barobill.co.kr',
      apiKey: 'api-key',
      authMode: 'header',
      hometaxPath: '/hometax',
      updatedAt: 1742342400000,
      lastVerifiedAt: 1742342400000,
    })
    clientMock.queryBarobillHometaxEvidence.mockResolvedValue([
      { id: 'evidence-1', summary: 'Tax invoice' },
    ])

    const result = await listHometaxEvidence({
      fromDate: '2026-03-01',
      toDate: '2026-03-19',
      direction: 'sales',
    })

    expect(clientMock.queryBarobillHometaxEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'api-key',
      }),
      expect.objectContaining({
        direction: 'sales',
      }),
    )
    expect(result[0]?.id).toBe('evidence-1')
  })
})
