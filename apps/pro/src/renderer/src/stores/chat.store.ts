import { create } from 'zustand'
import { AI_MODELS } from '@shared/types'
import type { AIModel } from '@shared/types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  toolCalls?: Array<{ name: string; input: unknown }>
  toolResults?: Array<{ id: string; result: string }>
}

let seq = 0
export function uid() { return `msg-${Date.now()}-${++seq}` }
export function reqId() { return `req-${Date.now()}-${Math.random().toString(36).slice(2)}` }

interface ChatState {
  models: AIModel[]
  selectedModel: string
  messages: ChatMessage[]
  streaming: boolean
  streamingContent: string
  streamingId: string | null
  streamingSessionId: string | null
  error: string | null

  setModel: (id: string) => void
  addMessage: (msg: ChatMessage) => void
  clearMessages: () => void
  appendStream: (text: string) => void
  startStreaming: (requestId: string, sessionId?: string | null) => void
  finishStreaming: () => { sessionId: string | null; content: string }
  endStreaming: () => void
  stopStreamingState: () => void
  setError: (err: string | null) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  models: AI_MODELS,
  selectedModel: 'claude-sonnet-4-6',
  messages: [],
  streaming: false,
  streamingContent: '',
  streamingId: null,
  streamingSessionId: null,
  error: null,

  setModel: (id) => set({ selectedModel: id }),

  addMessage: (msg) => set((state) => {
    const messages = [...state.messages, msg]
    return { messages: messages.length > 200 ? messages.slice(-200) : messages }
  }),

  clearMessages: () => set({
    messages: [],
    streaming: false,
    streamingContent: '',
    streamingId: null,
    streamingSessionId: null,
    error: null,
  }),

  appendStream: (text) => set((state) => ({
    streamingContent: state.streamingContent + text,
  })),

  startStreaming: (requestId, sessionId = null) => set({
    streaming: true,
    streamingContent: '',
    streamingId: requestId,
    streamingSessionId: sessionId,
    error: null,
  }),

  finishStreaming: () => {
    const { streamingContent, streamingSessionId } = get()
    set({
      streaming: false,
      streamingContent: '',
      streamingId: null,
      streamingSessionId: null,
    })
    return {
      sessionId: streamingSessionId,
      content: streamingContent,
    }
  },

  endStreaming: () => {
    const { content } = get().finishStreaming()
    if (!content.trim()) {
      return
    }

    const assistantMessage: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content,
      ts: Date.now(),
    }

    set((state) => ({
      messages: [...state.messages, assistantMessage],
    }))
  },

  stopStreamingState: () => set({
    streaming: false,
    streamingContent: '',
    streamingId: null,
    streamingSessionId: null,
    error: null,
  }),

  setError: (err) => set({
    error: err,
    streaming: false,
    streamingId: null,
    streamingSessionId: null,
    streamingContent: '',
  }),
}))
