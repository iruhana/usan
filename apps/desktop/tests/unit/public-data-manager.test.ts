import { beforeEach, describe, expect, it, vi } from 'vitest'

const accountStoreMock = vi.hoisted(() => ({
  loadPublicDataAccountConfig: vi.fn(),
  normalizePublicDataAccountConfigInput: vi.fn(),
  saveStoredPublicDataAccountConfig: vi.fn(),
  clearPublicDataAccountConfig: vi.fn(),
  toPublicDataAccountStatus: vi.fn(),
}))

const clientMock = vi.hoisted(() => ({
  lookupPublicBusinessStatus: vi.fn(),
  requestPublicData: vi.fn(),
}))

vi.mock('../../src/main/public-data/public-data-account-store', () => accountStoreMock)
vi.mock('../../src/main/public-data/data-go-kr-client', () => clientMock)

import {
  getPublicDataAccountStatus,
  lookupGovernmentBusinessStatus,
  savePublicDataAccountConfig,
} from '../../src/main/public-data/public-data-manager'

describe('public-data-manager', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    accountStoreMock.toPublicDataAccountStatus.mockImplementation((config) => {
      if (!config) {
        return {
          provider: 'none',
          configured: false,
          hasStoredServiceKey: false,
          lastVerifiedAt: null,
        }
      }

      return {
        provider: config.preset === 'odcloud' ? 'odcloud' : 'data-go-kr',
        configured: true,
        preset: config.preset,
        apiBaseUrl: config.apiBaseUrl,
        authMode: config.authMode,
        providerLabel: config.providerLabel,
        serviceName: config.serviceName,
        defaultPath: config.defaultPath,
        defaultFormat: config.defaultFormat,
        hasStoredServiceKey: Boolean(config.serviceKey),
        lastVerifiedAt: config.lastVerifiedAt ?? null,
      }
    })

    accountStoreMock.normalizePublicDataAccountConfigInput.mockImplementation((input, options) => ({
      preset: input.preset,
      apiBaseUrl: input.apiBaseUrl,
      serviceKey: input.serviceKey || options?.fallbackServiceKey || '',
      authMode: input.authMode,
      providerLabel: input.providerLabel,
      serviceName: input.serviceName,
      defaultPath: input.defaultPath,
      defaultFormat: input.defaultFormat || 'json',
      updatedAt: 1742428800000,
      lastVerifiedAt: options?.lastVerifiedAt ?? null,
    }))
  })

  it('returns none when no public data route is stored', () => {
    accountStoreMock.loadPublicDataAccountConfig.mockReturnValue(null)

    expect(getPublicDataAccountStatus()).toEqual({
      provider: 'none',
      configured: false,
      hasStoredServiceKey: false,
      lastVerifiedAt: null,
    })
  })

  it('reuses the stored service key and verifies the route for odcloud presets', async () => {
    accountStoreMock.loadPublicDataAccountConfig.mockReturnValue({
      preset: 'odcloud',
      apiBaseUrl: 'https://api.odcloud.kr',
      serviceKey: 'saved-service-key',
      authMode: 'query',
      updatedAt: 1742342400000,
      lastVerifiedAt: 1742342400000,
    })
    clientMock.lookupPublicBusinessStatus.mockResolvedValue([
      { businessNumber: '0000000000', statusText: 'Not registered' },
    ])

    const status = await savePublicDataAccountConfig({
      preset: 'odcloud',
      apiBaseUrl: 'https://api.odcloud.kr',
      serviceKey: '',
      authMode: 'query',
      providerLabel: 'data.go.kr odcloud',
      serviceName: 'NTS business status',
      defaultPath: '/api/nts-businessman/v1/status',
      defaultFormat: 'json',
    })

    expect(accountStoreMock.normalizePublicDataAccountConfigInput).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'odcloud',
      }),
      expect.objectContaining({
        fallbackServiceKey: 'saved-service-key',
      }),
    )
    expect(clientMock.lookupPublicBusinessStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        apiBaseUrl: 'https://api.odcloud.kr',
        serviceKey: 'saved-service-key',
      }),
      ['0000000000'],
      '/api/nts-businessman/v1/status',
    )
    expect(status.provider).toBe('odcloud')
  })

  it('looks up business status through the configured route', async () => {
    accountStoreMock.loadPublicDataAccountConfig.mockReturnValue({
      preset: 'odcloud',
      apiBaseUrl: 'https://api.odcloud.kr',
      serviceKey: 'service-key',
      authMode: 'query',
      updatedAt: 1742342400000,
      lastVerifiedAt: 1742342400000,
    })
    clientMock.lookupPublicBusinessStatus.mockResolvedValue([
      { businessNumber: '1234567890', statusText: 'Operating' },
    ])

    const result = await lookupGovernmentBusinessStatus({
      businessNumbers: ['123-45-67890'],
    })

    expect(clientMock.lookupPublicBusinessStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceKey: 'service-key',
      }),
      ['123-45-67890'],
      undefined,
    )
    expect(result[0]?.businessNumber).toBe('1234567890')
  })
})
