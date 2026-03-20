/**
 * Z4 Main Workspace
 * Tabbed surface: conversation, preview, artifact views.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ArtifactKind,
  PreviewStatus,
  ShellArtifact,
  ShellChatMessage,
  ShellPreview,
  ShellTemplate,
  StreamChunk,
} from '@shared/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  User, Bot, GitBranch, Sparkles,
  MessageSquare, Eye, FileCode,
} from 'lucide-react'
import { useChatStore } from '../../stores/chat.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useShellStore } from '../../stores/shell.store'
import Composer from './Composer'
import PreviewPanel from '../panels/PreviewPanel'
import ArtifactPanel from '../panels/ArtifactPanel'

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

function getLatestArtifact(artifacts: ShellArtifact[]): ShellArtifact | undefined {
  return artifacts.reduce<ShellArtifact | undefined>((latest, artifact) => {
    if (!latest || artifact.version >= latest.version) {
      return artifact
    }
    return latest
  }, undefined)
}

export default function Workspace() {
  const activeSessionId = useShellStore((state) => state.activeSessionId)
  const sessions = useShellStore((state) => state.sessions)
  const messages = useShellStore((state) => state.messages)
  const artifacts = useShellStore((state) => state.artifacts)
  const templates = useShellStore((state) => state.templates)
  const previews = useShellStore((state) => state.previews)
  const branchSession = useShellStore((state) => state.branchSession)
  const promoteSession = useShellStore((state) => state.promoteSession)
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
  const branchSourceArtifacts = useMemo(() => (
    branchSourceSession
      ? artifacts.filter((artifact) => artifact.sessionId === branchSourceSession.id)
      : []
  ), [artifacts, branchSourceSession])
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

      if (chunk.text) {
        chatStore.appendStream(chunk.text)
      }

      if (chunk.error) {
        chatStore.setError(chunk.error)
        return
      }

      if (chunk.done) {
        chatStore.finishStreaming()
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
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>
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
                    onBranch={
                      activeSessionId
                        ? () => { void branchSession(activeSessionId, { sourceMessageId: message.id }) }
                        : undefined
                    }
                  />
                ))}
                {streaming && streamingSessionId === activeSessionId && (
                  <MessageBubble message={{ id: 'streaming', sessionId: activeSessionId ?? 'streaming', role: 'assistant', content: streamingContent || '...', ts: 0 }} />
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
          sourceMessages={sourceContinuation}
          currentMessages={currentContinuation}
          sourceModel={branchSourceSession?.model}
          currentModel={activeSession?.model ?? ''}
          sourcePreview={sourcePreview}
          currentPreview={activePreview}
          sourceArtifact={latestSourceArtifact}
          currentArtifact={latestSessionArtifact}
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
  sourceMessages,
  currentMessages,
  sourceModel,
  currentModel,
  sourcePreview,
  currentPreview,
  sourceArtifact,
  currentArtifact,
  onPromote,
  promoteDisabled,
}: {
  branchAnchorMessage?: ShellChatMessage
  sourceMessages: ShellChatMessage[]
  currentMessages: ShellChatMessage[]
  sourceModel?: string
  currentModel: string
  sourcePreview?: ShellPreview
  currentPreview?: ShellPreview
  sourceArtifact?: ShellArtifact
  currentArtifact?: ShellArtifact
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
            emptyLabel="원본 세션에는 분기 이후 추가 응답이 없습니다."
          />
          <CompareColumn
            title="분기 응답"
            model={currentModel}
            messages={currentMessages}
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

function CompareColumn({
  title,
  model,
  messages,
  emptyLabel,
}: {
  title: string
  model?: string
  messages: ShellChatMessage[]
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
            <MessageBubble key={message.id} message={message} />
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

function MessageBubble({ message, onBranch }: { message: ShellChatMessage; onBranch?: () => void }) {
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
