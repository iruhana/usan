type ObservablePayload = Record<string, unknown>

type ObsLevel = 'off' | 'warn' | 'info'

function getObsLevel(): ObsLevel {
  const raw = (process.env.USAN_OBS_LEVEL ?? 'warn').toLowerCase()
  if (raw === 'off' || raw === 'warn' || raw === 'info') return raw
  return 'warn'
}

function redactSecrets(input: string): string {
  return input
    .replace(/("?(?:api[_-]?key|token|secret|password)"?\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
    .replace(/\b(sk-[A-Za-z0-9_-]{16,})\b/g, '[REDACTED_OPENAI_KEY]')
    .replace(/\b(szn_[A-Za-z0-9_-]{16,})\b/g, '[REDACTED_SEIZN_KEY]')
}

function safeSerialize(payload: ObservablePayload): string {
  try {
    return redactSecrets(JSON.stringify(payload))
  } catch {
    return '{"error":"serialize_failed"}'
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

export function logObsInfo(event: string, payload: ObservablePayload): void {
  const level = getObsLevel()
  if (level === 'off' || level === 'warn') return
  console.info(`[usan.obs] ${nowIso()} ${event} ${safeSerialize(payload)}`)
}

export function logObsWarn(event: string, payload: ObservablePayload): void {
  const level = getObsLevel()
  if (level === 'off') return
  console.warn(`[usan.obs] ${nowIso()} ${event} ${safeSerialize(payload)}`)
}
