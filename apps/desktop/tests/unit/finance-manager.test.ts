import { beforeEach, describe, expect, it, vi } from 'vitest'

const financeAccountStoreMock = vi.hoisted(() => ({
  loadFinanceAccountConfig: vi.fn(),
  normalizeFinanceAccountConfigInput: vi.fn(),
  saveStoredFinanceAccountConfig: vi.fn(),
  clearFinanceAccountConfig: vi.fn(),
  toFinanceAccountStatus: vi.fn(),
}))

const openBankingClientMock = vi.hoisted(() => ({
  fetchOpenBankingAccountSummary: vi.fn(),
  fetchOpenBankingTransactions: vi.fn(),
  createOpenBankingTransfer: vi.fn(),
  refreshOpenBankingToken: vi.fn(),
  OpenBankingApiError: class OpenBankingApiError extends Error {
    constructor(
      message: string,
      readonly status = 500,
      readonly details?: unknown,
    ) {
      super(message)
    }
  },
}))

vi.mock('../../src/main/finance/finance-account-store', () => financeAccountStoreMock)
vi.mock('../../src/main/finance/open-banking-client', () => openBankingClientMock)

import {
  getFinanceAccountStatus,
  listFinanceTransactions,
  saveFinanceAccountConfig,
  sendFinanceTransfer,
} from '../../src/main/finance/finance-manager'

