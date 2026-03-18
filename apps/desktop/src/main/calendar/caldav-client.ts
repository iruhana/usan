import { randomUUID } from 'crypto'
import { Buffer } from 'buffer'
import { DAVClient, type DAVCalendar } from 'tsdav'
import type { StoredCalendarAccountConfig } from './calendar-account-store'

export interface CaldavCalendarEvent {
  id: string
  title: string
  description?: string
  start: number
  end: number
  location?: string
  attendees?: string[]
  allDay?: boolean
  calendarName?: string
}

export interface CaldavCalendarCreateInput {
  title: string
  description?: string
  start: number
  end: number
  location?: string
  attendees?: string[]
  allDay?: boolean
}

export interface CaldavVerificationResult {
  calendarUrl: string
  calendarName?: string
}

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`
}

function readCalendarDisplayName(calendar: DAVCalendar): string | undefined {
  const displayName = calendar.displayName
  if (typeof displayName === 'string') {
    return displayName.trim() || undefined
  }

  return undefined
}

function unfoldIcsLines(ics: string): string[] {
  return ics
    .replace(/\r?\n[ \t]/g, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function formatIcsDateTime(timestamp: number): string {
  return new Date(timestamp).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function formatIcsDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10).replace(/-/g, '')
}

function parseIcsDate(value: string, params: Record<string, string>): { timestamp: number; allDay: boolean } {
  const normalized = value.trim()
  const valueType = params['VALUE']?.toUpperCase()

  if (valueType === 'DATE' || /^\d{8}$/.test(normalized)) {
    const year = Number.parseInt(normalized.slice(0, 4), 10)
    const month = Number.parseInt(normalized.slice(4, 6), 10) - 1
    const day = Number.parseInt(normalized.slice(6, 8), 10)
    return {
      timestamp: Date.UTC(year, month, day, 0, 0, 0, 0),
      allDay: true,
    }
  }

  if (/^\d{8}T\d{6}Z$/.test(normalized)) {
    const year = Number.parseInt(normalized.slice(0, 4), 10)
    const month = Number.parseInt(normalized.slice(4, 6), 10) - 1
    const day = Number.parseInt(normalized.slice(6, 8), 10)
    const hour = Number.parseInt(normalized.slice(9, 11), 10)
    const minute = Number.parseInt(normalized.slice(11, 13), 10)
    const second = Number.parseInt(normalized.slice(13, 15), 10)
    return {
      timestamp: Date.UTC(year, month, day, hour, minute, second, 0),
      allDay: false,
    }
  }

  if (/^\d{8}T\d{6}$/.test(normalized)) {
    const year = normalized.slice(0, 4)
    const month = normalized.slice(4, 6)
    const day = normalized.slice(6, 8)
    const hour = normalized.slice(9, 11)
    const minute = normalized.slice(11, 13)
    const second = normalized.slice(13, 15)
    return {
      timestamp: Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}`),
      allDay: false,
    }
  }

  const parsed = Date.parse(normalized)
  if (!Number.isNaN(parsed)) {
    return { timestamp: parsed, allDay: false }
  }

  return { timestamp: Date.now(), allDay: false }
}

function parseIcsEvent(
  ics: string,
  fallbackUrl: string,
  calendarName?: string,
): CaldavCalendarEvent | null {
  const lines = unfoldIcsLines(ics)
  const firstEventIndex = lines.findIndex((line) => line === 'BEGIN:VEVENT')
  if (firstEventIndex === -1) return null

  const props = new Map<string, Array<{ params: Record<string, string>; value: string }>>()
  for (let index = firstEventIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === 'END:VEVENT') break
    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) continue

    const rawKey = line.slice(0, separatorIndex)
    const value = line.slice(separatorIndex + 1)
    const [name, ...paramParts] = rawKey.split(';')
    const params = Object.fromEntries(
      paramParts
        .map((part) => {
          const [paramKey, paramValue] = part.split('=')
          return [paramKey?.toUpperCase(), paramValue ?? '']
        })
        .filter(([paramKey]) => Boolean(paramKey)),
    ) as Record<string, string>

    const normalizedName = name.toUpperCase()
    const entries = props.get(normalizedName) ?? []
    entries.push({ params, value })
    props.set(normalizedName, entries)
  }

  const startEntry = props.get('DTSTART')?.[0]
  if (!startEntry) return null

  const endEntry = props.get('DTEND')?.[0]
  const parsedStart = parseIcsDate(startEntry.value, startEntry.params)
  const parsedEnd = endEntry
    ? parseIcsDate(endEntry.value, endEntry.params)
    : {
        timestamp: parsedStart.allDay
          ? parsedStart.timestamp + 24 * 60 * 60 * 1000
          : parsedStart.timestamp + 60 * 60 * 1000,
        allDay: parsedStart.allDay,
      }

  const attendees = (props.get('ATTENDEE') ?? [])
    .map((entry) => entry.value.replace(/^mailto:/i, '').trim())
    .filter(Boolean)

  return {
    id: fallbackUrl,
    title: unescapeIcsText(props.get('SUMMARY')?.[0]?.value ?? '(No title)'),
    description: props.get('DESCRIPTION')?.[0]?.value
      ? unescapeIcsText(props.get('DESCRIPTION')![0]!.value)
      : undefined,
    start: parsedStart.timestamp,
    end: parsedEnd.timestamp,
    location: props.get('LOCATION')?.[0]?.value
      ? unescapeIcsText(props.get('LOCATION')![0]!.value)
      : undefined,
    attendees: attendees.length > 0 ? attendees : undefined,
    allDay: parsedStart.allDay,
    calendarName,
  }
}

