import { useCallback, useEffect, useState } from 'react'
import type { EmailEntry, EmailFull } from '@shared/types/infrastructure'
import { Mail, RefreshCw } from 'lucide-react'
import { Card, Button, InlineNotice, SectionHeader } from '../ui'
import EmailCompose from './EmailCompose'
import { t } from '../../i18n'
import { hasE2EQueryFlag } from '../../lib/e2e-flags'
import { toEmailErrorMessage } from '../../lib/user-facing-errors'

interface NoticeState {
  tone: 'warning' | 'error' | 'success'
  title: string
  body: string
}

export default function EmailInbox() {
  const forceNotice = hasE2EQueryFlag('usan_e2e_force_email_notice')
  const [configured, setConfigured] = useState(false)
  const [emails, setEmails] = useState<EmailEntry[]>([])
  const [selected, setSelected] = useState<EmailFull | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<NoticeState | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const [isConfigured, list] = await Promise.all([
        window.usan?.email.isConfigured(),
        window.usan?.email.list(20),
      ])
      setConfigured(Boolean(isConfigured))
      setEmails(list ?? [])
    } catch (err) {
      setNotice({
        tone: 'error',
        title: t('email.noticeLoadTitle'),
        body: toEmailErrorMessage(err, 'load'),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (forceNotice) return
    load().catch(() => {})
  }, [forceNotice, load])

  const effectiveConfigured = forceNotice ? false : configured
  const effectiveNotice = forceNotice ? null : notice

  return (
    <Card variant="outline" className="space-y-3" data-view="email-inbox">
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

      {!effectiveConfigured && (
        <InlineNotice tone="warning" title={t('email.noticeSetupTitle')}>
          {t('email.notConfigured')}
        </InlineNotice>
      )}

      {effectiveNotice ? (
        <InlineNotice tone={effectiveNotice.tone} title={effectiveNotice.title}>
          {effectiveNotice.body}
        </InlineNotice>
      ) : null}

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
                    try {
                      setNotice(null)
                      const full = await window.usan?.email.read(email.id)
                      setSelected(full ?? null)
                    } catch (err) {
                      setNotice({
                        tone: 'error',
                        title: t('email.noticeReadTitle'),
                        body: toEmailErrorMessage(err, 'read'),
                      })
                    }
                  }}
                  className={`w-full rounded-[var(--radius-md)] ring-1 px-3 py-2.5 text-left transition-all ${
                    selected?.id === email.id
                      ? 'ring-[var(--color-primary)] bg-[var(--color-primary-muted)] shadow-[var(--shadow-xs)]'
                      : 'ring-[var(--color-border-subtle)] hover:bg-[var(--color-surface-soft)] hover:ring-[var(--color-border)]'
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
            <div className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3">
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
