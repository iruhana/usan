import { randomBytes, randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CollaborationDraftUpdate,
  CollaborationIdentity,
  CollaborationParticipant,
  CollaborationRemoteConversation,
  CollaborationRemoteDraft,
  CollaborationRole,
  CollaborationSessionStatus,
  CollaborationStartRequest,
  CollaborationJoinRequest,
} from '@shared/types/infrastructure'
import type { StoredConversation } from '@shared/types/ipc'
import { getSupabaseClient } from '../auth/supabase-client'
import { eventBus } from '../infrastructure/event-bus'
import { logObsWarn } from '../observability'

const CHANNEL_PREFIX = 'usan-collab'
const BROADCAST_EVENTS = {
  conversation: 'conversation_sync',
  draft: 'draft_sync',
  syncRequest: 'sync_request',
} as const

const PARTICIPANT_COLORS = [
  '#2563eb',
  '#16a34a',
  '#ea580c',
  '#7c3aed',
  '#0f766e',
  '#db2777',
]

type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CHANNEL_ERROR' | 'CLOSED' | string

type PresencePayload = {
  id: string
  displayName: string
  email?: string
  avatarUrl?: string
  color: string
  authenticated: boolean
  role: CollaborationRole
  joinedAt: number
  activeConversationId?: string
}

type CollaborationChannelLike = {
  on: (
    type: 'broadcast' | 'presence',
    filter: Record<string, unknown>,
    callback: (payload: { payload?: unknown }) => void,
  ) => CollaborationChannelLike
  subscribe: (callback: (status: ChannelStatus) => void) => CollaborationChannelLike
  track: (payload: PresencePayload) => Promise<unknown> | unknown
  untrack: () => Promise<unknown> | unknown
  send: (payload: { type: 'broadcast'; event: string; payload: unknown }) => Promise<unknown> | unknown
  presenceState: () => Record<string, PresencePayload[]>
}

type SupabaseClientLike = Pick<SupabaseClient, 'auth' | 'realtime' | 'channel' | 'removeChannel'>

interface ActiveSession {
  client: SupabaseClientLike
  channel: CollaborationChannelLike
  topic: string
  shareCode: string
  role: CollaborationRole
  self: CollaborationIdentity
  presenceKey: string
  joinedAt: number
  conversationId: string | null
  participants: CollaborationParticipant[]
  revision: number
  lastConversation: StoredConversation | null
  lastSyncedAt: number | null
  lastError: string | null
}

function sanitizeShareCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, '')
}

function formatShareCode(raw: string): string {
  const normalized = sanitizeShareCode(raw)
  const groups = normalized.match(/.{1,4}/g)
  return groups?.join('-') ?? normalized
}

function createShareCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let buffer = ''

  while (buffer.length < 12) {
    const value = randomBytes(1)[0] ?? 0
    buffer += alphabet[value % alphabet.length]
  }

  return formatShareCode(buffer.slice(0, 12))
}

function buildTopic(shareCode: string): string {
  return `${CHANNEL_PREFIX}:${sanitizeShareCode(shareCode)}`
}

function getColorForIdentity(id: string): string {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  }
  return PARTICIPANT_COLORS[hash % PARTICIPANT_COLORS.length] ?? PARTICIPANT_COLORS[0]!
}

function toDisplayName(email?: string | null, displayName?: unknown): string {
  if (typeof displayName === 'string' && displayName.trim()) {
    return displayName.trim()
  }
  if (typeof email === 'string' && email.includes('@')) {
    return email.split('@')[0] || email
  }
  return 'Guest'
}

export class RealtimeCollaborationManager {
  private readonly guestId = `guest-${randomUUID()}`
  private session: ActiveSession | null = null
  private lastError: string | null = null

  constructor(
    private readonly clientFactory: () => SupabaseClientLike = getSupabaseClient,
    private readonly bus = eventBus,
  ) {}

  getStatus(): CollaborationSessionStatus {
    return this.buildStatus()
  }

  async startSession(request: CollaborationStartRequest): Promise<CollaborationSessionStatus> {
    return this.connectSession({
      shareCode: createShareCode(),
      role: 'host',
      conversationId: request.conversationId,
    })
  }

  async joinSession(request: CollaborationJoinRequest): Promise<CollaborationSessionStatus> {
    const sanitized = sanitizeShareCode(formatShareCode(request.shareCode))
    if (!sanitized) {
      throw new Error('Share code is required.')
    }
    const shareCode = sanitized

    const status = await this.connectSession({
      shareCode,
      role: 'guest',
      conversationId: null,
    })

    await this.broadcast({
      event: BROADCAST_EVENTS.syncRequest,
      payload: {
        requestedAt: Date.now(),
        author: status.self,
      },
    })

    return status
  }

