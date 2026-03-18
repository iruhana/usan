import { useState } from 'react'
import { Copy, Link2, Users } from 'lucide-react'
import type {
  CollaborationRemoteDraft,
  CollaborationSessionStatus,
} from '@shared/types/infrastructure'
import type { StoredConversation } from '@shared/types/ipc'
import { t } from '../../i18n'
import { Badge, Button, Card, InlineNotice, Input, SectionHeader } from '../ui'

interface CollaborationPanelProps {
  status: CollaborationSessionStatus
  remoteDraft: CollaborationRemoteDraft | null
  activeConversation: StoredConversation | null
  loading: boolean
  error: string | null
  onStart: () => void
  onJoin: (shareCode: string) => void
  onLeave: () => void
  onClearRemoteDraft: () => void
}

export default function CollaborationPanel({
  status,
  remoteDraft,
  activeConversation,
  loading,
  error,
  onStart,
  onJoin,
  onLeave,
  onClearRemoteDraft,
}: CollaborationPanelProps) {
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)

  const isConnected = status.connected && Boolean(status.shareCode)

  async function handleCopyShareCode(): Promise<void> {
    if (!status.shareCode) return
    try {
      await navigator.clipboard.writeText(status.shareCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore clipboard failures.
    }
  }

  return (
    <Card variant="default" padding="md" data-testid="collaboration-panel">
      <SectionHeader title={t('collaboration.title')} />
      <p className="mb-4 text-[13px] leading-6 text-[var(--color-text-secondary)]">
        {isConnected ? t('collaboration.connectedBody') : t('collaboration.idleBody')}
      </p>

      {error ? (
        <InlineNotice tone="warning" className="mb-4" title={t('collaboration.errorTitle')}>
          {error}
        </InlineNotice>
      ) : null}

      {isConnected ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{status.role === 'host' ? t('collaboration.roleHost') : t('collaboration.roleGuest')}</Badge>
            <Badge variant="default">{`${status.participants.length} ${t('collaboration.participantsCount')}`}</Badge>
            <Badge variant={status.authenticated ? 'success' : 'warning'}>
              {status.authenticated ? t('collaboration.authenticated') : t('collaboration.guestMode')}
            </Badge>
          </div>

          <div
            className="rounded-[20px] bg-[var(--color-panel-muted)] px-4 py-3"
            data-testid="collaboration-share-code"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  {t('collaboration.shareCode')}
                </p>
                <p className="mt-1 text-[17px] font-semibold tracking-[0.14em] text-[var(--color-text)]">
                  {status.shareCode}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Copy size={14} />}
                onClick={() => void handleCopyShareCode()}
              >
                {copied ? t('collaboration.copied') : t('collaboration.copy')}
              </Button>
            </div>
          </div>

          <div
            className="rounded-[20px] bg-[var(--color-panel-muted)] px-4 py-3"
            data-testid="collaboration-participant-list"
          >
            <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-[var(--color-text-secondary)]">
              <Users size={14} />
              <span>{t('collaboration.participantsTitle')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {status.participants.map((participant) => (
                <span
                  key={participant.presenceKey}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-bg-card)] px-3 py-1.5 text-[12px] text-[var(--color-text)] shadow-[var(--shadow-xs)]"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: participant.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {participant.displayName}
                    {participant.isSelf ? ` · ${t('collaboration.you')}` : ''}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {remoteDraft ? (
            <InlineNotice tone="info" title={t('collaboration.remoteDraftTitle')}>
              <div className="space-y-2">
                <p>
                  {`${remoteDraft.author.displayName} ${t('collaboration.remoteDraftBody')}`}
                </p>
                <p className="rounded-[16px] bg-[var(--color-bg-card)] px-3 py-2 text-[12px] text-[var(--color-text)]">
                  {remoteDraft.text}
                </p>
                <button
                  type="button"
                  onClick={onClearRemoteDraft}
                  className="text-[12px] font-semibold text-[var(--color-primary)]"
                >
                  {t('collaboration.dismissPreview')}
                </button>
              </div>
            </InlineNotice>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[var(--color-text)]">
                {activeConversation?.title || t('collaboration.noConversation')}
              </p>
              <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                {status.lastSyncedAt
                  ? new Intl.DateTimeFormat(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(new Date(status.lastSyncedAt))
                  : t('collaboration.waitingForSync')}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onLeave} disabled={loading}>
              {t('collaboration.leave')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<Link2 size={14} />}
            onClick={onStart}
            disabled={loading}
            data-testid="collaboration-start-button"
          >
            {t('collaboration.start')}
          </Button>

          <div className="rounded-[20px] bg-[var(--color-panel-muted)] px-4 py-4">
            <Input
              label={t('collaboration.joinLabel')}
              value={joinCode}
              placeholder={t('collaboration.joinPlaceholder')}
              onChange={(event) => setJoinCode(event.target.value)}
              data-testid="collaboration-join-input"
            />
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onJoin(joinCode)}
                disabled={!joinCode.trim() || loading}
                data-testid="collaboration-join-button"
              >
                {t('collaboration.join')}
              </Button>
            </div>
          </div>

          <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
            {activeConversation ? t('collaboration.readyWithConversation') : t('collaboration.readyWithoutConversation')}
          </p>
        </div>
      )}
    </Card>
  )
}
