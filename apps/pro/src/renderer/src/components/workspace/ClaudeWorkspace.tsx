/**
 * AI Workspace — real Claude API with streaming, model picker, skill system prompts, tools
 */
import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Square, Sparkles, ChevronDown, Terminal, Globe, FileText } from 'lucide-react'
import { useChatStore, uid, reqId } from '../../stores/chat.store'
import { useSkillsStore } from '../../stores/skills.store'
import { useState } from 'react'
import type { ChatMessage } from '../../stores/chat.store'
import type { StreamChunk } from '@shared/types'

// ─── Model Picker ─────────────────────────────────────────────────────────────

const PROVIDER_ICON: Record<string, string> = { anthropic: '◆', openai: '⬡', google: '✦' }

function ModelPicker() {
  const { models, selectedModel, setModel } = useChatStore()
  const [open, setOpen] = useState(false)
  const current = models.find((m) => m.id === selectedModel) ?? models[0]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 8,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          transition: 'border var(--dur-fast)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.border = '1px solid var(--border-focus)' }}
        onMouseLeave={(e) => { e.currentTarget.style.border = '1px solid var(--border)' }}
      >
        <span style={{ color: current.color, fontWeight: 700, fontSize: 11 }}>{PROVIDER_ICON[current.provider] ?? '◆'}</span>
        <span>{current.name}</span>
        <ChevronDown size={11} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 10, overflow: 'hidden', minWidth: 200, zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => { setModel(m.id); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', background: 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  backgroundColor: m.id === selectedModel ? 'rgba(91,138,245,0.08)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = m.id === selectedModel ? 'rgba(91,138,245,0.08)' : 'transparent' }}
              >
                <span style={{ color: m.color, fontSize: 12, fontWeight: 700 }}>{PROVIDER_ICON[m.provider] ?? '◆'}</span>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.description}</div>
                </div>
                {m.id === selectedModel && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 11 }}>✓</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// SkillBadge is now in the sidebar

// ─── Tool Call Card ───────────────────────────────────────────────────────────