  async leaveSession(): Promise<CollaborationSessionStatus> {
    const current = this.session
    if (!current) return this.buildStatus()

    try {
      await Promise.resolve(current.channel.untrack())
      await Promise.resolve(current.client.removeChannel(current.channel as never))
    } catch (error) {
      logObsWarn('collaboration_leave_failed', {
        message: error instanceof Error ? error.message : String(error),
        topic: current.topic,
      })
    } finally {
      this.session = null
      this.emitStatus()
    }

    return this.buildStatus()
  }

  async syncConversation(conversation: StoredConversation): Promise<void> {
    if (!this.session || conversation.id !== this.session.conversationId) return

    this.session.lastConversation = conversation
    this.session.revision += 1
    this.session.lastSyncedAt = Date.now()

    await this.trackPresence(conversation.id)
    await this.broadcast({
      event: BROADCAST_EVENTS.conversation,
      payload: {
        conversation,
        revision: this.session.revision,
        author: this.session.self,
        sentAt: Date.now(),
      },
    })
    this.emitStatus()
  }

  async syncDraft(update: CollaborationDraftUpdate): Promise<void> {
    if (!this.session || update.conversationId !== this.session.conversationId) return

    await this.trackPresence(update.conversationId)
    await this.broadcast({
      event: BROADCAST_EVENTS.draft,
      payload: {
        shareCode: this.session.shareCode,
        conversationId: update.conversationId,
        text: update.text,
        kind: update.kind,
        author: this.session.self,
        updatedAt: Date.now(),
      } satisfies CollaborationRemoteDraft,
    })
  }

  private async connectSession(input: {
    shareCode: string
    role: CollaborationRole
    conversationId: string | null
  }): Promise<CollaborationSessionStatus> {
    await this.leaveSession()

    try {
      const client = this.clientFactory()
      const auth = await this.resolveIdentity(client)
      const topic = buildTopic(input.shareCode)
      const presenceKey = `${auth.identity.id}:${randomUUID().slice(0, 8)}`
      const joinedAt = Date.now()
      const channel = client.channel(topic, {
        config: {
          broadcast: { ack: false, self: false },
          presence: { key: presenceKey },
        },
      }) as unknown as CollaborationChannelLike

      const session: ActiveSession = {
        client,
        channel,
        topic,
        shareCode: input.shareCode,
        role: input.role,
        self: auth.identity,
        presenceKey,
        joinedAt,
        conversationId: input.conversationId,
        participants: [],
        revision: 0,
        lastConversation: null,
        lastSyncedAt: null,
        lastError: null,
      }

      this.session = session
      this.bindChannel(session)
      await this.subscribe(session)
      await this.trackPresence(input.conversationId)
      this.lastError = null
      this.refreshParticipants()
      this.emitStatus()

      return this.buildStatus()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.session = null
      this.emitStatus()
      throw error
    }
  }

  private bindChannel(session: ActiveSession): void {
    session.channel
      .on('broadcast', { event: BROADCAST_EVENTS.conversation }, (event) => {
        this.handleRemoteConversation(event.payload)
      })
      .on('broadcast', { event: BROADCAST_EVENTS.draft }, (event) => {
        this.handleRemoteDraft(event.payload)
      })
      .on('broadcast', { event: BROADCAST_EVENTS.syncRequest }, () => {
        void this.handleSyncRequest()
      })
      .on('presence', { event: 'sync' }, () => {
        this.refreshParticipants()
      })
      .on('presence', { event: 'join' }, () => {
        this.refreshParticipants()
      })
      .on('presence', { event: 'leave' }, () => {
        this.refreshParticipants()
      })
  }

