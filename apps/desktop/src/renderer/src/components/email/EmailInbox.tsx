import { useCallback, useEffect, useState } from 'react'
import type { EmailEntry, EmailFull } from '@shared/types/infrastructure'
import { Mail, RefreshCw } from 'lucide-react'
import { Card, Button, SectionHeader } from '../ui'
import EmailCompose from './EmailCompose'
import { t } from '../../i18n'

export default function EmailInbox() {
  const [configured, setConfigured] = useState(false)
  const [emails, setEmails] = useState<EmailEntry[]>([])
  const [selected, setSelected] = useState<EmailFull | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [isConfigured, list] = await Promise.all([
        window.usan?.email.isConfigured(),
        window.usan?.email.list(20),
      ])
      setConfigured(Boolean(isConfigured))
      setEmails(list ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load().catch(() => {})
  }, [load])

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader
        title={t('email.title')}
        icon={Mail}
        indicator="var(--color-primary)"
        action={(
          <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={() => load()}>
            {t('dashboard.refresh')}
          </Button>
        )}
      />

      {!configured && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-text)]">
          {t('email.notConfigured')}
        </p>
      )}

      {error && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-2">
          {loading ? (
            <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('files.loading')}</p>
          ) : emails.length === 0 ? (
            <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('email.empty')}</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-auto">
              {emails.map((email) => (
                <button
                  key={email.id}
                  type="button"
                  onClick={async () => {
                    const full = await window.usan?.email.read(email.id)
                    setSelected(full ?? null)
                  }}
                  className={`w-full rounded-[var(--radius-md)] border px-3 py-2 text-left ${
                    selected?.id === email.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                      : 'border-[var(--color-border)] hover:bg-[var(--color-surface-soft)]'
                  }`}
                >
                  <p className="truncate text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{email.subject || t('email.noSubject')}</p>
                  <p className="truncate text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{email.from}</p>
                  <p className="truncate text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{email.snippet}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {selected ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
              <p className="text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{selected.subject || t('email.noSubject')}</p>
              <p className="mb-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{selected.from}</p>
              <p className="max-h-32 overflow-auto whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--color-text)]">
                {selected.body}
              </p>
            </div>
          ) : (
            <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('email.selectMessage')}</p>
          )}

          <EmailCompose configured={configured} onSent={() => load().catch(() => {})} />
        </div>
      </div>
    </Card>
  )
}
