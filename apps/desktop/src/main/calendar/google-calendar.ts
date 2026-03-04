import { createDesktopOAuthAuthorizationRequest, type DesktopOAuthAuthorizationRequest } from '../auth/oauth-policy'

export interface GoogleCalendarEvent {
  id: string
  title: string
  description?: string
  start: number
  end: number
  location?: string
  attendees?: string[]
  allDay?: boolean
}

export interface GoogleCalendarCreateInput {
  title: string
  description?: string
  start: number
  end: number
  location?: string
  attendees?: string[]
  allDay?: boolean
}

const GOOGLE_CALENDAR_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const DEFAULT_GOOGLE_CALENDAR_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
]

type GoogleCalendarApiEvent = {
  id: string
  summary?: string
  description?: string
  location?: string
  attendees?: Array<{ email?: string }>
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

function parseGoogleDate(value?: { date?: string; dateTime?: string }): number {
  if (!value) return Date.now()
  if (value.dateTime) return Date.parse(value.dateTime)
  if (value.date) return Date.parse(`${value.date}T00:00:00.000Z`)
  return Date.now()
}

function toIsoDateTime(timestamp: number): string {
  return new Date(timestamp).toISOString()
}

async function googleCalendarFetchJson<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Google Calendar request failed (${response.status}): ${body || response.statusText}`)
  }

  return (await response.json()) as T
}

export function createGoogleCalendarOAuthAuthorizationRequest(options: {
  clientId: string
  redirectUri: string
  scopes?: string[]
  state?: string
}): DesktopOAuthAuthorizationRequest {
  return createDesktopOAuthAuthorizationRequest({
    provider: 'google',
    clientId: options.clientId,
    authEndpoint: GOOGLE_CALENDAR_AUTH_ENDPOINT,
    redirectUri: options.redirectUri,
    scopes: options.scopes ?? DEFAULT_GOOGLE_CALENDAR_SCOPES,
    state: options.state,
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    },
  })
}

export async function listGoogleCalendarEvents(
  accessToken: string,
  startDateIso: string,
  endDateIso: string,
): Promise<GoogleCalendarEvent[]> {
  const query = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: startDateIso,
    timeMax: endDateIso,
    maxResults: '100',
  })

  const response = await googleCalendarFetchJson<{ items?: GoogleCalendarApiEvent[] }>(
    accessToken,
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query.toString()}`,
  )

  return (response.items ?? []).map((item) => {
    const start = parseGoogleDate(item.start)
    const end = parseGoogleDate(item.end)
    return {
      id: item.id,
      title: item.summary ?? '(No title)',
      description: item.description,
      start,
      end,
      location: item.location,
      attendees: item.attendees?.map((attendee) => attendee.email).filter(Boolean) as string[] | undefined,
      allDay: Boolean(item.start?.date && !item.start?.dateTime),
    }
  })
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  event: GoogleCalendarCreateInput,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const payload = {
    summary: event.title,
    description: event.description,
    location: event.location,
    attendees: (event.attendees ?? []).map((email) => ({ email })),
    start: event.allDay
      ? { date: new Date(event.start).toISOString().slice(0, 10) }
      : { dateTime: toIsoDateTime(event.start) },
    end: event.allDay
      ? { date: new Date(event.end).toISOString().slice(0, 10) }
      : { dateTime: toIsoDateTime(event.end) },
  }

  const response = await googleCalendarFetchJson<{ id?: string }>(
    accessToken,
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )

  return { success: true, eventId: response.id }
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!eventId.trim()) {
    return { success: false, error: 'eventId is required' }
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
    },
  )

  if (response.ok) {
    return { success: true }
  }

  const body = await response.text().catch(() => '')
  return {
    success: false,
    error: `Google Calendar delete failed (${response.status}): ${body || response.statusText}`,
  }
}