function serializeEventToIcs(event: CaldavCalendarCreateInput, uid: string): string {
  const startLine = event.allDay
    ? `DTSTART;VALUE=DATE:${formatIcsDate(event.start)}`
    : `DTSTART:${formatIcsDateTime(event.start)}`
  const effectiveEnd = event.allDay && event.end <= event.start
    ? event.start + 24 * 60 * 60 * 1000
    : event.end
  const endLine = event.allDay
    ? `DTEND;VALUE=DATE:${formatIcsDate(effectiveEnd)}`
    : `DTEND:${formatIcsDateTime(event.end)}`
  const attendees = (event.attendees ?? [])
    .filter((attendee) => attendee.trim().length > 0)
    .map((attendee) => `ATTENDEE:mailto:${attendee.trim()}`)

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Usan//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDateTime(Date.now())}`,
    startLine,
    endLine,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    ...attendees,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

async function createClient(config: StoredCalendarAccountConfig): Promise<DAVClient> {
  const client = new DAVClient({
    serverUrl: config.serverUrl,
    credentials: {
      username: config.username,
      password: config.password,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })

  await client.login()
  return client
}

async function resolveCalendar(
  client: DAVClient,
  config: Pick<StoredCalendarAccountConfig, 'calendarUrl'>,
): Promise<DAVCalendar> {
  const calendars = await client.fetchCalendars()
  if (calendars.length === 0) {
    throw new Error('No CalDAV calendars were found for this account')
  }

  const requestedUrl = config.calendarUrl ? normalizeUrl(config.calendarUrl) : ''
  const matched = requestedUrl
    ? calendars.find((calendar) => normalizeUrl(calendar.url) === requestedUrl)
    : undefined

  return matched ?? calendars[0]!
}

function readResponseError(response: Response, fallback: string): Promise<string> {
  return response
    .text()
    .then((body) => (body.trim() ? body : fallback))
    .catch(() => fallback)
}

export async function verifyCaldavConnection(
  config: StoredCalendarAccountConfig,
): Promise<CaldavVerificationResult> {
  const client = await createClient(config)
  const calendar = await resolveCalendar(client, config)
  return {
    calendarUrl: calendar.url,
    calendarName: readCalendarDisplayName(calendar),
  }
}

export async function listCaldavEvents(
  config: StoredCalendarAccountConfig,
  startDateIso: string,
  endDateIso: string,
): Promise<CaldavCalendarEvent[]> {
  const client = await createClient(config)
  const calendar = await resolveCalendar(client, config)
  const calendarName = readCalendarDisplayName(calendar)
  const objects = await client.fetchCalendarObjects({
    calendar,
    timeRange: {
      start: startDateIso,
      end: endDateIso,
    },
    expand: true,
  })

  return objects
    .map((calendarObject) => parseIcsEvent(String(calendarObject.data ?? ''), calendarObject.url, calendarName))
    .filter((event): event is CaldavCalendarEvent => Boolean(event))
    .sort((left, right) => left.start - right.start)
}

export async function createCaldavEvent(
  config: StoredCalendarAccountConfig,
  event: CaldavCalendarCreateInput,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const client = await createClient(config)
  const calendar = await resolveCalendar(client, config)
  const uid = randomUUID()
  const filename = `${uid}.ics`
  const response = await client.createCalendarObject({
    calendar,
    filename,
    iCalString: serializeEventToIcs(event, uid),
  })

  if (!response.ok) {
    return {
      success: false,
      error: await readResponseError(response, `CalDAV create failed (${response.status})`),
    }
  }

  return {
    success: true,
    eventId: new URL(filename, calendar.url).toString(),
  }
}

export async function deleteCaldavEvent(
  config: StoredCalendarAccountConfig,
  eventId: string,
): Promise<{ success: boolean; error?: string }> {
  const normalizedId = eventId.trim()
  if (!normalizedId) {
    return { success: false, error: 'eventId is required' }
  }

  // Validate that normalizedId is a valid HTTP/HTTPS URL before making DELETE request
  try {
    const parsed = new URL(normalizedId)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { success: false, error: 'Invalid event URL: must use http or https protocol' }
    }
  } catch {
    return { success: false, error: 'Invalid event URL format' }
  }

  const response = await fetch(normalizedId, {
    method: 'DELETE',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
    },
    signal: AbortSignal.timeout(15000),
  })

  if (response.ok) {
    return { success: true }
  }

  return {
    success: false,
    error: await readResponseError(response, `CalDAV delete failed (${response.status})`),
  }
}
