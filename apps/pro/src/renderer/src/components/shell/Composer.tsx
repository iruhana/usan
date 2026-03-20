/**
 * Z7 ??Composer
 * Task input, attachments, model picker, send/stop.
 */
import { useRef, useState, useCallback } from 'react'
import {
  Send, Square, Paperclip, ChevronDown, Image,
} from 'lucide-react'
import type { ChatPayload, ShellChatMessage } from '@shared/types'
import { reqId, uid, useChatStore } from '../../stores/chat.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useShellStore } from '../../stores/shell.store'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'AI ?붿껌???쒖옉?섏? 紐삵뻽?듬땲??'
}

export default function Composer() {
  const activeSessionId = useShellStore((state) => state.activeSessionId)
  const toolUseEnabled = useSettingsStore((state) => state.settings.toolUseEnabled)
  const {
    models,
    selectedModel,
    setModel,
    streaming,
    streamingId,
    startStreaming,
    stopStreamingState,
    setError,
  } = useChatStore()
  const [input, setInput] = useState('')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentModel = models.find((m) => m.id === selectedModel)

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming || !activeSessionId) return

    const requestId = reqId()
    const userMessage: ShellChatMessage = {
      id: uid(),
      sessionId: activeSessionId,
      role: 'user',
      content: text,
      ts: Date.now(),
    }
    const shellStore = useShellStore.getState()
    const history: ChatPayload['messages'] = [
      ...shellStore.messages
        .filter((message) => message.sessionId === activeSessionId)
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
      {
        role: userMessage.role,
        content: userMessage.content,
      },
    ]

    startStreaming(requestId, activeSessionId)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      await window.usan.ai.chat({
        requestId,
        sessionId: activeSessionId,
        userMessage: {
          id: userMessage.id,
          content: userMessage.content,
          ts: userMessage.ts,
        },
        messages: history,
        model: selectedModel,
        useTools: toolUseEnabled,
      })
    } catch (error) {
      stopStreamingState()
      setError(getErrorMessage(error))
    }
  }, [
    activeSessionId,
    input,
    selectedModel,
    setError,
    startStreaming,
    stopStreamingState,
    streaming,
    toolUseEnabled,
  ])

  const handleStop = useCallback(async () => {
    if (!streamingId) return

    try {
      await window.usan.ai.stop(streamingId)
    } catch (error) {
      console.error('Failed to stop AI stream', error)
    }
  }, [streamingId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div style={{
      borderTop: '1px solid var(--border-default)',
      background: 'var(--bg-surface)',
      padding: 'var(--sp-3) var(--sp-4)',
      flexShrink: 0,
    }}>
      {/* Input area */}
      <div style={{
        display: 'flex',
        gap: 'var(--sp-2)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--sp-2) var(--sp-3)',
        alignItems: 'flex-end',
        transition: `border-color var(--dur-micro)`,
      }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
      >
        {/* Attachment buttons */}
        <div style={{ display: 'flex', gap: 2, paddingBottom: 2 }}>
          <ComposerButton icon={Paperclip} label="?뚯씪 泥⑤?" onClick={() => {}} />
          <ComposerButton icon={Image} label="?대?吏 泥⑤?" onClick={() => {}} />
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="臾댁뾿??留뚮뱾?대낵源뚯슂?"
          rows={1}
          aria-label="硫붿떆吏 ?낅젰"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-base)',
            lineHeight: 'var(--lh-normal)',
            resize: 'none',
            minHeight: 24,
            maxHeight: 160,
            fontFamily: 'var(--font-sans)',
          }}
        />

        {/* Model picker */}
        <div style={{ position: 'relative', paddingBottom: 2 }}>
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            aria-label="紐⑤뜽 ?좏깮"
            aria-expanded={showModelPicker}
            className="focus-ring"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-1)',
              padding: '3px 8px',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--fs-xs)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {currentModel && (
              <span style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: currentModel.color,
                flexShrink: 0,
              }} />
            )}
            <span className="truncate" style={{ maxWidth: 100 }}>
              {currentModel?.name ?? 'Model'}
            </span>
            <ChevronDown size={10} />
          </button>

          {/* Dropdown */}
          {showModelPicker && (
            <div
              className="anim-scale-in"
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: 'var(--sp-1)',
                width: 220,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-3)',
                padding: 'var(--sp-1)',
                zIndex: 100,
                maxHeight: 320,
                overflowY: 'auto',
              }}
            >
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setModel(m.id); setShowModelPicker(false) }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-2)',
                    padding: '6px var(--sp-2)',
                    background: m.id === selectedModel ? 'var(--bg-active)' : 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--fs-sm)',
                  }}
                  onMouseEnter={(e) => { if (m.id !== selectedModel) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={(e) => { if (m.id !== selectedModel) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <span className="truncate" style={{ flex: 1 }}>{m.name}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{m.provider}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Send / Stop */}
        <button
          onClick={streaming ? () => { void handleStop() } : () => { void handleSend() }}
          aria-label={streaming ? '以묒?' : '?꾩넚'}
          className="focus-ring"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: streaming ? 'var(--danger)' : 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-inverse)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: `background var(--dur-micro)`,
          }}
        >
          {streaming ? <Square size={14} fill="currentColor" /> : <Send size={14} />}
        </button>
      </div>

      {/* Bottom bar: hints */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--sp-1) var(--sp-1) 0',
      }}>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          Enter ?꾩넚 쨌 Shift+Enter 以꾨컮轅?쨌 Ctrl+K 紐낅졊 ?붾젅??        </span>
      </div>
    </div>
  )
}

function ComposerButton({ icon: Icon, label, onClick }: {
  icon: typeof Paperclip; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="focus-ring"
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        transition: `color var(--dur-micro)`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      <Icon size={14} strokeWidth={1.5} />
    </button>
  )
}
