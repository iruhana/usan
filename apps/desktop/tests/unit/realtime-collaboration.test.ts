import { describe, expect, it } from 'vitest'
import type { CollaborationIdentity } from '@shared/types/infrastructure'
import type { StoredConversation } from '@shared/types/ipc'
import { RealtimeCollaborationManager } from '../../src/main/collaboration/realtime-collaboration'

class FakeEventBus {
  public events: Array<{ type: string; payload: Record<string, unknown> }> = []

  emit(type: string, payload: Record<string, unknown>): void {
    this.events.push({ type, payload })
  }
}

class FakeChannel {
  public sent: Array<{ type: 'broadcast'; event: string; payload: unknown }> = []
  public subscribeStatuses: string[] = []
  private readonly handlers = new Map<string, Array<(payload: { payload?: unknown }) => void>>()
  private readonly presence = new Map<string, Array<Record<string, unknown>>>()

  constructor(private readonly presenceKey: string) {}

  on(type: 'broadcast' | 'presence', filter: Record<string, unknown>, callback: (payload: { payload?: unknown }) => void): FakeChannel {
    const eventName = `${type}:${String(filter.event ?? 'sync')}`
    const existing = this.handlers.get(eventName) ?? []
    existing.push(callback)
    this.handlers.set(eventName, existing)
    return this
  }

  subscribe(callback: (status: string) => void): FakeChannel {
    this.subscribeStatuses.push('SUBSCRIBED')
    callback('SUBSCRIBED')
    return this
  }

  track(payload: Record<string, unknown>): void {
    this.presence.set(this.presenceKey, [payload])
  }

  untrack(): void {
    this.presence.delete(this.presenceKey)
  }

  send(payload: { type: 'broadcast'; event: string; payload: unknown }): void {
    this.sent.push(payload)
  }

  presenceState(): Record<string, Array<Record<string, unknown>>> {
    return Object.fromEntries(this.presence.entries())
  }

  emitBroadcast(event: string, payload: unknown): void {
    for (const handler of this.handlers.get(`broadcast:${event}`) ?? []) {
      handler({ payload })
    }
  }
}

class FakeSupabaseClient {
  public realtime = {
    setAuth: (token: string) => {
      this.lastAuthToken = token
    },
  }

  public auth = {
    getSession: async () => ({
      data: {
        session: {
          access_token: 'token-123',
          user: {
            id: 'user-1',
            email: 'alice@example.com',
            user_metadata: {
              display_name: 'Alice',
            },
          },
        },
      },
    }),
  }

  public lastAuthToken: string | null = null
  public activeChannel: FakeChannel | null = null
  public removedChannels = 0

  channel(_: string, options?: { config?: { presence?: { key?: string } } }): FakeChannel {
    const presenceKey = options?.config?.presence?.key ?? 'presence-key'
    this.activeChannel = new FakeChannel(presenceKey)
    return this.activeChannel
  }

  removeChannel(): void {
    this.removedChannels += 1
    this.activeChannel = null
  }
}

function createConversation(id = 'conv-1'): StoredConversation {
  return {
    id,
    title: 'Shared task',
    createdAt: 1,
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'hello',
        timestamp: 1,
      },
    ],
  }
}

describe('RealtimeCollaborationManager', () => {
  it('starts a host session with authenticated identity and presence', async () => {
    const client = new FakeSupabaseClient()
    const bus = new FakeEventBus()
    const manager = new RealtimeCollaborationManager(() => client as never, bus as never)

    const status = await manager.startSession({ conversationId: 'conv-1' })

    expect(status.connected).toBe(true)
    expect(status.role).toBe('host')
    expect(status.shareCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(status.self?.displayName).toBe('Alice')
    expect(status.participants).toHaveLength(1)
    expect(status.participants[0]?.isSelf).toBe(true)
    expect(client.lastAuthToken).toBe('token-123')
    expect(bus.events.some((event) => event.type === 'collaboration.status')).toBe(true)
  })

  it('broadcasts conversation snapshots for the active shared conversation', async () => {
    const client = new FakeSupabaseClient()
    const manager = new RealtimeCollaborationManager(() => client as never, new FakeEventBus() as never)
    const conversation = createConversation()

    await manager.startSession({ conversationId: conversation.id })
    await manager.syncConversation(conversation)

    expect(client.activeChannel?.sent.at(-1)).toMatchObject({
      event: 'conversation_sync',
    })
  })

  it('emits remote conversation events from the realtime channel', async () => {
    const client = new FakeSupabaseClient()
    const bus = new FakeEventBus()
    const manager = new RealtimeCollaborationManager(() => client as never, bus as never)
    const remoteAuthor: CollaborationIdentity = {
      id: 'user-2',
      displayName: 'Bob',
      color: '#2563eb',
      authenticated: true,
    }

    await manager.startSession({ conversationId: 'conv-1' })
    client.activeChannel?.emitBroadcast('conversation_sync', {
      conversation: createConversation('remote-conv'),
      revision: 2,
      author: remoteAuthor,
      sentAt: 123,
    })

    const remoteEvent = bus.events.find((event) => event.type === 'collaboration.remote-conversation')
    expect(remoteEvent).toBeDefined()
    expect((remoteEvent?.payload as { author: CollaborationIdentity }).author.displayName).toBe('Bob')
    expect(manager.getStatus().conversationId).toBe('remote-conv')
  })
})
