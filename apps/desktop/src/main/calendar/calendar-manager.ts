/**
 * Calendar manager with provider adapters (Google / Outlook).
 * OAuth policy is enforced via oauth-policy.ts through provider client helpers.
 */
import {
  createGoogleCalendarOAuthAuthorizationRequest,
  listGoogleCalendarEvents,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from './google-calendar'
import {
  createOutlookCalendarOAuthAuthorizationRequest,
  listOutlookCalendarEvents,
  createOutlookCalendarEvent,
  deleteOutlookCalendarEvent,
} from './outlook-calendar'
import type { DesktopOAuthAuthorizationRequest } from '../auth/oauth-policy'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: string | number
  end: string | number
  location?: string
  attendees?: string[]
  allDay?: boolean
}

export type CalendarProvider = 'google' | 'microsoft'

const DEFAULT_PROVIDER: CalendarProvider = 'google'

function resolveCalendarProvider(explicit?: CalendarProvider): CalendarProvider {
  if (explicit === 'google' || explicit === 'microsoft') return explicit
  const envProvider = process.env['USAN_CALENDAR_PROVIDER']?.trim().toLowerCase()
  if (envProvider === 'google' || envProvider === 'microsoft') return envProvider
  return DEFAULT_PROVIDER
}

function getProviderAccessToken(provider: CalendarProvider): string {
  if (provider === 'google') {
    // Try stored OAuth token first, fall back to env var
    try {
      const { loadGoogleTokens } = require('../auth/oauth-google') as typeof import('../auth/oauth-google')
      const tokens = loadGoogleTokens()
      if (tokens?.accessToken) return tokens.accessToken
    } catch { /* oauth module not available */ }
    return process.env['USAN_GOOGLE_ACCESS_TOKEN']?.trim() ?? ''
  }
  return process.env['USAN_MICROSOFT_ACCESS_TOKEN']?.trim() ?? ''
}

function toIso(input: string | number | Date): string {
  if (typeof input === 'number') return new Date(input).toISOString()
  if (input instanceof Date) return input.toISOString()
  const parsed = Date.parse(input)
  if (Number.isNaN(parsed)) throw new Error(`Invalid date: ${input}`)
  return new Date(parsed).toISOString()
}

function toTimestamp(input: string | number): number {
  if (typeof input === 'number') return input
  const parsed = Date.parse(input)
  if (Number.isNaN(parsed)) throw new Error(`Invalid date-time value: ${input}`)
  return parsed
}

function dayRangeIso(dateLike: string): { start: string; end: string } {
  const base = new Date(dateLike)
  if (Number.isNaN(base.getTime())) throw new Error(`Invalid date: ${dateLike}`)
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0, 0))
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 23, 59, 59, 999))
  return { start: start.toISOString(), end: end.toISOString() }
}

export function createCalendarOAuthAuthorizationRequest(options: {
  clientId: string
  redirectUri: string
  provider?: CalendarProvider
  scopes?: string[]
  state?: string
  tenantId?: string
}): DesktopOAuthAuthorizationRequest {
  const provider = resolveCalendarProvider(options.provider)

  if (provider === 'google') {
    return createGoogleCalendarOAuthAuthorizationRequest({
      clientId: options.clientId,
      redirectUri: options.redirectUri,
      scopes: options.scopes,
      state: options.state,
    })
  }

  return createOutlookCalendarOAuthAuthorizationRequest({
    clientId: options.clientId,
    redirectUri: options.redirectUri,
    scopes: options.scopes,
    state: options.state,
    tenantId: options.tenantId,
  })
}

export async function listEvents(
  startDate?: string | number,
  endDate?: string | number,
): Promise<CalendarEvent[]> {
  const provider = resolveCalendarProvider()
  const accessToken = getProviderAccessToken(provider)
  if (!accessToken) return []

  const rangeStart = startDate == null ? new Date().toISOString() : toIso(startDate)
  const rangeEnd = endDate == null ? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() : toIso(endDate)

  if (provider === 'google') {
    return listGoogleCalendarEvents(accessToken, rangeStart, rangeEnd)
  }

  return listOutlookCalendarEvents(accessToken, rangeStart, rangeEnd)
}

export async function createEvent(event: Partial<CalendarEvent>): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const provider = resolveCalendarProvider()
    const accessToken = getProviderAccessToken(provider)
    if (!accessToken) {
      return {
        success: false,
        error: 'Calendar integration is not configured. Set provider access token and run desktop OAuth.',
      }
    }

    if (!event.title || event.start == null || event.end == null) {
      return { success: false, error: 'title/start/end are required' }
    }

    const payload = {
      title: event.title,
      description: event.description,
      start: toTimestamp(event.start),
      end: toTimestamp(event.end),
      location: event.location,
      attendees: event.attendees,
      allDay: event.allDay,
    }

    if (provider === 'google') {
      return createGoogleCalendarEvent(accessToken, payload)
    }

    return createOutlookCalendarEvent(accessToken, payload)
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message,
    }
  }
}

export async function deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  const normalizedId = eventId.trim()
  if (!normalizedId) {
    return { success: false, error: 'eventId is required' }
  }

  try {
    const provider = resolveCalendarProvider()
    const accessToken = getProviderAccessToken(provider)
    if (!accessToken) {
      return {
        success: false,
        error: 'Calendar integration is not configured. Set provider access token and run desktop OAuth.',
      }
    }

    if (provider === 'google') {
      return deleteGoogleCalendarEvent(accessToken, normalizedId)
    }

    return deleteOutlookCalendarEvent(accessToken, normalizedId)
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message,
    }
  }
}

export async function findFreeTime(
  dateStr: string,
  durationMinutes: number,
): Promise<Array<{ start: number; end: number }>> {
  const durationMs = Math.max(1, Math.floor(durationMinutes)) * 60 * 1000
  const { start, end } = dayRangeIso(dateStr)

  const events = (await listEvents(start, end))
    .map((event) => ({
      ...event,
      startTs: toTimestamp(event.start),
      endTs: toTimestamp(event.end),
    }))
    .filter((event) => event.endTs > event.startTs)
    .sort((a, b) => a.startTs - b.startTs)

  const dayStart = Date.parse(start)
  const dayEnd = Date.parse(end)

  let cursor = dayStart
  const freeSlots: Array<{ start: number; end: number }> = []

  for (const event of events) {
    const eventStart = Math.max(event.startTs, dayStart)
    const eventEnd = Math.min(event.endTs, dayEnd)

    if (eventStart - cursor >= durationMs) {
      freeSlots.push({ start: cursor, end: eventStart })
    }

    if (eventEnd > cursor) {
      cursor = eventEnd
    }
  }

  if (dayEnd - cursor >= durationMs) {
    freeSlots.push({ start: cursor, end: dayEnd })
  }

  return freeSlots
}

export function isCalendarConfigured(): boolean {
  const provider = resolveCalendarProvider()
  const accessToken = getProviderAccessToken(provider)
  return accessToken.length > 0
}
