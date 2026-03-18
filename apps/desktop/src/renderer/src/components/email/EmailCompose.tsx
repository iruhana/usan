import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { Button, InlineNotice, Input } from '../ui'
import { t } from '../../i18n'
import { toEmailErrorMessage } from '../../lib/user-facing-errors'

interface EmailComposeProps {
  configured: boolean
  onSent?: () => void
}

interface NoticeState {
  tone: 'error' | 'success'
  title: string
  body: string
}

export default function EmailCompose({ configured, onSent }: EmailComposeProps) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [notice, setNotice] = useState<NoticeState | null>(null)

  const recipients = useMemo(() => (
    to
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  ), [to])

  return (
    <div className="space-y-2">
      {notice ? (
        <InlineNotice tone={notice.tone} title={notice.title}>
          {notice.body}
        </InlineNotice>
      ) : null}
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
      <div className="space-y-1">
        <label className="text-[length:var(--text-sm)] font-medium text-[var(--color-text-muted)]">{t('email.body')}</label>
        <textarea
          className="min-h-24 w-full rounded-[var(--radius-md)] ring-1 ring-transparent bg-[var(--color-surface-soft)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-text)] outline-none transition-all focus:ring-[var(--color-primary)] focus:shadow-[var(--shadow-primary)] focus:bg-[var(--color-bg-card)]"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t('email.bodyPlaceholder')}
        />
      </div>
      <Button
        size="sm"
        leftIcon={<Send size={14} />}
        disabled={!configured || recipients.length === 0 || subject.trim().length === 0}
        onClick={async () => {
          setNotice(null)
          const result = await window.usan?.email.send(recipients, subject.trim(), body)
          if (result?.success) {
            setBody('')
            setNotice({
              tone: 'success',
              title: t('email.noticeSendSuccessTitle'),
              body: t('email.sendSuccess'),
            })
            onSent?.()
          } else {
            setNotice({
              tone: 'error',
              title: t('email.noticeSendTitle'),
              body: toEmailErrorMessage(result?.error ?? t('error.unknown'), 'send'),
            })
          }
        }}
      >
        {t('email.send')}
      </Button>
    </div>
  )
}
