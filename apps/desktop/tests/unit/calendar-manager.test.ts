import { beforeEach, describe, expect, it, vi } from 'vitest'

const calendarAccountStoreMock = vi.hoisted(() => ({
  loadCalendarAccountConfig: vi.fn(),
  normalizeCalendarAccountConfigInput: vi.fn(),
  saveCalendarAccountConfig: vi.fn(),
  clearCalendarAccountConfig: vi.fn(),
  toCalendarAccountStatus: vi.fn(),
}))

const caldavClientMock = vi.hoisted(() => ({
  listCaldavEvents: vi.fn(),
  createCaldavEvent: vi.fn(),
  deleteCaldavEvent: vi.fn(),
  verifyCaldavConnection: vi.fn(),
}))

const googleCalendarMock = vi.hoisted(() => ({
  createGoogleCalendarOAuthAuthorizationRequest: vi.fn(),
  listGoogleCalendarEvents: vi.fn(),
  createGoogleCalendarEvent: vi.fn(),
  deleteGoogleCalendarEvent: vi.fn(),
}))

const outlookCalendarMock = vi.hoisted(() => ({
  createOutlookCalendarOAuthAuthorizationRequest: vi.fn(),
  listOutlookCalendarEvents: vi.fn(),
  createOutlookCalendarEvent: vi.fn(),
  deleteOutlookCalendarEvent: vi.fn(),
}))

const oauthGoogleMock = vi.hoisted(() => ({
  getGoogleAccessToken: vi.fn(),
  isGoogleAuthenticated: vi.fn(),
}))

vi.mock('../../src/main/calendar/calendar-account-store', () => calendarAccountStoreMock)
vi.mock('../../src/main/calendar/caldav-client', () => caldavClientMock)
vi.mock('../../src/main/calendar/google-calendar', () => googleCalendarMock)
vi.mock('../../src/main/calendar/outlook-calendar', () => outlookCalendarMock)
vi.mock('../../src/main/auth/oauth-google', () => oauthGoogleMock)

import {
  getCalendarAccountStatus,
  listEvents,
  saveCalendarAccountConfig as saveCalendarIntegrationConfig,
} from '../../src/main/calendar/calendar-manager'

describe('calendar-manager', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    calendarAccountStoreMock.toCalendarAccountStatus.mockImplementation((config) => {
      if (!config) {
        return {
          provider: 'none',
          configured: false,
          hasStoredPassword: false,
          lastVerifiedAt: null,
        }
      }

      return {
        provider: 'caldav',
        configured: true,
        preset: config.preset,
        username: config.username,
        serverUrl: config.serverUrl,
        calendarUrl: config.calendarUrl,
        calendarName: config.calendarName,
        hasStoredPassword: Boolean(config.password),
        lastVerifiedAt: config.lastVerifiedAt ?? null,
      }
    })

    calendarAccountStoreMock.normalizeCalendarAccountConfigInput.mockImplementation((input, options) => ({
      ...input,
      password: input.password || options?.fallbackPassword || '',
      calendarUrl: input.calendarUrl || options?.calendarUrl || 'https://caldav.example.com/root/default/',
      calendarName: input.calendarName || options?.calendarName || 'Team',
      updatedAt: 1742342400000,
      lastVerifiedAt: options?.lastVerifiedAt ?? null,
    }))

    calendarAccountStoreMock.saveCalendarAccountConfig.mockImplementation(async (input, options) => ({
      ...input,
      password: input.password || options?.fallbackPassword || '',
      calendarUrl: options?.calendarUrl || input.calendarUrl || 'https://caldav.example.com/root/default/',
      calendarName: options?.calendarName || input.calendarName || 'Team',
      updatedAt: 1742342400000,
      lastVerifiedAt: options?.lastVerifiedAt ?? null,
    }))

    oauthGoogleMock.isGoogleAuthenticated.mockReturnValue(false)
    oauthGoogleMock.getGoogleAccessToken.mockResolvedValue(null)
  })

  it('prefers the CalDAV account when one is saved locally', async () => {
    const savedAccount = {
      preset: 'icloud',
      serverUrl: 'https://caldav.icloud.com',
      username: 'calendar@example.com',
      password: 'secret',
      calendarUrl: 'https://caldav.icloud.com/root/default/',
      calendarName: 'Personal',
      updatedAt: 1742342400000,
      lastVerifiedAt: 1742342400000,
    }

    calendarAccountStoreMock.loadCalendarAccountConfig.mockReturnValue(savedAccount)
    caldavClientMock.listCaldavEvents.mockResolvedValue([
      {
        id: 'dav-event-1',
        title: 'Standup',
        start: 1742342400000,
        end: 1742346000000,
        calendarName: 'Personal',
      },
    ])

    const result = await listEvents('2026-03-19T00:00:00.000Z', '2026-03-20T00:00:00.000Z')

    expect(caldavClientMock.listCaldavEvents).toHaveBeenCalledWith(
      savedAccount,
      '2026-03-19T00:00:00.000Z',
      '2026-03-20T00:00:00.000Z',
    )
    expect(googleCalendarMock.listGoogleCalendarEvents).not.toHaveBeenCalled()
    expect(result[0]?.id).toBe('dav-event-1')
  })

  it('reuses the saved password when the CalDAV form leaves password blank', async () => {
    const savedAccount = {
      preset: 'icloud',
      serverUrl: 'https://caldav.icloud.com',
      username: 'calendar@example.com',
      password: 'saved-app-password',
      calendarUrl: 'https://caldav.icloud.com/root/default/',
      calendarName: 'Personal',
      updatedAt: 1742342400000,
      lastVerifiedAt: 1742342400000,
    }

    calendarAccountStoreMock.loadCalendarAccountConfig.mockReturnValue(savedAccount)
    caldavClientMock.verifyCaldavConnection.mockResolvedValue({
      calendarUrl: 'https://caldav.icloud.com/root/default/',
      calendarName: 'Personal',
    })

    await saveCalendarIntegrationConfig({
      preset: 'icloud',
      serverUrl: 'https://caldav.icloud.com',
      username: 'calendar@example.com',
      password: '',
      calendarUrl: '',
    })

    expect(calendarAccountStoreMock.normalizeCalendarAccountConfigInput).toHaveBeenCalledWith(
      expect.objectContaining({
        serverUrl: 'https://caldav.icloud.com',
      }),
      expect.objectContaining({
        fallbackPassword: 'saved-app-password',
      }),
    )
    expect(caldavClientMock.verifyCaldavConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'saved-app-password',
      }),
    )
    expect(calendarAccountStoreMock.saveCalendarAccountConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'calendar@example.com',
      }),
      expect.objectContaining({
        fallbackPassword: 'saved-app-password',
        calendarUrl: 'https://caldav.icloud.com/root/default/',
      }),
    )
  })

  it('reports the OAuth provider when no CalDAV account is stored', () => {
    calendarAccountStoreMock.loadCalendarAccountConfig.mockReturnValue(null)
    oauthGoogleMock.isGoogleAuthenticated.mockReturnValue(true)

    const status = getCalendarAccountStatus()

    expect(status).toEqual({
      provider: 'google',
      configured: true,
      hasStoredPassword: false,
      lastVerifiedAt: null,
    })
  })
})
