/**
 * Chat store — manages conversations and message streaming
 */

import { create } from 'zustand'
import type { ChatChunk, ChatMessage, StoredConversation } from '@shared/types/ipc'
import type { ToolResult } from '@shared/types/tools'
import { t } from '../i18n'

type Conversation = StoredConversation

type StreamingPhase = 'idle' | 'waiting' | 'tool' | 'generating'

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  streamingConversationId: string | null
  isStreaming: boolean
  streamingPhase: StreamingPhase
  streamingText: string
  loaded: boolean

  // Actions
  loadFromDisk: () => Promise<void>
  newConversation: () => string
  setActiveConversation: (id: string) => void
  deleteConversation: (id: string) => void
  sendMessage: (text: string) => Promise<void>
  retryLastMessage: () => void
  stopStreaming: () => void
  handleChunk: (chunk: ChatChunk) => void
}

export const useChatStore = create<ChatState>((set, get) => {
  // Set up stream listener with retry
  let unsubscribe: (() => void) | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  function setupStreamListener() {
    if (unsubscribe) return
    if (!window.usan?.ai) return
    unsubscribe = window.usan.ai.onChatStream((chunk: ChatChunk) => {
      get().handleChunk(chunk)
    })
  }

  // Retry until usan API is available (preload may not be ready immediately)
  if (typeof window !== 'undefined') {
    let retries = 0
    const MAX_RETRIES = 50
    const trySetup = () => {
      retryTimer = null
      if (unsubscribe) return
      setupStreamListener()
      if (!unsubscribe && ++retries < MAX_RETRIES) {
        retryTimer = setTimeout(trySetup, 200)
      }
    }
    trySetup()
  }

  // Debounced save to disk
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function flushConversations() {
    const state = get()
    const toSave = state.conversations.map((c) => ({
      ...c,
      messages: c.messages.map((m) => {
        if (m.toolResults?.length) {
          return { ...m, toolResults: m.toolResults.map((tr) => {
            if (!tr.result || typeof tr.result !== 'object') return tr
            const r = tr.result as Record<string, unknown>
            if (r.image) return { ...tr, result: { ...r, image: '[screenshot]' } }
            return tr
          })}
        }
        return m
      }),
    }))
    window.usan?.conversations.save(toSave)
  }

  function persistToDisk() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      flushConversations()
    }, 1000)
  }

  // Cleanup listeners + flush pending save on app shutdown
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (retryTimer) clearTimeout(retryTimer)
      if (unsubscribe) { unsubscribe(); unsubscribe = null }
      if (saveTimer) {
        clearTimeout(saveTimer)
        flushConversations()
      }
    })
  }

  return {
    conversations: [],
    activeConversationId: null,
    streamingConversationId: null,
    isStreaming: false,
    streamingPhase: 'idle' as StreamingPhase,
    streamingText: '',
    loaded: false,

    loadFromDisk: async () => {
      if (get().loaded) return
      try {
        const saved = await window.usan?.conversations.load()
        if (saved?.length) {
          set({ conversations: saved, loaded: true })
        } else {
          set({ loaded: true })
        }
      } catch {
        set({ loaded: true })
      }
    },

    newConversation: () => {
      const id = crypto.randomUUID()
      const conv: Conversation = {
        id,
        title: t('chat.newConversation'),
        messages: [],
        createdAt: Date.now(),
      }
      set((s) => ({
        conversations: [conv, ...s.conversations],
        activeConversationId: id,
      }))
      persistToDisk()
      return id
    },

    setActiveConversation: (id) => {
      set({ activeConversationId: id, streamingText: '', isStreaming: false })
    },

    deleteConversation: (id) => {
      set((s) => {
        const filtered = s.conversations.filter((c) => c.id !== id)
        const newActive = s.activeConversationId === id
          ? (filtered[0]?.id ?? null)
          : s.activeConversationId
        return { conversations: filtered, activeConversationId: newActive }
      })
      persistToDisk()
    },

    sendMessage: async (text) => {
      setupStreamListener()

      let convId = get().activeConversationId
      if (!convId) {
        convId = get().newConversation()
      }

      const conv = get().conversations.find((c) => c.id === convId)
      if (!conv) return

      // Add user message
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      }

      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [...c.messages, userMsg],
                title: c.messages.length === 0 ? text.slice(0, 30) : c.title,
              }
            : c
        ),
        isStreaming: true,
        streamingPhase: 'waiting' as StreamingPhase,
        streamingConversationId: convId,
        streamingText: '',
      }))

      // Send to main process
      await window.usan?.ai.chat({
        conversationId: convId!,
        message: text,
      })
    },

    retryLastMessage: () => {
      const state = get()
      const conv = state.conversations.find((c) => c.id === state.activeConversationId)
      if (!conv || state.isStreaming) return
      // Find the last user message
      const lastUserMsg = [...conv.messages].reverse().find((m) => m.role === 'user')
      if (lastUserMsg) {
        // Remove error messages that came after the last user message
        const lastUserIdx = conv.messages.lastIndexOf(lastUserMsg)
        const cleaned = conv.messages.slice(0, lastUserIdx)
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === state.activeConversationId
              ? { ...c, messages: cleaned }
              : c
          ),
        }))
        // Resend the same message
        get().sendMessage(lastUserMsg.content)
      }
    },

    stopStreaming: () => {
      const convId = get().streamingConversationId ?? get().activeConversationId
      if (convId) {
        window.usan?.ai.stop(convId)
      }
      set({ isStreaming: false, streamingPhase: 'idle' as StreamingPhase, streamingConversationId: null })
    },

    handleChunk: (chunk) => {
      const convId = get().streamingConversationId ?? get().activeConversationId
      if (!convId) return

      switch (chunk.type) {
        case 'text':
          set((s) => ({ streamingText: s.streamingText + chunk.content, streamingPhase: 'generating' as StreamingPhase }))
          break

        case 'tool_call':
          if (chunk.toolCall) {
            set((s) => ({
              streamingPhase: 'tool' as StreamingPhase,
              conversations: s.conversations.map((c) =>
                c.id === convId
                  ? {
                      ...c,
                      messages: [
                        ...c.messages,
                        {
                          id: crypto.randomUUID(),
                          role: 'assistant' as const,
                          content: `${getToolLabel(chunk.toolCall!.name)} ${t('tool.running')}`,
                          toolCalls: [chunk.toolCall!],
                          timestamp: Date.now(),
                        },
                      ],
                    }
                  : c
              ),
            }))
          }
          break

        case 'tool_result':
          if (chunk.toolResult) {
            set((s) => ({
              conversations: s.conversations.map((c) =>
                c.id === convId
                  ? {
                      ...c,
                      messages: [
                        ...c.messages,
                        {
                          id: crypto.randomUUID(),
                          role: 'tool' as const,
                          content: formatToolResult(chunk.toolResult!),
                          toolResults: [chunk.toolResult!],
                          timestamp: Date.now(),
                        },
                      ],
                    }
                  : c
              ),
            }))
          }
          break

        case 'done': {
          const text = get().streamingText
          if (text) {
            set((s) => ({
              conversations: s.conversations.map((c) =>
                c.id === convId
                  ? {
                      ...c,
                      messages: [
                        ...c.messages,
                        {
                          id: crypto.randomUUID(),
                          role: 'assistant' as const,
                          content: text,
                          timestamp: Date.now(),
                        },
                      ],
                    }
                  : c
              ),
              streamingText: '',
              isStreaming: false,
              streamingPhase: 'idle' as StreamingPhase,
              streamingConversationId: null,
            }))
          } else {
            set({ isStreaming: false, streamingPhase: 'idle' as StreamingPhase, streamingConversationId: null })
          }
          persistToDisk()
          break
        }

        case 'error':
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    messages: [
                      ...c.messages,
                      {
                        id: crypto.randomUUID(),
                        role: 'assistant' as const,
                        content: chunk.content,
                        timestamp: Date.now(),
                        isError: true,
                      },
                    ],
                  }
                : c
            ),
            isStreaming: false,
            streamingPhase: 'idle' as StreamingPhase,
            streamingConversationId: null,
            streamingText: '',
          }))
          break
      }
    },
  }
})

// ─── Helpers ────────────────────────────────────────

function getToolLabel(name: string): string {
  return t(`tool.${name}`) !== `tool.${name}` ? t(`tool.${name}`) : name
}

function formatToolResult(result: ToolResult): string {
  if (result.error) return `❌ ${result.error}`
  return `✅ ${getToolLabel(result.name)} ${t('tool.done')} (${result.duration}ms)`
}
