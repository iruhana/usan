/**
 * Z4 — Main Workspace
 * Tabbed surface: conversation, preview, artifact views.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ShellTemplate, StreamChunk } from '@shared/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  User, Bot, Sparkles,
  MessageSquare, Eye, FileCode,
} from 'lucide-react'
import { uid, useChatStore } from '../../stores/chat.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useShellStore } from '../../stores/shell.store'
import { useUiStore } from '../../stores/ui.store'
import Composer from './Composer'
import PreviewPanel from '../panels/PreviewPanel'
import ArtifactPanel from '../panels/ArtifactPanel'

type WorkspaceTab = 'chat' | 'preview' | 'artifact'

const WORKSPACE_TABS: { id: WorkspaceTab; icon: typeof MessageSquare; label: string }[] = [
  { id: 'chat', icon: MessageSquare, label: '대화' },
  { id: 'preview', icon: Eye, label: '프리뷰' },
  { id: 'artifact', icon: FileCode, label: '아티팩트' },
]

function createTimeLabel(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

function summarizeValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value
  }
  try {
    const serialized = JSON.stringify(value)
    return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized
  } catch {
    return '입력을 표시할 수 없습니다'
  }
}

function createArtifactTitle(sessionArtifactCount: number): string {
  return `assistant-response-${String(sessionArtifactCount + 1).padStart(3, '0')}.md`
}

export default function Workspace() {
  const activeSessionId = useUiStore((state) => state.activeSessionId)
  const messages = useShellStore((state) => state.messages)
  const templates = useShellStore((state) => state.templates)
  const previews = useShellStore((state) => state.previews)
  const showTemplates = useSettingsStore((state) => state.settings.showTemplates)
  const streaming = useChatStore((state) => state.streaming)
  const streamingContent = useChatStore((state) => state.streamingContent)
  const streamingSessionId = useChatStore((state) => state.streamingSessionId)
  const error = useChatStore((state) => state.error)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('chat')
  const bottomRef = useRef<HTMLDivElement>(null)
  const toolStepIdsRef = useRef(new Map<string, string[]>())
  const sessionMessages = useMemo(() => (
    activeSessionId
      ? messages.filter((message) => message.sessionId === activeSessionId)
      : []
  ), [activeSessionId, messages])
  const activePreview = previews.find((preview) => preview.sessionId === activeSessionId)
  const hasConversation = sessionMessages.length > 0 || (streaming && streamingSessionId === activeSessionId) || Boolean(error)

  useEffect(() => {
    const unsubscribe = window.usan.ai.onChunk((chunk: StreamChunk) => {
      const chatStore = useChatStore.getState()
      if (!chatStore.streamingId || chunk.requestId !== chatStore.streamingId) {
        return
      }

      if (chunk.text) {
        chatStore.appendStream(chunk.text)
      }

      if (chunk.toolCall && chatStore.streamingSessionId) {
        const shellStore = useShellStore.getState()
        const stepId = `step-${chunk.requestId}-tool-${(toolStepIdsRef.current.get(chunk.requestId)?.length ?? 0) + 1}`
        const pendingSteps = toolStepIdsRef.current.get(chunk.requestId) ?? []
        toolStepIdsRef.current.set(chunk.requestId, [...pendingSteps, stepId])
        shellStore.appendRunStep({
          id: stepId,
          sessionId: chatStore.streamingSessionId,
          label: `도구 실행: ${chunk.toolCall.name}`,
          status: 'running',
          detail: summarizeValue(chunk.toolCall.input),
        })
        shellStore.appendLog({
          id: `log-${stepId}`,
          sessionId: chatStore.streamingSessionId,
          ts: createTimeLabel(),
          level: 'debug',
          message: `Tool call: ${chunk.toolCall.name}(${summarizeValue(chunk.toolCall.input)})`,
        })
      }

      if (chunk.toolResult && chatStore.streamingSessionId) {
        const shellStore = useShellStore.getState()
        const pendingSteps = toolStepIdsRef.current.get(chunk.requestId) ?? []
        const stepId = pendingSteps[0]
        if (stepId) {
          shellStore.updateRunStep(stepId, {
            status: 'success',
            detail: summarizeValue(chunk.toolResult.result),
          })
          toolStepIdsRef.current.set(chunk.requestId, pendingSteps.slice(1))
        }
        shellStore.appendLog({
          id: `log-${chunk.requestId}-tool-result-${Date.now()}`,
          sessionId: chatStore.streamingSessionId,
          ts: createTimeLabel(),
          level: 'info',
          message: `Tool result: ${summarizeValue(chunk.toolResult.result)}`,
        })
      }

      if (chunk.error) {
        const { sessionId, content } = chatStore.finishStreaming()
        if (sessionId) {
          const shellStore = useShellStore.getState()
          if (content.trim()) {
            shellStore.appendMessage(sessionId, {
              id: uid(),
              sessionId,
              role: 'assistant',
              content,
              ts: Date.now(),
            })
          }
          shellStore.updateRunStep(`step-${chunk.requestId}`, {
            status: 'failed',
            detail: chunk.error,
          })
          shellStore.appendLog({
            id: `log-${chunk.requestId}-failed`,
            sessionId,
            ts: createTimeLabel(),
            level: 'error',
            message: chunk.error,
          })
          shellStore.updateSession(sessionId, { status: 'failed' })
        }
        toolStepIdsRef.current.delete(chunk.requestId)
        useChatStore.getState().setError(chunk.error)
        return
      }

      if (chunk.done) {
        const { sessionId, content } = chatStore.finishStreaming()
        if (!sessionId) {
          return
        }

        const shellStore = useShellStore.getState()
        if (content.trim()) {
          shellStore.appendMessage(sessionId, {
            id: uid(),
            sessionId,
            role: 'assistant',
            content,
            ts: Date.now(),
          })
          const session = shellStore.sessions.find((item) => item.id === sessionId)
          shellStore.appendArtifact({
            id: `artifact-${chunk.requestId}`,
            sessionId,
            title: createArtifactTitle(session?.artifactCount ?? 0),
            kind: 'markdown',
            createdAt: '방금',
            size: `${Math.max(1, Math.ceil(content.length / 1024))} KB`,
            version: 1,
            content,
          })
        }
        shellStore.updateRunStep(`step-${chunk.requestId}`, {
          status: 'success',
          detail: '응답 생성 완료',
        })
        shellStore.appendLog({
          id: `log-${chunk.requestId}-done`,
          sessionId,
          ts: createTimeLabel(),
          level: 'info',
          message: '응답 생성 완료',
        })
        shellStore.updateSession(sessionId, { status: 'active' })
        toolStepIdsRef.current.delete(chunk.requestId)
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (activeTab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeTab, error, sessionMessages, streaming, streamingContent])

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>
      {/* Workspace tab bar */}
      <div role="tablist" aria-label="워크스페이스 탭" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--sp-3)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        flexShrink: 0,
      }}>
        {WORKSPACE_TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
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

      {/* Tab content */}
      {activeTab === 'chat' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {hasConversation ? (
              <div style={{ maxWidth: 800, margin: '0 auto', padding: 'var(--sp-6) var(--sp-4)' }}>
                {sessionMessages.map((msg) => (
                  <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
                ))}
                {streaming && streamingSessionId === activeSessionId && (
                  <MessageBubble role="assistant" content={streamingContent || '...'} />
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
      {activeTab === 'preview' && (
        <PreviewPanel
          status={activePreview?.status}
          title={activePreview?.title}
          version={activePreview?.version}
        />
      )}
      {activeTab === 'artifact' && <ArtifactPanel sessionId={activeSessionId ?? undefined} />}
    </div>
  )
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-4) 0',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Avatar */}
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

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <span style={{
          fontSize: 'var(--fs-xs)',
          fontWeight: 600,
          color: isUser ? 'var(--text-secondary)' : 'var(--accent)',
          display: 'block',
          marginBottom: 'var(--sp-1)',
        }}>
          {isUser ? '나' : 'Assistant'}
        </span>
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
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

// ─── Empty State / Starter Templates ─────────────────────────────────────────

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
        무엇을 만들어볼까요?
      </h2>
      <p style={{
        fontSize: 'var(--fs-sm)',
        color: 'var(--text-secondary)',
        marginBottom: showTemplates ? 'var(--sp-6)' : 0,
        maxWidth: 400,
        textAlign: 'center',
      }}>
        {showTemplates
          ? '아래 템플릿으로 시작하거나, 자유롭게 요청하세요.'
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
