import { createDesktopOAuthAuthorizationRequest, type DesktopOAuthAuthorizationRequest } from '../auth/oauth-policy'

export interface OutlookCalendarEvent {
  id: string
  title: string
  description?: string
  start: number
  end: number
  location?: string
  attendees?: string[]
  allDay?: boolean
}

export interface OutlookCalendarCreateInput {
  title: string
  description?: string
  start: number
  end: number
  location?: string
  attendees?: string[]
  allDay?: boolean
}

const DEFAULT_OUTLOOK_CALENDAR_SCOPES = ['openid', 'offline_access', 'User.Read', 'Calendars.Read', 'Calendars.ReadWrite']

type GraphDateTime = {
  dateTime?: string
  timeZone?: string
}

type GraphCalendarEvent = {
  id: string
  subject?: string
  bodyPreview?: string
  body?: { content?: string }
  isAllDay?: boolean
  location?: { displayName?: string }
  attendees?: Array<{ emailAddress?: { address?: string } }>
  start?: GraphDateTime
  end?: GraphDateTime
}

function parseGraphDateTime(value?: GraphDateTime): number {
  if (!value?.dateTime) return Date.now()
  return Date.parse(value.dateTime)
}

function toGraphDateTime(timestamp: number): GraphDateTime {
  return {
    dateTime: new Date(timestamp).toISOString(),
    timeZone: 'UTC',
  }
}

async function graphFetchJson<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
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
    throw new Error(`Microsoft Graph request failed (${response.status}): ${body || response.statusText}`)
  }

  return (await response.json()) as T
}

export function createOutlookCalendarOAuthAuthorizationRequest(options: {
  clientId: string
  redirectUri: string
  scopes?: string[]
  state?: string
  tenantId?: string
}): DesktopOAuthAuthorizationRequest {
  const tenantId = options.tenantId?.trim() || 'common'
  return createDesktopOAuthAuthorizationRequest({
    provider: 'microsoft',
    clientId: options.clientId,
    authEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    redirectUri: options.redirectUri,
    scopes: options.scopes ?? DEFAULT_OUTLOOK_CALENDAR_SCOPES,
    state: options.state,
    extraParams: {
      response_mode: 'query',
    },
  })
}

export async function listOutlookCalendarEvents(
  accessToken: string,
  startDateIso: string,
  endDateIso: string,
): Promise<OutlookCalendarEvent[]> {
  const query = new URLSearchParams({
    startDateTime: startDateIso,
    endDateTime: endDateIso,
    $select: 'id,subject,bodyPreview,body,start,end,isAllDay,location,attendees',
    $orderby: 'start/dateTime',
    $top: '100',
  })

  const response = await graphFetchJson<{ value?: GraphCalendarEvent[] }>(
    accessToken,
    `https://graph.microsoft.com/v1.0/me/calendar/calendarView?${query.toString()}`,
  )

  return (response.value ?? []).map((event) => ({
    id: event.id,
    title: event.subject ?? '(No title)',
    description: event.body?.content || event.bodyPreview,
    start: parseGraphDateTime(event.start),
    end: parseGraphDateTime(event.end),
    location: event.location?.displayName,
    attendees: event.attendees?.map((attendee) => attendee.emailAddress?.address).filter(Boolean) as string[] | undefined,
    allDay: event.isAllDay ?? false,
  }))
}

export async function createOutlookCalendarEvent(
  accessToken: string,
  event: OutlookCalendarCreateInput,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const payload = {
    subject: event.title,
    body: {
      contentType: 'Text',
      content: event.description ?? '',
    },
    start: toGraphDateTime(event.start),
    end: toGraphDateTime(event.end),
    isAllDay: event.allDay ?? false,
    location: event.location ? { displayName: event.location } : undefined,
    attendees: (event.attendees ?? []).map((address) => ({
      emailAddress: { address },
      type: 'required',
    })),
  }

  const response = await graphFetchJson<{ id?: string }>(accessToken, 'https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return { success: true, eventId: response.id }
}

export async function deleteOutlookCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!eventId.trim()) {
    return { success: false, error: 'eventId is required' }
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  })

  if (response.ok) {
    return { success: true }
  }

  const body = await response.text().catch(() => '')
  return {
    success: false,
    error: `Microsoft Graph delete failed (${response.status}): ${body || response.statusText}`,
  }
}
