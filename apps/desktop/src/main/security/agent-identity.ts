import { createHash, generateKeyPairSync } from 'crypto'
import type { KeyObject } from 'crypto'
import type { SecuritySessionIdentity } from './types'

interface SessionEntry {
  identity: SecuritySessionIdentity
  privateKey: KeyObject
  publicKeyObject: KeyObject
}

function toPemPublicKey(publicKey: KeyObject): string {
  return publicKey.export({ format: 'pem', type: 'spki' }).toString()
}

function toFingerprint(publicKey: KeyObject): string {
  const der = publicKey.export({ format: 'der', type: 'spki' }) as Buffer
  return createHash('sha256').update(der).digest('hex')
}

export class AgentIdentityStore {
  private sessions = new Map<string, SessionEntry>()

  getOrCreateSession(
    sessionId: string,
    actorType: SecuritySessionIdentity['actorType'],
    actorId?: string,
  ): SessionEntry {
    const existing = this.sessions.get(sessionId)
    if (existing) return existing

    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const entry: SessionEntry = {
      identity: {
        sessionId,
        actorType,
        actorId,
        createdAt: Date.now(),
        publicKey: toPemPublicKey(publicKey),
        fingerprint: toFingerprint(publicKey),
      },
      privateKey,
      publicKeyObject: publicKey,
    }
    this.sessions.set(sessionId, entry)
    return entry
  }

  getSession(sessionId: string): SessionEntry | undefined {
    return this.sessions.get(sessionId)
  }

  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  clear(): void {
    this.sessions.clear()
  }
}