function ToolCard({ name, input, result }: { name: string; input: unknown; result?: string }) {
  const [expanded, setExpanded] = useState(false)
  const icon = name === 'bash' ? <Terminal size={12} /> : name === 'web_fetch' ? <Globe size={12} /> : <FileText size={12} />
  return (
    <div
      style={{
        border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
        fontSize: 12, background: 'var(--bg-surface)',
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px', background: 'transparent', border: 'none',
          cursor: 'pointer', color: 'var(--text-secondary)', textAlign: 'left',
        }}
      >
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <span style={{ fontWeight: 500 }}>{name}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {typeof input === 'object' ? JSON.stringify(input).slice(0, 80) : String(input)}
        </span>
        <ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {expanded && result && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 10px', background: 'rgba(0,0,0,0.2)' }}>
          <pre style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto' }}>
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}
    >
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 2,
          background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: '#d97706', fontWeight: 700,
        }}>◆</div>
      )}

      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Tool calls */}
        {msg.toolCalls?.map((tc, i) => (
          <ToolCard
            key={i}
            name={tc.name}
            input={tc.input}
            result={msg.toolResults?.[i]?.result}
          />
        ))}

        {/* Content bubble */}
        {msg.content && (
          <div style={{
            padding: '10px 14px',
            borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            background: isUser ? 'var(--accent)' : 'var(--bg-elevated)',
            color: isUser ? '#fff' : 'var(--text-primary)',
            fontSize: 14, lineHeight: 1.6,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {msg.content}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main Workspace ───────────────────────────────────────────────────────────

export default function ClaudeWorkspace() {
  const {
    messages, streaming, streamingContent, streamingId, selectedModel, error,
    addMessage, appendStream, startStreaming, endStreaming, setError,
  } = useChatStore()
  const { activatedSkill, activatedContent } = useSkillsStore()

  const [input, setInput] = useState('')
  const [useTools, setUseTools] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Keep latest messages in a ref to avoid stale closure in send()
  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Set up chunk listener
  useEffect(() => {
    const cleanup = window.usan.ai.onChunk((chunk: StreamChunk) => {
      if (chunk.error) {
        setError(chunk.error)
        return
      }
      if (chunk.text) {
        appendStream(chunk.text)
      }
      if (chunk.done) {
        endStreaming()
      }
    })
    return cleanup
  }, [appendStream, endStreaming, setError])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: text, ts: Date.now() }
    addMessage(userMsg)

    const id = reqId()
    startStreaming(id)

    // Build messages for API using latest ref (avoids stale closure)
    const history = [...messagesRef.current, userMsg].map((m) => ({ role: m.role, content: m.content }))

    await window.usan.ai.chat({
      requestId: id,
      messages: history,
      model: selectedModel,
      systemPrompt: activatedContent || undefined,
      useTools,
    })
  }, [input, streaming, selectedModel, activatedContent, useTools, addMessage, startStreaming])

  const stopChat = useCallback(async () => {
    if (streamingId) {
      await window.usan.ai.stop(streamingId)
      endStreaming()
    }
  }, [streamingId, endStreaming])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0 && !streaming

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14 }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'rgba(91,138,245,0.1)', border: '1px solid rgba(91,138,245,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={22} color="var(--accent)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Usan AI 워크스페이스</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 340, lineHeight: 1.6 }}>
                {activatedSkill
                  ? `${activatedSkill.emoji} ${activatedSkill.name} 스킬이 활성화되었습니다. 무엇이든 물어보세요.`
                  : '스킬을 선택하거나 바로 대화를 시작하세요. 왼쪽 패널에서 1,039개의 스킬을 활용할 수 있습니다.'}
              </p>
            </div>
          </motion.div>
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </AnimatePresence>

            {/* Streaming bubble */}
            {streaming && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 2,
                  background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#d97706', fontWeight: 700,
                }}>◆</div>
                <div style={{
                  maxWidth: '78%', padding: '10px 14px',
                  borderRadius: '14px 14px 14px 4px',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {streamingContent || (
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          animate={{ y: [-2, 2, -2] }}
                          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                          style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: 'var(--text-muted)' }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444', fontSize: 13,
                }}
              >
                {error}
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{ padding: '10px 24px 18px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Toolbar row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <ModelPicker />
            {/* Active skill shown in sidebar */}
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={() => setUseTools((v) => !v)}
                title="컴퓨터 제어 도구 활성화 (bash, web_fetch, read_file)"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 9px', borderRadius: 8, fontSize: 11,
                  background: useTools ? 'rgba(91,138,245,0.15)' : 'var(--bg-elevated)',
                  border: `1px solid ${useTools ? 'rgba(91,138,245,0.4)' : 'var(--border)'}`,
                  color: useTools ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all var(--dur-fast)',
                }}
              >
                <Terminal size={11} />
                <span>도구</span>
              </button>
            </div>
          </div>

          {/* Input row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={activatedSkill ? `${activatedSkill.emoji} ${activatedSkill.name} 스킬로 대화 중...` : 'Usan에게 메시지 보내기...'}
              rows={1}
              style={{
                flex: 1, padding: '11px 14px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 12, color: 'var(--text-primary)', fontSize: 14,
                resize: 'none', outline: 'none', lineHeight: 1.5,
                maxHeight: 160, overflow: 'auto',
                transition: 'border var(--dur-fast)',
              }}
              onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--border-focus)' }}
              onBlur={(e) => { e.currentTarget.style.border = '1px solid var(--border)' }}
              onInput={(e) => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 160) + 'px'
              }}
            />
            <motion.button
              onClick={streaming ? stopChat : send}
              disabled={!streaming && !input.trim()}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: streaming ? 'rgba(239,68,68,0.15)' : (input.trim() ? 'var(--accent)' : 'var(--bg-elevated)'),
                border: `1px solid ${streaming ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: (streaming || input.trim()) ? 'pointer' : 'not-allowed',
                transition: 'all var(--dur-fast)',
              }}
            >
              {streaming ? (
                <Square size={14} color="#ef4444" fill="#ef4444" />
              ) : (
                <Send size={15} color={input.trim() ? '#fff' : 'var(--text-muted)'} />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
