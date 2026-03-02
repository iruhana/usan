/**
 * Opt-in analytics — completely optional, privacy-respecting usage tracking.
 * Only sends anonymized event counts. No PII, no message content, no IP tracking.
 *
 * Events are batched and sent once per session on app quit (if opted in).
 * User can disable at any time in settings.
 */

export interface AnalyticsEvent {
  name: string
  count: number
}

let events: Map<string, number> = new Map()
let optedIn = false

export function setAnalyticsOptIn(enabled: boolean): void {
  optedIn = enabled
}

let validEvents: Set<string> | null = null

export function trackEvent(name: string): void {
  if (!optedIn) return
  if (!validEvents) validEvents = new Set(Object.values(Events))
  if (!validEvents.has(name)) return
  events.set(name, (events.get(name) ?? 0) + 1)
}

/** Flush all collected events to server. Called on app quit. */
export async function flushEvents(): Promise<void> {
  if (!optedIn || events.size === 0) return

  const payload: AnalyticsEvent[] = []
  for (const [name, count] of events) {
    payload.push({ name, count })
  }

  try {
    await fetch('https://usan.ai/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: payload, ts: Date.now() }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // Silently fail — analytics are not critical
  }

  events = new Map()
}

/** Common events to track */
export const Events = {
  APP_LAUNCH: 'app.launch',
  CONVERSATION_STARTED: 'conversation.started',
  MESSAGE_SENT: 'message.sent',
  VOICE_INPUT_USED: 'voice.input',
  NOTE_CREATED: 'note.created',
  FILE_BROWSED: 'file.browsed',
  SETTINGS_CHANGED: 'settings.changed',
  SKILL_TRIGGERED: 'skill.triggered',
} as const