  private async subscribe(session: ActiveSession): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      session.channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          resolve()
          return
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Realtime collaboration could not subscribe (${status}).`))
        }
      })
    })
  }

  private async resolveIdentity(client: SupabaseClientLike): Promise<{ identity: CollaborationIdentity }> {
    const { data } = await client.auth.getSession()
    const session = data.session
    const user = session?.user

    if (session?.access_token) {
      await Promise.resolve(client.realtime.setAuth(session.access_token))
    }

    const identityId = user?.id ?? this.guestId
    const identity: CollaborationIdentity = {
      id: identityId,
      displayName: toDisplayName(user?.email, user?.user_metadata?.display_name ?? user?.user_metadata?.full_name),
      email: user?.email ?? undefined,
      avatarUrl: typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : undefined,
      color: getColorForIdentity(identityId),
      authenticated: Boolean(user),
    }

    return { identity }
  }

  private async trackPresence(conversationId: string | null): Promise<void> {
    const current = this.session
    if (!current) return

    const payload: PresencePayload = {
      id: current.self.id,
      displayName: current.self.displayName,
      email: current.self.email,
      avatarUrl: current.self.avatarUrl,
      color: current.self.color,
      authenticated: current.self.authenticated,
      role: current.role,
      joinedAt: current.joinedAt,
      activeConversationId: conversationId ?? undefined,
    }

    await Promise.resolve(current.channel.track(payload))
  }

  private refreshParticipants(): void {
    const current = this.session
    if (!current) return

    const state = current.channel.presenceState()
    const participants = Object.entries(state).flatMap(([presenceKey, payloads]) =>
      payloads.map((payload) => ({
        id: payload.id,
        displayName: payload.displayName,
        email: payload.email,
        avatarUrl: payload.avatarUrl,
        color: payload.color,
        authenticated: payload.authenticated,
        presenceKey,
        role: payload.role,
        isSelf: presenceKey === current.presenceKey,
        joinedAt: payload.joinedAt,
        activeConversationId: payload.activeConversationId,
      }) satisfies CollaborationParticipant),
    )

    current.participants = participants.sort((left, right) => {
      if (left.isSelf !== right.isSelf) return left.isSelf ? -1 : 1
      return left.joinedAt - right.joinedAt
    })

    this.emitStatus()
  }

  private async broadcast(input: { event: string; payload: unknown }): Promise<void> {
    const current = this.session
    if (!current) return

    await Promise.resolve(
      current.channel.send({
        type: 'broadcast',
        event: input.event,
        payload: input.payload,
      }),
    )
  }

  private handleRemoteConversation(raw: unknown): void {
    const current = this.session
    if (!current || !raw || typeof raw !== 'object') return

    const payload = raw as {
      conversation?: StoredConversation
      revision?: number
      author?: CollaborationIdentity
      sentAt?: number
    }

    if (!payload.conversation || !payload.author) return

    current.conversationId = payload.conversation.id
    current.lastConversation = payload.conversation
    current.lastSyncedAt = typeof payload.sentAt === 'number' ? payload.sentAt : Date.now()
    current.revision = Math.max(current.revision, typeof payload.revision === 'number' ? payload.revision : 0)

    const event: CollaborationRemoteConversation = {
      shareCode: current.shareCode,
      conversation: payload.conversation,
      revision: typeof payload.revision === 'number' ? payload.revision : 0,
      author: payload.author,
      receivedAt: Date.now(),
    }

    this.bus.emit('collaboration.remote-conversation', event as unknown as Record<string, unknown>, 'realtime-collaboration')
    this.emitStatus()
  }

  private handleRemoteDraft(raw: unknown): void {
    const current = this.session
    if (!current || !raw || typeof raw !== 'object') return

    const payload = raw as CollaborationRemoteDraft
    if (!payload.author || !payload.conversationId) return

    this.bus.emit('collaboration.remote-draft', payload as unknown as Record<string, unknown>, 'realtime-collaboration')
  }

  private async handleSyncRequest(): Promise<void> {
    const current = this.session
    if (!current || current.role !== 'host' || !current.lastConversation) return

    current.revision += 1
    await this.broadcast({
      event: BROADCAST_EVENTS.conversation,
      payload: {
        conversation: current.lastConversation,
        revision: current.revision,
        author: current.self,
        sentAt: Date.now(),
      },
    })
  }

  private emitStatus(): void {
    this.bus.emit('collaboration.status', this.buildStatus() as unknown as Record<string, unknown>, 'realtime-collaboration')
  }

  private buildStatus(): CollaborationSessionStatus {
    const current = this.session
    if (!current) {
      return {
        connected: false,
        topic: null,
        shareCode: null,
        role: null,
        conversationId: null,
        authenticated: false,
        self: null,
        participants: [],
        lastSyncedAt: null,
        lastError: this.lastError,
      }
    }

    return {
      connected: true,
      topic: current.topic,
      shareCode: current.shareCode,
      role: current.role,
      conversationId: current.conversationId,
      authenticated: current.self.authenticated,
      self: current.self,
      participants: current.participants,
      lastSyncedAt: current.lastSyncedAt,
      lastError: current.lastError ?? this.lastError,
    }
  }
}

export const realtimeCollaborationManager = new RealtimeCollaborationManager()
