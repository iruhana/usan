/**
 * Chat store — manages conversations and message streaming
 */

import { create } from 'zustand'
import type { ChatChunk, ChatMessage, StoredConversation } from '@shared/types/ipc'
import type { ToolResult } from '@shared/types/tools'
import { t } from '../i18n'
import { toChatErrorMessage, toSkillErrorMessage, toToolExecutionErrorMessage } from '../lib/user-facing-errors'
import { useSkillStore } from './skill.store'

type Conversation = StoredConversation

type StreamingPhase = 'idle' | 'waiting' | 'tool' | 'generating'

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  streamingConversationId: string | null
  isStreaming: boolean
  streamingPhase: StreamingPhase
  streamingText: string
  activeToolName: string | null
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
    activeToolName: null,
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
      set({ activeConversationId: id, streamingText: '', isStreaming: false, activeToolName: null })
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
        activeToolName: null,
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
      set({ isStreaming: false, streamingPhase: 'idle' as StreamingPhase, streamingConversationId: null, activeToolName: null })
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
            syncSkillRunnerFromToolCall(chunk.toolCall)
            set((s) => ({
              streamingPhase: 'tool' as StreamingPhase,
              activeToolName: getToolLabel(chunk.toolCall!.name),
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
            syncSkillRunnerFromToolResult(chunk.toolResult)
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
              activeToolName: null,
            }))
          } else {
            set({ isStreaming: false, streamingPhase: 'idle' as StreamingPhase, streamingConversationId: null, activeToolName: null })
          }
          persistToDisk()
          break
        }

        case 'error':
          syncSkillRunnerFromStreamError(chunk.content)
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
                        content: toChatErrorMessage(chunk.content),
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
            activeToolName: null,
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

function formatSkillRunTitle(skillId: string, scriptName: string): string {
  const normalizedSkill = skillId.replace(/[-_]+/g, ' ').trim()
  const normalizedScript = scriptName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim()

  if (normalizedSkill && normalizedScript) {
    return `${normalizedSkill}: ${normalizedScript}`
  }

  return normalizedScript || normalizedSkill || t('skill.title')
}

function syncSkillRunnerFromToolCall(toolCall: NonNullable<ChatChunk['toolCall']>): void {
  if (toolCall.name !== 'run_skill_script') {
    return
  }

  const skillId = typeof toolCall.args.skill_id === 'string' ? toolCall.args.skill_id : 'skill'
  const scriptName = typeof toolCall.args.script_name === 'string' ? toolCall.args.script_name : ''

  useSkillStore.getState().startRun(skillId, formatSkillRunTitle(skillId, scriptName), [
    {
      id: 'prepare',
      title: t('skill.progressPreparing'),
      status: 'done',
      detail: t('skill.progressAccepted'),
    },
    {
      id: 'run',
      title: formatSkillRunTitle(skillId, scriptName),
      status: 'running',
    },
    {
      id: 'finish',
      title: t('skill.progressFinishing'),
      status: 'pending',
    },
  ])
}

function syncSkillRunnerFromToolResult(result: ToolResult): void {
  if (result.name !== 'run_skill_script') {
    return
  }

  const store = useSkillStore.getState()
  if (!store.currentRun) {
    store.startRun('skill', t('skill.title'), [
      { id: 'prepare', title: t('skill.progressPreparing'), status: 'done' },
      { id: 'run', title: t('skill.title'), status: 'running' },
      { id: 'finish', title: t('skill.progressFinishing'), status: 'pending' },
    ])
  }

  if (result.error) {
    useSkillStore.getState().updateStep('run', 'failed', toSkillErrorMessage(result.error))
    useSkillStore.getState().setState('failed', result.error)
    return
  }

  useSkillStore.getState().updateStep('run', 'done', `${t('tool.done')} (${result.duration}ms)`)
  useSkillStore.getState().updateStep('finish', 'done', t('skill.progressComplete'))
  useSkillStore.getState().setState('done')
}

function syncSkillRunnerFromStreamError(input: string): void {
  const store = useSkillStore.getState()
  if (!store.currentRun) {
    return
  }

  if (store.currentRun.state !== 'running' && store.currentRun.state !== 'validating') {
    return
  }

  useSkillStore.getState().updateStep('run', 'failed', toSkillErrorMessage(input))
  useSkillStore.getState().setState('failed', input)
}

function formatToolResult(result: ToolResult): string {
  if (result.error) return `❌ ${getToolLabel(result.name)}: ${toToolExecutionErrorMessage(result.name, result.error)}`
  return `✅ ${getToolLabel(result.name)} ${t('tool.done')} (${result.duration}ms)`
}
