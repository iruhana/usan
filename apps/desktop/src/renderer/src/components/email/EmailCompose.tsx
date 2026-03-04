import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { Button, Input } from '../ui'
import { t } from '../../i18n'

interface EmailComposeProps {
  configured: boolean
  onSent?: () => void
}

export default function EmailCompose({ configured, onSent }: EmailComposeProps) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const recipients = useMemo(() => (
    to
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  ), [to])

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-success)]/20 bg-[var(--color-success)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-text)]">
          {success}
        </p>
      )}
      <Input
        label={t('email.to')}
        value={to}
        onChange={(event) => setTo(event.target.value)}
        placeholder="name@example.com, team@example.com"
      />
      <Input
        label={t('email.subject')}
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        placeholder={t('email.subjectPlaceholder')}
      />
      <textarea
        className="min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-text)]"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t('email.bodyPlaceholder')}
      />
      <Button
        size="sm"
        leftIcon={<Send size={14} />}
        disabled={!configured || recipients.length === 0 || subject.trim().length === 0}
        onClick={async () => {
          setError(null)
          setSuccess(null)
          const result = await window.usan?.email.send(recipients, subject.trim(), body)
          if (result?.success) {
            setBody('')
            setSuccess(t('email.sendSuccess'))
            onSent?.()
          } else {
            setError(result?.error ?? t('error.unknown'))
          }
        }}
      >
        {t('email.send')}
      </Button>
    </div>
  )
}
