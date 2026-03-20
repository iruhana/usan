/**
 * Z4 Main Workspace
 * Tabbed surface: conversation, preview, artifact views.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ArtifactKind,
  PreviewStatus,
  ShellApproval,
  ShellAttachment,
  ShellArtifact,
  ShellChatMessage,
  ShellLog,
  ShellPreview,
  ShellTemplate,
  StreamChunk,
} from '@shared/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  User, Bot, GitBranch, Sparkles,
  MessageSquare, Eye, FileCode,
  ShieldAlert,
} from 'lucide-react'
import { useChatStore } from '../../stores/chat.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useShellStore } from '../../stores/shell.store'
import Composer from './Composer'
import AttachmentDeliveryBadge from './AttachmentDeliveryBadge'
import AttachmentTextDisclosure from './AttachmentTextDisclosure'
import PreviewPanel from '../panels/PreviewPanel'
import ArtifactPanel from '../panels/ArtifactPanel'
import {
  findLatestAttachmentDeliveryLog,
  getAttachmentDeliveryModePresentation,
} from '../../utils/attachmentDelivery'

type WorkspaceTab = 'chat' | 'compare' | 'preview' | 'artifact'

const BASE_WORKSPACE_TABS: { id: Exclude<WorkspaceTab, 'compare'>; icon: typeof MessageSquare; label: string }[] = [
  { id: 'chat', icon: MessageSquare, label: '대화' },
  { id: 'preview', icon: Eye, label: '프리뷰' },
  { id: 'artifact', icon: FileCode, label: '아티팩트' },
]

const PREVIEW_STATUS_LABELS: Record<PreviewStatus, { label: string; color: string; background: string }> = {
  healthy: { label: '정상', color: 'var(--success)', background: 'var(--success-soft)' },
  partial: { label: '부분', color: 'var(--warning)', background: 'var(--warning-soft)' },
  stale: { label: '오래됨', color: 'var(--text-muted)', background: 'var(--bg-hover)' },
  failed: { label: '실패', color: 'var(--danger)', background: 'var(--danger-soft)' },
}

const ARTIFACT_KIND_LABELS: Record<ArtifactKind, string> = {
  code: '코드',
  markdown: '마크다운',
  json: 'JSON',
  diff: 'Diff',
  plan: '계획',
  preview: '프리뷰',
}

const APPROVAL_STATUS_LABELS = {
  pending: { label: '대기', color: 'var(--warning)', background: 'var(--warning-soft)' },
  approved: { label: '승인됨', color: 'var(--success)', background: 'var(--success-soft)' },
  denied: { label: '거부', color: 'var(--danger)', background: 'var(--danger-soft)' },
} as const

const LOG_KIND_LABELS = {
  attachment: { label: 'attachment', color: 'var(--warning)', background: 'var(--warning-soft)' },
  session: { label: '세션', color: 'var(--accent)', background: 'var(--accent-soft)' },
  tool: { label: '도구', color: 'var(--success)', background: 'var(--success-soft)' },
  approval: { label: '승인', color: 'var(--warning)', background: 'var(--warning-soft)' },
  system: { label: '시스템', color: 'var(--text-secondary)', background: 'var(--bg-hover)' },
} as const

const LOG_STATUS_LABELS = {
  pending: { label: '대기', color: 'var(--warning)', background: 'var(--warning-soft)' },
  running: { label: '실행 중', color: 'var(--accent)', background: 'var(--accent-soft)' },
  success: { label: '완료', color: 'var(--success)', background: 'var(--success-soft)' },
  failed: { label: '실패', color: 'var(--danger)', background: 'var(--danger-soft)' },
  skipped: { label: '건너뜀', color: 'var(--text-muted)', background: 'var(--bg-hover)' },
  approved: { label: '승인됨', color: 'var(--success)', background: 'var(--success-soft)' },
  denied: { label: '거부', color: 'var(--danger)', background: 'var(--danger-soft)' },
} as const

function getLatestArtifact(artifacts: ShellArtifact[]): ShellArtifact | undefined {
  return artifacts.reduce<ShellArtifact | undefined>((latest, artifact) => {
    if (!latest || artifact.version >= latest.version) {
      return artifact
    }
    return latest
  }, undefined)
}

function groupSentAttachmentsByMessageId(attachments: ShellAttachment[]): Map<string, ShellAttachment[]> {
  const lookup = new Map<string, ShellAttachment[]>()

  for (const attachment of attachments) {
    if (!attachment.messageId || attachment.status !== 'sent') {
      continue
    }

    const existing = lookup.get(attachment.messageId) ?? []
    existing.push(attachment)
    lookup.set(attachment.messageId, existing)
  }

  return lookup
}

export default function Workspace() {
  const activeSessionId = useShellStore((state) => state.activeSessionId)
  const sessions = useShellStore((state) => state.sessions)
  const messages = useShellStore((state) => state.messages)
  const attachments = useShellStore((state) => state.attachments)
  const artifacts = useShellStore((state) => state.artifacts)
  const approvals = useShellStore((state) => state.approvals)
  const logs = useShellStore((state) => state.logs)
  const templates = useShellStore((state) => state.templates)
  const previews = useShellStore((state) => state.previews)
  const branchSession = useShellStore((state) => state.branchSession)
  const promoteSession = useShellStore((state) => state.promoteSession)
  const resolveApproval = useShellStore((state) => state.resolveApproval)
  const restoreSession = useShellStore((state) => state.restoreSession)
  const setActiveSession = useShellStore((state) => state.setActiveSession)
  const showTemplates = useSettingsStore((state) => state.settings.showTemplates)
  const streaming = useChatStore((state) => state.streaming)
  const streamingContent = useChatStore((state) => state.streamingContent)
  const streamingSessionId = useChatStore((state) => state.streamingSessionId)
  const error = useChatStore((state) => state.error)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('chat')
  const bottomRef = useRef<HTMLDivElement>(null)

  const sessionMessages = useMemo(() => (
    activeSessionId
      ? messages.filter((message) => message.sessionId === activeSessionId)
      : []
  ), [activeSessionId, messages])
  const activeSession = sessions.find((session) => session.id === activeSessionId)
  const branchSourceSession = activeSession?.branchedFromSessionId
    ? sessions.find((session) => session.id === activeSession.branchedFromSessionId)
    : undefined
  const branchSourceMessage = activeSession?.branchedFromSessionId && activeSession.branchedFromMessageId
    ? messages.find((message) => (
      message.id === activeSession.branchedFromMessageId
      && message.sessionId === activeSession.branchedFromSessionId
    ))
    : undefined
  const branchSourceMessages = useMemo(() => (
    branchSourceSession
      ? messages.filter((message) => message.sessionId === branchSourceSession.id)
      : []
  ), [branchSourceSession, messages])
  const sessionArtifacts = useMemo(() => (
    activeSessionId
      ? artifacts.filter((artifact) => artifact.sessionId === activeSessionId)
      : []
  ), [activeSessionId, artifacts])
  const sessionAttachments = useMemo(() => (
    activeSessionId
      ? attachments.filter((attachment) => attachment.sessionId === activeSessionId)
      : []
  ), [activeSessionId, attachments])
  const sessionAttachmentsByMessageId = useMemo(
    () => groupSentAttachmentsByMessageId(sessionAttachments),
    [sessionAttachments],
  )
  const sessionApprovals = useMemo(() => (
    activeSessionId
      ? approvals.filter((approval) => approval.sessionId === activeSessionId)
      : []
  ), [activeSessionId, approvals])
  const sessionLogs = useMemo(() => (
    activeSessionId
      ? logs.filter((log) => log.sessionId === activeSessionId)
      : []
  ), [activeSessionId, logs])
  const activePendingApproval = sessionApprovals.find((approval) => approval.status === 'pending')
  const branchSourceArtifacts = useMemo(() => (
    branchSourceSession
      ? artifacts.filter((artifact) => artifact.sessionId === branchSourceSession.id)
      : []
  ), [artifacts, branchSourceSession])
  const branchSourceAttachments = useMemo(() => (
    branchSourceSession
      ? attachments.filter((attachment) => attachment.sessionId === branchSourceSession.id)
      : []
  ), [attachments, branchSourceSession])
  const branchSourceAttachmentsByMessageId = useMemo(
    () => groupSentAttachmentsByMessageId(branchSourceAttachments),
    [branchSourceAttachments],
  )
  const branchSourceApprovals = useMemo(() => (
    branchSourceSession
      ? approvals.filter((approval) => approval.sessionId === branchSourceSession.id)
      : []
  ), [approvals, branchSourceSession])
  const branchSourceLogs = useMemo(() => (
    branchSourceSession
      ? logs.filter((log) => log.sessionId === branchSourceSession.id)
      : []
  ), [logs, branchSourceSession])
  const activePreview = previews.find((preview) => preview.sessionId === activeSessionId)
  const sourcePreview = branchSourceSession
    ? previews.find((preview) => preview.sessionId === branchSourceSession.id)
    : undefined
  const latestSessionArtifact = useMemo(() => getLatestArtifact(sessionArtifacts), [sessionArtifacts])
  const latestSourceArtifact = useMemo(() => getLatestArtifact(branchSourceArtifacts), [branchSourceArtifacts])
  const compareEnabled = Boolean(activeSession?.branchedFromSessionId && branchSourceSession)
  const sharedMessageCount = compareEnabled
    ? activeSession?.branchedFromMessageId
      ? Math.max(0, branchSourceMessages.findIndex((message) => message.id === activeSession.branchedFromMessageId) + 1)
      : branchSourceMessages.length
    : 0
  const branchAnchorMessage = sharedMessageCount > 0
    ? branchSourceMessages[sharedMessageCount - 1]
    : undefined
  const currentBranchAnchorMessage = sharedMessageCount > 0
    ? sessionMessages[sharedMessageCount - 1]
    : undefined
  const branchAnchorSourceAttachments = branchAnchorMessage
    ? branchSourceAttachmentsByMessageId.get(branchAnchorMessage.id) ?? []
    : []
  const branchAnchorCurrentAttachments = currentBranchAnchorMessage
    ? sessionAttachmentsByMessageId.get(currentBranchAnchorMessage.id) ?? []
    : []
  const sourceContinuation = compareEnabled
    ? branchSourceMessages.slice(sharedMessageCount)
    : []
  const currentContinuation = compareEnabled
    ? sessionMessages.slice(sharedMessageCount)
    : []
  const workspaceTabs: { id: WorkspaceTab; icon: typeof MessageSquare; label: string }[] = compareEnabled
    ? [
      BASE_WORKSPACE_TABS[0],
      { id: 'compare', icon: GitBranch, label: '비교' },
      ...BASE_WORKSPACE_TABS.slice(1),
    ]
    : BASE_WORKSPACE_TABS
  const resolvedActiveTab = activeTab === 'compare' && !compareEnabled ? 'chat' : activeTab
  const hasConversation = sessionMessages.length > 0
    || (streaming && streamingSessionId === activeSessionId)
    || Boolean(error)
  const promoteBlocked = (streaming && streamingSessionId === activeSessionId)
    || activeSession?.status === 'running'

  async function jumpToBranchSource(): Promise<void> {
    if (!branchSourceSession) {
      return
    }

    if (branchSourceSession.archivedAt) {
      await restoreSession(branchSourceSession.id)
    }

    await setActiveSession(branchSourceSession.id)
  }

  useEffect(() => {
    const unsubscribe = window.usan.ai.onChunk((chunk: StreamChunk) => {
      const chatStore = useChatStore.getState()
      if (!chatStore.streamingId || chunk.requestId !== chatStore.streamingId) {
        return
      }

      switch (chunk.type) {
        case 'text_delta':
          chatStore.appendStream(chunk.text)
          break
        case 'error':
          chatStore.setError(chunk.error)
          break
        case 'done':
          chatStore.finishStreaming()
          break
        default:
          break
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (resolvedActiveTab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [resolvedActiveTab, error, sessionMessages, streaming, streamingContent])

  return (
    <div
      data-shell-zone="workspace"
      data-shell-tab={resolvedActiveTab}
      style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      overflow: 'hidden',
      background: 'var(--bg-base)',
    }}
    >
      <div role="tablist" aria-label="워크스페이스 탭" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--sp-3)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        flexShrink: 0,
      }}>
        {workspaceTabs.map((tab) => {
          const Icon = tab.icon
          const active = resolvedActiveTab === tab.id
          return (
            <button
              role="tab"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-selected={active}
              className="focus-ring"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-1)',
                padding: '8px 12px',
                fontSize: 'var(--fs-sm)',
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: 'transparent',
                border: 'none',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: `color var(--dur-micro)`,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <Icon size={13} strokeWidth={active ? 2 : 1.5} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {resolvedActiveTab === 'chat' && (
        <>
          {activePendingApproval && (
            <PendingApprovalBanner
              approval={activePendingApproval}
              onResolve={(decision) => { void resolveApproval(activePendingApproval.id, decision) }}
            />
          )}
          {activeSession?.branchedFromSessionId && (
            <BranchBanner
              sessionTitle={branchSourceSession?.title ?? activeSession.branchedFromSessionId}
              sourceMessage={branchSourceMessage?.content}
              sourceModel={branchSourceSession?.model}
              currentModel={activeSession.model}
              sourceArchived={Boolean(branchSourceSession?.archivedAt)}
              onJump={() => { void jumpToBranchSource() }}
            />
          )}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {hasConversation ? (
              <div style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--sp-6) var(--sp-4)' }}>
                {sessionMessages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    attachments={sessionAttachmentsByMessageId.get(message.id) ?? []}
                    modelId={activeSession?.model}
                    sessionLogs={sessionLogs}
                    onBranch={
                      activeSessionId
                        ? () => { void branchSession(activeSessionId, { sourceMessageId: message.id }) }
                        : undefined
                    }
                  />
                ))}
                {streaming && streamingSessionId === activeSessionId && (
                  <MessageBubble
                    message={{ id: 'streaming', sessionId: activeSessionId ?? 'streaming', role: 'assistant', content: streamingContent || '...', ts: 0 }}
                    attachments={[]}
                  />
                )}
                {error && (
                  <div style={{
                    marginTop: 'var(--sp-4)',
                    padding: 'var(--sp-3)',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: '#fca5a5',
                    fontSize: 'var(--fs-sm)',
                  }}>
                    {error}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            ) : (
              <EmptyState templates={templates} showTemplates={showTemplates} />
            )}
          </div>
          <Composer />
        </>
      )}
      {resolvedActiveTab === 'preview' && (
        <PreviewPanel
          status={activePreview?.status}
          title={activePreview?.title}
          version={activePreview?.version}
        />
      )}
      {resolvedActiveTab === 'compare' && compareEnabled && (
        <ComparePanel
          branchAnchorMessage={branchAnchorMessage}
          sourceAnchorAttachments={branchAnchorSourceAttachments}
          currentAnchorAttachments={branchAnchorCurrentAttachments}
          sourceMessages={sourceContinuation}
          currentMessages={currentContinuation}
          sourceModel={branchSourceSession?.model}
          currentModel={activeSession?.model ?? ''}
          sourcePreview={sourcePreview}
          currentPreview={activePreview}
          sourceApprovals={branchSourceApprovals}
          currentApprovals={sessionApprovals}
          sourceLogs={branchSourceLogs}
          currentLogs={sessionLogs}
          sourceArtifact={latestSourceArtifact}
          currentArtifact={latestSessionArtifact}
          sourceAttachments={branchSourceAttachments}
          currentAttachments={sessionAttachments}
          sourceSessionId={branchSourceSession?.id}
          currentSessionId={activeSessionId ?? undefined}
          currentModelId={activeSession?.model}
          sourceAttachmentsByMessageId={branchSourceAttachmentsByMessageId}
          currentAttachmentsByMessageId={sessionAttachmentsByMessageId}
          onPromote={
            activeSession
              ? () => { void promoteSession(activeSession.id) }
              : undefined
          }
          promoteDisabled={promoteBlocked}
        />
      )}
      {resolvedActiveTab === 'artifact' && <ArtifactPanel sessionId={activeSessionId ?? undefined} />}
    </div>
  )
}

function PendingApprovalBanner({
  approval,
  onResolve,
}: {
  approval: ShellApproval
  onResolve: (decision: 'approved' | 'denied') => void
}) {
  const riskColor = approval.risk === 'high'
    ? 'var(--danger)'
    : approval.risk === 'medium'
      ? 'var(--warning)'
      : 'var(--success)'
  const riskBackground = approval.risk === 'high'
    ? 'var(--danger-soft)'
    : approval.risk === 'medium'
      ? 'var(--warning-soft)'
      : 'var(--success-soft)'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--sp-3)',
      padding: 'var(--sp-3) var(--sp-4)',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-default)',
      flexShrink: 0,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-1)', flexWrap: 'wrap' }}>
          <ShieldAlert size={14} style={{ color: riskColor }} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            승인 필요: {approval.action}
          </span>
          <span style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            color: riskColor,
            background: riskBackground,
            borderRadius: '999px',
            padding: '2px 8px',
          }}>
            {approval.risk}
          </span>
          <span style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-secondary)',
            background: 'var(--bg-elevated)',
            borderRadius: '999px',
            padding: '2px 8px',
          }}>
            {approval.capability}
          </span>
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
          {approval.detail}
        </div>
        {approval.fallback && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
            거부 시: {approval.fallback}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => onResolve('approved')}
          aria-label="워크스페이스 승인 승인"
          className="focus-ring"
          style={{
            padding: '6px 12px',
            borderRadius: '999px',
            border: 'none',
            background: 'var(--accent)',
            color: 'var(--text-inverse)',
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          승인
        </button>
        <button
          type="button"
          onClick={() => onResolve('denied')}
          aria-label="워크스페이스 승인 거부"
          className="focus-ring"
          style={{
            padding: '6px 12px',
            borderRadius: '999px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          거부
        </button>
      </div>
    </div>
  )
}

function BranchBanner({
  sessionTitle,
  sourceMessage,
  sourceModel,
  currentModel,
  sourceArchived,
  onJump,
}: {
  sessionTitle: string
  sourceMessage?: string
  sourceModel?: string
  currentModel: string
  sourceArchived: boolean
  onJump: () => void
}) {
  const sourceMessagePreview = sourceMessage
    ? sourceMessage.length > 120
      ? `${sourceMessage.slice(0, 117).trimEnd()}...`
      : sourceMessage
    : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--sp-3)',
      padding: 'var(--sp-3) var(--sp-4)',
      background: 'var(--accent-soft)',
      borderBottom: '1px solid var(--border-default)',
      flexShrink: 0,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--accent)', marginBottom: 'var(--sp-1)' }}>
          이 세션은 분기본입니다
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>
          원본 세션: {sessionTitle}
        </div>
        {sourceMessagePreview && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
            분기 기준 메시지: “{sourceMessagePreview}”
          </div>
        )}
        {sourceModel && sourceModel !== currentModel && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
            모델 비교 컨텍스트: {sourceModel} → {currentModel}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onJump}
        aria-label={sourceArchived ? '원본 복원 후 이동' : '원본으로 이동'}
        className="focus-ring"
        style={{
          padding: '6px 12px',
          borderRadius: '999px',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {sourceArchived ? '원본 복원 후 이동' : '원본으로 이동'}
      </button>
    </div>
  )
}

function ComparePanel({
  branchAnchorMessage,
  sourceAnchorAttachments,
  currentAnchorAttachments,
  sourceMessages,
  currentMessages,
  sourceModel,
  currentModel,
  sourcePreview,
  currentPreview,
  sourceApprovals,
  currentApprovals,
  sourceLogs,
  currentLogs,
  sourceArtifact,
  currentArtifact,
  sourceAttachments,
  currentAttachments,
  sourceSessionId,
  currentSessionId,
  currentModelId,
  sourceAttachmentsByMessageId,
  currentAttachmentsByMessageId,
  onPromote,
  promoteDisabled,
}: {
  branchAnchorMessage?: ShellChatMessage
  sourceAnchorAttachments: ShellAttachment[]
  currentAnchorAttachments: ShellAttachment[]
  sourceMessages: ShellChatMessage[]
  currentMessages: ShellChatMessage[]
  sourceModel?: string
  currentModel: string
  sourcePreview?: ShellPreview
  currentPreview?: ShellPreview
  sourceApprovals: ShellApproval[]
  currentApprovals: ShellApproval[]
  sourceLogs: ShellLog[]
  currentLogs: ShellLog[]
  sourceArtifact?: ShellArtifact
  currentArtifact?: ShellArtifact
  sourceAttachments: ShellAttachment[]
  currentAttachments: ShellAttachment[]
  sourceSessionId?: string
  currentSessionId?: string
  currentModelId?: string
  sourceAttachmentsByMessageId: Map<string, ShellAttachment[]>
  currentAttachmentsByMessageId: Map<string, ShellAttachment[]>
  onPromote?: () => void
  promoteDisabled: boolean
}) {
  const promoteActionDisabled = !onPromote || promoteDisabled

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: 'var(--sp-5) var(--sp-4) var(--sp-6)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--sp-3)',
          marginBottom: 'var(--sp-4)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-1)' }}>
              분기 비교
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
              분기 이후 원본 응답과 현재 분기 응답을 나란히 확인합니다.
            </div>
          </div>
          <button
            type="button"
            onClick={onPromote}
            disabled={promoteActionDisabled}
            title={promoteDisabled ? '응답 생성이 끝난 뒤 승격할 수 있습니다.' : undefined}
            className="focus-ring"
            style={{
              padding: '8px 12px',
              borderRadius: '999px',
              border: '1px solid var(--border-default)',
              background: promoteActionDisabled ? 'var(--bg-elevated)' : 'var(--bg-surface)',
              color: promoteActionDisabled ? 'var(--text-muted)' : 'var(--text-primary)',
              fontSize: 'var(--fs-xs)',
              fontWeight: 600,
              cursor: promoteActionDisabled ? 'not-allowed' : 'pointer',
              opacity: promoteActionDisabled ? 0.7 : 1,
              flexShrink: 0,
            }}
          >
            메인 스레드로 승격
          </button>
        </div>

        {branchAnchorMessage && (
          <div style={{
            marginBottom: 'var(--sp-4)',
            padding: 'var(--sp-3)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
          }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent)', marginBottom: 'var(--sp-1)' }}>
              분기 기준
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', lineHeight: 'var(--lh-relaxed)' }}>
              {branchAnchorMessage.content}
            </div>
            {(sourceAnchorAttachments.length > 0 || currentAnchorAttachments.length > 0) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 'var(--sp-3)',
                marginTop: 'var(--sp-3)',
              }}>
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}>
                    원본 첨부
                  </div>
                  {sourceAnchorAttachments.length > 0 ? (
                    <MessageAttachmentStrip
                      attachments={sourceAnchorAttachments}
                      modelId={sourceModel}
                      sessionId={sourceSessionId}
                      logs={sourceLogs}
                      context="compare"
                    />
                  ) : (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                      원본 기준 메시지에는 첨부가 없습니다.
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}>
                    분기 첨부
                  </div>
                  {currentAnchorAttachments.length > 0 ? (
                    <MessageAttachmentStrip
                      attachments={currentAnchorAttachments}
                      modelId={currentModelId}
                      sessionId={currentSessionId}
                      logs={currentLogs}
                      context="compare"
                    />
                  ) : (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                      분기 기준 메시지에는 첨부가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {(sourcePreview || currentPreview) && (
          <CompareSection title="현재 프리뷰" description="분기본과 원본의 현재 프리뷰 상태를 함께 확인합니다.">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--sp-4)',
            }}>
              <PreviewCompareCard
                title="원본 프리뷰"
                model={sourceModel}
                preview={sourcePreview}
                emptyLabel="원본 세션에는 연결된 프리뷰가 없습니다."
              />
              <PreviewCompareCard
                title="분기 프리뷰"
                model={currentModel}
                preview={currentPreview}
                emptyLabel="현재 분기에는 연결된 프리뷰가 없습니다."
              />
            </div>
          </CompareSection>
        )}

        {(sourceApprovals.length > 0 || currentApprovals.length > 0) && (
          <CompareSection title="승인 상태" description="원본과 분기 세션의 승인 이력을 함께 확인합니다.">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--sp-4)',
            }}>
              <ApprovalCompareCard
                title="원본 승인"
                approvals={sourceApprovals}
                emptyLabel="원본 세션에는 승인 이력이 없습니다."
              />
              <ApprovalCompareCard
                title="분기 승인"
                approvals={currentApprovals}
                emptyLabel="현재 분기에는 승인 이력이 없습니다."
              />
            </div>
          </CompareSection>
        )}

        {(sourceLogs.length > 0 || currentLogs.length > 0) && (
          <CompareSection title="실행 로그" description="분기 이후 원본과 현재 세션의 최근 실행 로그를 함께 검토합니다.">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--sp-4)',
            }}>
              <LogCompareCard
                title="원본 로그"
                logs={sourceLogs}
                emptyLabel="원본 세션에는 비교할 실행 로그가 없습니다."
              />
              <LogCompareCard
                title="분기 로그"
                logs={currentLogs}
                emptyLabel="현재 분기에는 비교할 실행 로그가 없습니다."
              />
            </div>
          </CompareSection>
        )}

        {(sourceArtifact || currentArtifact) && (
          <CompareSection title="저장된 결과" description="분기 이후 각 세션의 최신 아티팩트를 나란히 검토합니다.">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--sp-4)',
            }}>
              <ArtifactCompareCard
                title="원본 아티팩트"
                artifact={sourceArtifact}
                emptyLabel="원본 세션에는 비교할 저장 결과가 없습니다."
              />
              <ArtifactCompareCard
                title="분기 아티팩트"
                artifact={currentArtifact}
                emptyLabel="현재 분기에는 비교할 저장 결과가 없습니다."
              />
            </div>
          </CompareSection>
        )}

        {(sourceAttachments.length > 0 || currentAttachments.length > 0) && (
          <CompareSection title="첨부 비교" description="분기 이후 세션별 첨부 파일과 추출 텍스트를 같이 확인합니다.">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--sp-4)',
            }}>
              <AttachmentCompareCard
                title="원본 첨부"
                attachments={sourceAttachments}
                modelId={sourceModel}
                sessionId={sourceSessionId}
                logs={sourceLogs}
                emptyLabel="원본 세션에는 비교할 첨부가 없습니다."
              />
              <AttachmentCompareCard
                title="분기 첨부"
                attachments={currentAttachments}
                modelId={currentModelId}
                sessionId={currentSessionId}
                logs={currentLogs}
                emptyLabel="현재 분기에는 비교할 첨부가 없습니다."
              />
            </div>
          </CompareSection>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 'var(--sp-4)',
          alignItems: 'start',
        }}>
          <CompareColumn
            title="원본 응답"
            model={sourceModel}
            messages={sourceMessages}
            attachmentsByMessageId={sourceAttachmentsByMessageId}
            sessionLogs={sourceLogs}
            emptyLabel="원본 세션에는 분기 이후 추가 응답이 없습니다."
          />
          <CompareColumn
            title="분기 응답"
            model={currentModel}
            messages={currentMessages}
            attachmentsByMessageId={currentAttachmentsByMessageId}
            sessionLogs={currentLogs}
            emptyLabel="현재 분기에는 아직 후속 응답이 없습니다."
          />
        </div>
      </div>
    </div>
  )
}

function CompareSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 'var(--sp-4)' }}>
      <div style={{ marginBottom: 'var(--sp-2)' }}>
        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--accent)', marginBottom: 'var(--sp-1)' }}>
          {title}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
          {description}
        </div>
      </div>
      {children}
    </section>
  )
}

function ApprovalCompareCard({
  title,
  approvals,
  emptyLabel,
}: {
  title: string
  approvals: ShellApproval[]
  emptyLabel: string
}) {
  const counts = approvals.reduce((summary, approval) => {
    summary[approval.status] += 1
    return summary
  }, {
    pending: 0,
    approved: 0,
    denied: 0,
  })

  return (
    <section style={{
      minWidth: 0,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-3)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {(['pending', 'approved', 'denied'] as const).map((status) => (
            counts[status] > 0 ? (
              <span
                key={status}
                style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  color: APPROVAL_STATUS_LABELS[status].color,
                  background: APPROVAL_STATUS_LABELS[status].background,
                  borderRadius: '999px',
                  padding: '2px 8px',
                }}
              >
                {APPROVAL_STATUS_LABELS[status].label} {counts[status]}
              </span>
            ) : null
          ))}
        </div>
      </div>

      {approvals.length > 0 ? (
        <div style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {approvals.map((approval) => (
            <div
              key={approval.id}
              style={{
                padding: 'var(--sp-2)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-1)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {approval.action}
                </span>
                <span
                  style={{
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 600,
                    color: APPROVAL_STATUS_LABELS[approval.status].color,
                    background: APPROVAL_STATUS_LABELS[approval.status].background,
                    borderRadius: '999px',
                    padding: '2px 8px',
                  }}
                >
                  {APPROVAL_STATUS_LABELS[approval.status].label}
                </span>
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                {approval.capability}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: 'var(--sp-4)',
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}>
          {emptyLabel}
        </div>
      )}
    </section>
  )
}

function LogCompareCard({
  title,
  logs,
  emptyLabel,
}: {
  title: string
  logs: ShellLog[]
  emptyLabel: string
}) {
  const recentLogs = logs.slice(-5).reverse()
  const statusCounts = recentLogs.reduce<Record<keyof typeof LOG_STATUS_LABELS, number>>((summary, log) => {
    if (log.status) {
      summary[log.status] += 1
    }
    return summary
  }, {
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    approved: 0,
    denied: 0,
  })

  return (
    <section style={{
      minWidth: 0,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-3)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {(Object.keys(LOG_STATUS_LABELS) as Array<keyof typeof LOG_STATUS_LABELS>).map((status) => (
            statusCounts[status] > 0 ? (
              <span
                key={status}
                style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  color: LOG_STATUS_LABELS[status].color,
                  background: LOG_STATUS_LABELS[status].background,
                  borderRadius: '999px',
                  padding: '2px 8px',
                }}
              >
                {LOG_STATUS_LABELS[status].label} {statusCounts[status]}
              </span>
            ) : null
          ))}
        </div>
      </div>

      {recentLogs.length > 0 ? (
        <div style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {recentLogs.map((log) => {
            const attachmentDeliveryBadge = log.attachmentDeliveryMode
              ? getAttachmentDeliveryModePresentation(log.attachmentDeliveryMode, log.modelId)
              : null

            return (
              <div
                key={log.id}
                style={{
                  padding: 'var(--sp-2)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-1)' }}>
                  {log.kind && (
                    <span
                      style={{
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 600,
                        color: LOG_KIND_LABELS[log.kind].color,
                        background: LOG_KIND_LABELS[log.kind].background,
                        borderRadius: '999px',
                        padding: '2px 8px',
                      }}
                    >
                      {LOG_KIND_LABELS[log.kind].label}
                    </span>
                  )}
                  {log.status && (
                    <span
                      style={{
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 600,
                        color: LOG_STATUS_LABELS[log.status].color,
                        background: LOG_STATUS_LABELS[log.status].background,
                        borderRadius: '999px',
                        padding: '2px 8px',
                      }}
                    >
                      {LOG_STATUS_LABELS[log.status].label}
                    </span>
                  )}
                  {log.capability && (
                    <span style={{
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-base)',
                      borderRadius: '999px',
                      padding: '2px 8px',
                    }}>
                      {log.capability}
                    </span>
                  )}
                  {log.toolName && (
                    <span style={{
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-base)',
                      borderRadius: '999px',
                      padding: '2px 8px',
                    }}>
                      {log.toolName}
                    </span>
                  )}
                  {log.attachmentName && (
                    <span style={{
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-base)',
                      borderRadius: '999px',
                      padding: '2px 8px',
                    }}>
                      {log.attachmentName}
                    </span>
                  )}
                  {attachmentDeliveryBadge && (
                    <span style={{
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 600,
                      color: attachmentDeliveryBadge.color,
                      background: attachmentDeliveryBadge.background,
                      borderRadius: '999px',
                      padding: '2px 8px',
                    }}>
                      {attachmentDeliveryBadge.label}
                    </span>
                  )}
                  {log.modelId && (
                    <span style={{
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 600,
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      borderRadius: '999px',
                      padding: '2px 8px',
                    }}>
                      {log.modelId}
                    </span>
                  )}
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                    {log.ts}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', lineHeight: 'var(--lh-relaxed)' }}>
                  {log.message}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{
          padding: 'var(--sp-4)',
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}>
          {emptyLabel}
        </div>
      )}
    </section>
  )
}

function CompareColumn({
  title,
  model,
  messages,
  attachmentsByMessageId,
  sessionLogs = [],
  emptyLabel,
}: {
  title: string
  model?: string
  messages: ShellChatMessage[]
  attachmentsByMessageId: Map<string, ShellAttachment[]>
  sessionLogs?: ShellLog[]
  emptyLabel: string
}) {
  return (
    <section style={{
      minWidth: 0,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-3)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </div>
        {model && (
          <span style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-secondary)',
            background: 'var(--bg-elevated)',
            borderRadius: '999px',
            padding: '2px 8px',
          }}>
            {model}
          </span>
        )}
      </div>

      <div style={{ padding: '0 var(--sp-3)' }}>
        {messages.length > 0 ? (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              attachments={attachmentsByMessageId.get(message.id) ?? []}
              modelId={model}
              sessionLogs={sessionLogs}
              attachmentContext="compare"
            />
          ))
        ) : (
          <div style={{
            padding: 'var(--sp-5) 0',
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  )
}

function PreviewCompareCard({
  title,
  model,
  preview,
  emptyLabel,
}: {
  title: string
  model?: string
  preview?: ShellPreview
  emptyLabel: string
}) {
  const statusConfig = preview ? PREVIEW_STATUS_LABELS[preview.status] : null

  return (
    <section style={{
      minWidth: 0,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-3)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </div>
        {model && (
          <span style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-secondary)',
            background: 'var(--bg-elevated)',
            borderRadius: '999px',
            padding: '2px 8px',
          }}>
            {model}
          </span>
        )}
      </div>

      {preview ? (
        <div style={{ padding: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
            <span style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 600,
              color: statusConfig?.color,
              background: statusConfig?.background,
              borderRadius: '999px',
              padding: '2px 8px',
            }}>
              {statusConfig?.label}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              v{preview.version}
            </span>
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-1)' }}>
            {preview.title}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            {preview.status === 'failed'
              ? '프리뷰 렌더링에 실패한 상태입니다.'
              : preview.status === 'partial'
                ? '일부만 렌더링된 프리뷰 상태입니다.'
                : preview.status === 'stale'
                  ? '최신 결과보다 오래된 프리뷰 상태입니다.'
                  : '현재 결과를 바로 확인할 수 있는 프리뷰입니다.'}
          </div>
        </div>
      ) : (
        <div style={{
          padding: 'var(--sp-4)',
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}>
          {emptyLabel}
        </div>
      )}
    </section>
  )
}

function ArtifactCompareCard({
  title,
  artifact,
  emptyLabel,
}: {
  title: string
  artifact?: ShellArtifact
  emptyLabel: string
}) {
  return (
    <section style={{
      minWidth: 0,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-3)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </div>
        {artifact && (
          <span style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-secondary)',
            background: 'var(--bg-elevated)',
            borderRadius: '999px',
            padding: '2px 8px',
          }}>
            {ARTIFACT_KIND_LABELS[artifact.kind]}
          </span>
        )}
      </div>

      {artifact ? (
        <>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-2)',
            flexWrap: 'wrap',
            padding: 'var(--sp-3)',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {artifact.title}
            </div>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              v{artifact.version}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              {artifact.createdAt}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              {artifact.size}
            </span>
          </div>
          <div style={{ maxHeight: 240, overflow: 'auto', padding: 'var(--sp-3)' }}>
            {artifact.kind === 'diff' ? (
              <ArtifactDiffPreview content={artifact.content} />
            ) : (
              <ArtifactTextPreview content={artifact.content} />
            )}
          </div>
        </>
      ) : (
        <div style={{
          padding: 'var(--sp-4)',
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}>
          {emptyLabel}
        </div>
      )}
    </section>
  )
}

function AttachmentCompareCard({
  title,
  attachments,
  modelId,
  sessionId,
  logs = [],
  emptyLabel,
}: {
  title: string
  attachments: ShellAttachment[]
  modelId?: string
  sessionId?: string
  logs?: ShellLog[]
  emptyLabel: string
}) {
  const orderedAttachments = [...attachments].reverse()

  return (
    <section style={{
      minWidth: 0,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-3)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </div>
        {attachments.length > 0 && (
          <span style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-secondary)',
            background: 'var(--bg-elevated)',
            borderRadius: '999px',
            padding: '2px 8px',
          }}>
            {attachments.length}개
          </span>
        )}
      </div>

      {orderedAttachments.length > 0 ? (
        <div style={{ padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {orderedAttachments.map((attachment) => {
            const statusLabel = attachment.status === 'staged' ? '대기' : '전송'
            const statusColor = attachment.status === 'staged' ? 'var(--warning)' : 'var(--success)'
            const statusBackground = attachment.status === 'staged' ? 'var(--warning-soft)' : 'var(--success-soft)'
            const kindLabel = attachment.kind === 'image'
              ? '이미지'
              : attachment.kind === 'screenshot'
                ? '스크린샷'
                : '파일'

            return (
              <div
                key={attachment.id}
                data-compare-attachment={attachment.id}
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--sp-3)',
                  background: 'var(--bg-base)',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 'var(--sp-2)',
                  marginBottom: 'var(--sp-2)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {attachment.name}
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                      {attachment.mimeType} · {attachment.sizeLabel} · {attachment.createdAt}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span style={{
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 600,
                      color: statusColor,
                      background: statusBackground,
                      borderRadius: '999px',
                      padding: '2px 8px',
                    }}>
                      {statusLabel}
                    </span>
                    <span style={{
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-hover)',
                      borderRadius: '999px',
                      padding: '2px 8px',
                    }}>
                      {kindLabel}
                    </span>
                  </div>
                </div>

                {attachment.dataUrl && attachment.kind === 'image' && (
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    style={{
                      width: '100%',
                      maxHeight: 180,
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 'var(--sp-2)',
                    }}
                  />
                )}

                <AttachmentTextDisclosure
                  attachmentName={attachment.name}
                  textContent={attachment.textContent}
                  previewChars={200}
                  scope="compare"
                />
                <div style={{ marginTop: 6 }}>
                  <AttachmentDeliveryBadge
                    attachment={attachment}
                    modelId={modelId}
                    context="compare"
                    log={sessionId ? findLatestAttachmentDeliveryLog(logs, sessionId, attachment.name) : null}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{
          padding: 'var(--sp-4)',
          fontSize: 'var(--fs-sm)',
          color: 'var(--text-muted)',
          textAlign: 'center',
        }}>
          {emptyLabel}
        </div>
      )}
    </section>
  )
}

function ArtifactTextPreview({ content }: { content?: string }) {
  const resolvedContent = content?.trim()
    ? content
    : '저장된 본문이 아직 없습니다.'

  return (
    <pre style={{
      margin: 0,
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-sm)',
      lineHeight: 'var(--lh-relaxed)',
      color: 'var(--text-primary)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {resolvedContent}
    </pre>
  )
}

function ArtifactDiffPreview({ content }: { content?: string }) {
  const lines = (content ?? '--- 저장된 diff가 없습니다.').split('\n')

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-relaxed)' }}>
      {lines.map((line, index) => {
        let background = 'transparent'
        let color = 'var(--text-primary)'

        if (line.startsWith('+++') || line.startsWith('---')) {
          color = 'var(--text-muted)'
          background = 'var(--bg-elevated)'
        } else if (line.startsWith('@@')) {
          color = 'var(--accent)'
          background = 'var(--accent-soft)'
        } else if (line.startsWith('+')) {
          color = 'var(--success)'
          background = 'var(--success-soft)'
        } else if (line.startsWith('-')) {
          color = 'var(--danger)'
          background = 'var(--danger-soft)'
        }

        return (
          <div key={`${line}-${index}`} style={{
            display: 'flex',
            gap: 'var(--sp-2)',
            padding: '0 var(--sp-2)',
            background,
            borderLeft: line.startsWith('+')
              ? '3px solid var(--success)'
              : line.startsWith('-')
                ? '3px solid var(--danger)'
                : '3px solid transparent',
          }}>
            <span style={{
              width: 28,
              flexShrink: 0,
              textAlign: 'right',
              color: 'var(--text-muted)',
              userSelect: 'none',
            }}>
              {index + 1}
            </span>
            <span style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {line}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function MessageBubble({
  message,
  attachments,
  modelId,
  sessionLogs = [],
  attachmentContext = 'message',
  onBranch,
}: {
  message: ShellChatMessage
  attachments: ShellAttachment[]
  modelId?: string
  sessionLogs?: ShellLog[]
  attachmentContext?: 'message' | 'compare'
  onBranch?: () => void
}) {
  const isUser = message.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-4) 0',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 'var(--radius-md)',
        background: isUser ? 'var(--bg-elevated)' : 'var(--accent-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isUser
          ? <User size={14} style={{ color: 'var(--text-secondary)' }} />
          : <Bot size={14} style={{ color: 'var(--accent)' }} />
        }
      </div>

      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--sp-2)',
          marginBottom: 'var(--sp-1)',
        }}>
          <span style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            color: isUser ? 'var(--text-secondary)' : 'var(--accent)',
            display: 'block',
          }}>
            {isUser ? '나' : 'Assistant'}
          </span>
          {onBranch && (
            <button
              type="button"
              onClick={onBranch}
              aria-label="이 메시지에서 분기"
              title="이 메시지에서 분기"
              className="focus-ring"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--sp-1)',
                padding: '2px 8px',
                borderRadius: '999px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-muted)',
                fontSize: 'var(--fs-xs)',
                cursor: 'pointer',
              }}
            >
              <GitBranch size={11} strokeWidth={1.75} />
              <span>분기</span>
            </button>
          )}
        </div>
        {attachments.length > 0 && (
          <MessageAttachmentStrip
            attachments={attachments}
            modelId={modelId}
            sessionId={message.sessionId}
            logs={sessionLogs}
            context={attachmentContext}
          />
        )}
        <div className="message-content" style={{
          fontSize: 'var(--fs-base)',
          lineHeight: 'var(--lh-relaxed)',
          color: 'var(--text-primary)',
        }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: ({ className, children, ...props }) => {
                const isBlock = className?.includes('language-')
                if (isBlock) {
                  return (
                    <pre style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--sp-3)',
                      overflowX: 'auto',
                      margin: 'var(--sp-2) 0',
                      fontSize: 'var(--fs-sm)',
                      lineHeight: 'var(--lh-normal)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      <code {...props}>{children}</code>
                    </pre>
                  )
                }
                return (
                  <code
                    style={{
                      background: 'var(--bg-elevated)',
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '0.9em',
                      fontFamily: 'var(--font-mono)',
                    }}
                    {...props}
                  >
                    {children}
                  </code>
                )
              },
              h2: ({ children }) => (
                <h2 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, margin: 'var(--sp-4) 0 var(--sp-2)', color: 'var(--text-primary)' }}>
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 600, margin: 'var(--sp-3) 0 var(--sp-1)', color: 'var(--text-primary)' }}>
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p style={{ margin: 'var(--sp-2) 0' }}>{children}</p>
              ),
              ul: ({ children }) => (
                <ul style={{ margin: 'var(--sp-2) 0', paddingLeft: 'var(--sp-5)' }}>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol style={{ margin: 'var(--sp-2) 0', paddingLeft: 'var(--sp-5)' }}>{children}</ol>
              ),
              li: ({ children }) => (
                <li style={{ margin: 'var(--sp-1) 0' }}>{children}</li>
              ),
              strong: ({ children }) => (
                <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{children}</strong>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

function MessageAttachmentStrip({
  attachments,
  modelId,
  sessionId,
  logs = [],
  context = 'message',
}: {
  attachments: ShellAttachment[]
  modelId?: string
  sessionId?: string
  logs?: ShellLog[]
  context?: 'message' | 'compare'
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--sp-2)',
        marginBottom: 'var(--sp-2)',
      }}
    >
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          data-message-attachment-kind={attachment.kind}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-2)',
            maxWidth: 280,
            padding: '6px 10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)',
          }}
        >
          {attachment.dataUrl ? (
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {attachment.kind === 'image' ? 'IMG' : 'FILE'}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {attachment.name}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              {attachment.kind} · {attachment.sizeLabel}
            </div>
            <AttachmentTextDisclosure
              attachmentName={attachment.name}
              textContent={attachment.textContent}
              previewChars={160}
              scope={context}
            />
            <div style={{ marginTop: 4 }}>
              <AttachmentDeliveryBadge
                attachment={attachment}
                modelId={modelId}
                context={context}
                log={sessionId ? findLatestAttachmentDeliveryLog(logs, sessionId, attachment.name) : null}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ templates, showTemplates }: { templates: ShellTemplate[]; showTemplates: boolean }) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--sp-6)',
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 'var(--radius-xl)',
        background: 'var(--accent-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 'var(--sp-4)',
      }}>
        <Sparkles size={24} style={{ color: 'var(--accent)' }} />
      </div>

      <h2 style={{
        fontSize: 'var(--fs-lg)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 'var(--sp-2)',
      }}>
        무엇을 만들고 싶으신가요?
      </h2>
      <p style={{
        fontSize: 'var(--fs-sm)',
        color: 'var(--text-secondary)',
        marginBottom: showTemplates ? 'var(--sp-6)' : 0,
        maxWidth: 400,
        textAlign: 'center',
      }}>
        {showTemplates
          ? '아래 템플릿으로 시작하거나 바로 요청을 입력해 작업을 시작하세요.'
          : '자유롭게 요청을 입력하면 바로 작업을 시작합니다.'}
      </p>

      {showTemplates && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--sp-3)',
          maxWidth: 560,
          width: '100%',
        }}>
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateCard({ template }: { template: ShellTemplate }) {
  return (
    <button
      className="focus-ring"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-3)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: `background var(--dur-micro), border-color var(--dur-micro)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-elevated)'
        e.currentTarget.style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-surface)'
        e.currentTarget.style.borderColor = 'var(--border-default)'
      }}
    >
      <span style={{ fontSize: 'var(--fs-xl)' }}>{template.emoji}</span>
      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
        {template.title}
      </span>
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 'var(--lh-tight)' }}>
        {template.description}
      </span>
    </button>
  )
}
