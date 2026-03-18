import { create } from 'zustand'
import type {
  CollaborationDraftUpdate,
  CollaborationRemoteConversation,
  CollaborationRemoteDraft,
  CollaborationSessionStatus,
} from '@shared/types/infrastructure'
import type { StoredConversation } from '@shared/types/ipc'
import { useChatStore } from './chat.store'

const EMPTY_STATUS: CollaborationSessionStatus = {
  connected: false,
  topic: null,
  shareCode: null,
  role: null,
  conversationId: null,
  authenticated: false,
  self: null,
  participants: [],
  lastSyncedAt: null,
  lastError: null,
}

const lastSentFingerprints = new Map<string, string>()
const lastReceivedFingerprints = new Map<string, string>()

let statusUnsubscribe: (() => void) | null = null
let remoteConversationUnsubscribe: (() => void) | null = null
let remoteDraftUnsubscribe: (() => void) | null = null

interface CollaborationState {
  initialized: boolean
  status: CollaborationSessionStatus
  remoteDraft: CollaborationRemoteDraft | null
  lastRemoteConversation: CollaborationRemoteConversation | null
  loading: boolean
  error: string | null
  initialize: () => Promise<void>
  startSession: (conversationId: string, title?: string) => Promise<void>
  joinSession: (shareCode: string) => Promise<void>
  leaveSession: () => Promise<void>
  syncConversation: (conversation: StoredConversation) => Promise<void>
  syncDraft: (draft: CollaborationDraftUpdate) => Promise<void>
  clearRemoteDraft: () => void
}

export function createConversationFingerprint(conversation: StoredConversation): string {
  const lastMessage = conversation.messages[conversation.messages.length - 1]

  return JSON.stringify({
    id: conversation.id,
    title: conversation.title,
    count: conversation.messages.length,
    lastId: lastMessage?.id ?? '',
    lastRole: lastMessage?.role ?? '',
    lastTimestamp: lastMessage?.timestamp ?? 0,
    lastContent: lastMessage?.content ?? '',
  })
}

function resetSyncFingerprints(): void {
  lastSentFingerprints.clear()
  lastReceivedFingerprints.clear()
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  initialized: false,
  status: EMPTY_STATUS,
  remoteDraft: null,
  lastRemoteConversation: null,
  loading: false,
  error: null,

  initialize: async () => {
    if (get().initialized) return

    if (!statusUnsubscribe && !remoteConversationUnsubscribe && !remoteDraftUnsubscribe && window.usan?.collaboration) {
      statusUnsubscribe = window.usan.collaboration.onStatusChanged((status) => {
        set({
          status,
          error: status.lastError ?? null,
        })
      })

      remoteConversationUnsubscribe = window.usan.collaboration.onRemoteConversation((event) => {
        lastReceivedFingerprints.set(event.conversation.id, createConversationFingerprint(event.conversation))
        useChatStore.getState().mergeRemoteConversation(event.conversation, { activate: true })
        set((state) => ({
          lastRemoteConversation: event,
          remoteDraft:
            state.remoteDraft?.conversationId === event.conversation.id && !state.remoteDraft.text.trim()
              ? null
              : state.remoteDraft,
        }))
      })

      remoteDraftUnsubscribe = window.usan.collaboration.onRemoteDraft((event) => {
        set({
          remoteDraft: event.text.trim() ? event : null,
        })
      })
    }

    const status = await window.usan?.collaboration?.status?.()
    set({
      initialized: true,
      status: status ?? EMPTY_STATUS,
      error: status?.lastError ?? null,
    })
  },

  startSession: async (conversationId, title) => {
    set({ loading: true, error: null })
    try {
      const status = await window.usan?.collaboration.start({ conversationId, title })
      resetSyncFingerprints()
      set({
        status: status ?? EMPTY_STATUS,
        loading: false,
        error: status?.lastError ?? null,
      })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  joinSession: async (shareCode) => {
    set({ loading: true, error: null })
    try {
      const status = await window.usan?.collaboration.join({ shareCode })
      resetSyncFingerprints()
      set({
        status: status ?? EMPTY_STATUS,
        loading: false,
        error: status?.lastError ?? null,
      })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  leaveSession: async () => {
    set({ loading: true, error: null })
    try {
      const status = await window.usan?.collaboration.leave()
      resetSyncFingerprints()
      set({
        status: status ?? EMPTY_STATUS,
        remoteDraft: null,
        lastRemoteConversation: null,
        loading: false,
        error: status?.lastError ?? null,
      })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  syncConversation: async (conversation) => {
    if (!get().status.connected || get().status.conversationId !== conversation.id) return

    const fingerprint = createConversationFingerprint(conversation)
    if (lastReceivedFingerprints.get(conversation.id) === fingerprint) return
    if (lastSentFingerprints.get(conversation.id) === fingerprint) return

    await window.usan?.collaboration.syncConversation(conversation)
    lastSentFingerprints.set(conversation.id, fingerprint)
  },

  syncDraft: async (draft) => {
    if (!get().status.connected || get().status.conversationId !== draft.conversationId) return
    await window.usan?.collaboration.syncDraft(draft)
  },

  clearRemoteDraft: () => {
    set({ remoteDraft: null })
  },
}))
