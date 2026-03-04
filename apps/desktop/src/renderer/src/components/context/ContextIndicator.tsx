import { useEffect, useState } from 'react'
import { Monitor } from 'lucide-react'
import type { ContextSnapshot } from '@shared/types/infrastructure'
import { t } from '../../i18n'

function appLabel(app: string): string {
  const key = `context.app.${app.toLowerCase()}`
  const translated = t(key)
  return translated === key ? app : translated
}

export default function ContextIndicator() {
  const [snapshot, setSnapshot] = useState<ContextSnapshot | null>(null)

  useEffect(() => {
    let unsub: (() => void) | null = null

    window.usan?.context.getSnapshot().then((next) => setSnapshot(next ?? null)).catch(() => {})
    unsub = window.usan?.context.onChanged((next) => setSnapshot(next)) ?? null

    return () => {
      if (unsub) unsub()
    }
  }, [])

  if (!snapshot?.activeWindow) return null

  return (
    <span className="inline-flex items-center gap-1.5" title={snapshot.activeWindow.title || snapshot.activeApp}>
      <Monitor size={12} className="text-[var(--color-text-muted)]" />
      <span>{appLabel(snapshot.activeApp || t('context.unknown'))}</span>
    </span>
  )
}