describe('finance-manager', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    financeAccountStoreMock.toFinanceAccountStatus.mockImplementation((config) => {
      if (!config) {
        return {
          provider: 'none',
          configured: false,
          hasStoredAccessToken: false,
          hasStoredRefreshToken: false,
          hasStoredClientSecret: false,
          lastVerifiedAt: null,
        }
      }

      return {
        provider: 'open-banking',
        configured: true,
        preset: config.preset,
        apiBaseUrl: config.apiBaseUrl,
        clientId: config.clientId,
        fintechUseNum: config.fintechUseNum,
        accountAlias: config.accountAlias,
        providerLabel: config.providerLabel,
        lastBalance: config.lastBalance,
        currency: config.currency,
        hasStoredAccessToken: Boolean(config.accessToken),
        hasStoredRefreshToken: Boolean(config.refreshToken),
        hasStoredClientSecret: Boolean(config.clientSecret),
        lastVerifiedAt: config.lastVerifiedAt ?? null,
      }
    })

    financeAccountStoreMock.normalizeFinanceAccountConfigInput.mockImplementation((input, options) => ({
      preset: input.preset,
      apiBaseUrl: input.apiBaseUrl,
      clientId: input.clientId,
      clientSecret: input.clientSecret || options?.fallbackClientSecret || '',
      accessToken: input.accessToken || options?.fallbackAccessToken || '',
      refreshToken: input.refreshToken || options?.fallbackRefreshToken || '',
      fintechUseNum: input.fintechUseNum,
      userSeqNo: input.userSeqNo,
      scope: input.scope,
      accountAlias: input.accountAlias,
      providerLabel: input.providerLabel,
      transferDefaults: input.transferDefaults || options?.fallbackTransferDefaults,
      bankName: options?.bankName,
      accountMask: options?.accountMask,
      lastBalance: options?.lastBalance,
      currency: options?.currency,
      updatedAt: 1742428800000,
      lastVerifiedAt: options?.lastVerifiedAt ?? null,
    }))
  })

  it('returns none when no finance account is stored', () => {
    financeAccountStoreMock.loadFinanceAccountConfig.mockReturnValue(null)

    expect(getFinanceAccountStatus()).toEqual({
      provider: 'none',
      configured: false,
      hasStoredAccessToken: false,
      hasStoredRefreshToken: false,
      hasStoredClientSecret: false,
      lastVerifiedAt: null,
    })
  })

  it('reuses saved secrets and stores verified balance metadata', async () => {
    financeAccountStoreMock.loadFinanceAccountConfig.mockReturnValue({
      preset: 'openbanking-testbed',
      apiBaseUrl: 'https://testapi.openbanking.or.kr',
      clientId: 'client-id',
      clientSecret: 'saved-secret',
      accessToken: 'saved-access-token',
      refreshToken: 'saved-refresh-token',
      fintechUseNum: '199003B123456789012345',
      providerLabel: 'KFTC Open Banking Testbed',
      updatedAt: 1742342400000,
      lastVerifiedAt: 1742342400000,
    })
    openBankingClientMock.fetchOpenBankingAccountSummary.mockResolvedValue({
      fintechUseNum: '199003B123456789012345',
      accountAlias: '주거래 통장',
      bankName: '테스트은행',
      accountMask: '123-45-6789',
      balance: '1250000',
      currency: 'KRW',
      updatedAt: 1742428800000,
    })

    const status = await saveFinanceAccountConfig({
      preset: 'openbanking-testbed',
      apiBaseUrl: 'https://testapi.openbanking.or.kr',
      clientId: 'client-id',
      clientSecret: '',
      accessToken: '',
      refreshToken: '',
      fintechUseNum: '199003B123456789012345',
      providerLabel: 'KFTC Open Banking Testbed',
    })

    expect(financeAccountStoreMock.normalizeFinanceAccountConfigInput).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-id',
      }),
      expect.objectContaining({
        fallbackClientSecret: 'saved-secret',
        fallbackAccessToken: 'saved-access-token',
        fallbackRefreshToken: 'saved-refresh-token',
      }),
    )
    expect(openBankingClientMock.fetchOpenBankingAccountSummary).toHaveBeenCalled()
    expect(financeAccountStoreMock.saveStoredFinanceAccountConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        bankName: '테스트은행',
        lastBalance: '1250000',
        currency: 'KRW',
      }),
    )
    expect(status.lastBalance).toBe('1250000')
  })

  it('lists transactions from the stored finance route', async () => {
    financeAccountStoreMock.loadFinanceAccountConfig.mockReturnValue({
      preset: 'openbanking-testbed',
      apiBaseUrl: 'https://testapi.openbanking.or.kr',
      clientId: 'client-id',
      clientSecret: '',
      accessToken: 'token',
      fintechUseNum: '199003B123456789012345',
      updatedAt: 1742342400000,
      lastVerifiedAt: 1742342400000,
    })
    openBankingClientMock.fetchOpenBankingTransactions.mockResolvedValue([
      {
        id: 'txn-1',
        postedAt: '20260319093000',
        summary: '급여',
        amount: '2500000',
      },
    ])

    const result = await listFinanceTransactions({ fromDate: '2026-03-01', limit: 10 })

    expect(openBankingClientMock.fetchOpenBankingTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        fintechUseNum: '199003B123456789012345',
      }),
      expect.objectContaining({
        fromDate: '2026-03-01',
        limit: 10,
      }),
    )
    expect(result[0]?.id).toBe('txn-1')
  })

  it('sends transfers through the configured finance route', async () => {
    financeAccountStoreMock.loadFinanceAccountConfig.mockReturnValue({
      preset: 'openbanking-testbed',
      apiBaseUrl: 'https://testapi.openbanking.or.kr',
      clientId: 'client-id',
      clientSecret: '',
      accessToken: 'token',
      fintechUseNum: '199003B123456789012345',
      transferDefaults: {
        contractAccountNum: '200000000001',
        clientName: '홍길동',
        clientIdentifier: '9001011234567',
      },
      updatedAt: 1742342400000,
      lastVerifiedAt: 1742342400000,
    })
    openBankingClientMock.createOpenBankingTransfer.mockResolvedValue({
      success: true,
      bankTranId: 'bank-tran-id',
    })

    const result = await sendFinanceTransfer({
      amount: '10000',
      summary: '테스트 송금',
      toFintechUseNum: '199003B987654321098765',
    })

    expect(openBankingClientMock.createOpenBankingTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'token',
      }),
      expect.objectContaining({
        amount: '10000',
        toFintechUseNum: '199003B987654321098765',
      }),
    )
    expect(result.success).toBe(true)
  })
})
