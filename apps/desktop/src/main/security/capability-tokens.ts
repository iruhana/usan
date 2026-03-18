import { randomUUID, sign, verify } from 'crypto'
import type { KeyObject } from 'crypto'
import type { SecurityRing } from './types'
import type { SecuritySessionIdentity } from './types'

const DEFAULT_TTL_MS = 10 * 60_000
const RING3_TTL_MS = 2 * 60_000

interface CapabilityHeader {
  alg: 'EdDSA'
  typ: 'USAN-CAP'
}

interface CapabilityPayload {
  capabilityId: string
  sessionId: string
  actorType: SecuritySessionIdentity['actorType']
  toolName: string
  ring: SecurityRing
  scopePaths?: string[]
  issuedAt: number
  expiresAt: number
  oneTime: boolean
  issuedFor: 'manual' | 'directory_grant' | 'tool_grant'
}

export interface CapabilityIssueOptions {
  toolName: string
  ring: SecurityRing
  scopePaths?: string[]
  expiresInMs?: number
  oneTime?: boolean
  issuedFor?: CapabilityPayload['issuedFor']
}

export interface CapabilityVerificationResult {
  valid: boolean
  reason?: string
  payload?: CapabilityPayload
}

function base64UrlEncode(input: Buffer | string): string {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return raw.toString('base64url')
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url')
}

function stringifyTokenPayload(header: CapabilityHeader, payload: CapabilityPayload): string {
  return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`
}

function normalizeScopePaths(scopePaths?: string[]): string[] | undefined {
  if (!scopePaths?.length) return undefined
  const normalized = scopePaths
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  if (!normalized.length) return undefined
  return [...new Set(normalized)]
}

export class CapabilityTokenService {
  private consumed = new Map<string, string>()

  issue(
    session: {
      identity: SecuritySessionIdentity
      privateKey: KeyObject
      publicKeyObject: KeyObject
    },
    options: CapabilityIssueOptions,
  ): { token: string; payload: CapabilityPayload } {
    const now = Date.now()
    const expiresInMs = options.expiresInMs
      ?? (options.ring === 3 ? RING3_TTL_MS : DEFAULT_TTL_MS)
    const header: CapabilityHeader = { alg: 'EdDSA', typ: 'USAN-CAP' }
    const payload: CapabilityPayload = {
      capabilityId: randomUUID(),
      sessionId: session.identity.sessionId,
      actorType: session.identity.actorType,
      toolName: options.toolName,
      ring: options.ring,
      scopePaths: normalizeScopePaths(options.scopePaths),
      issuedAt: now,
      expiresAt: now + expiresInMs,
      oneTime: options.oneTime ?? options.ring === 3,
      issuedFor: options.issuedFor ?? 'manual',
    }
    const signingInput = stringifyTokenPayload(header, payload)
    const signature = sign(null, Buffer.from(signingInput), session.privateKey as never)
    return {
      token: `${signingInput}.${base64UrlEncode(signature)}`,
      payload,
    }
  }

  verify(
    token: string | undefined,
    session: {
      identity: SecuritySessionIdentity
      publicKeyObject: KeyObject
    } | undefined,
    expected: {
      toolName: string
      ring: SecurityRing
      scopePath?: string
      consume?: boolean
    },
  ): CapabilityVerificationResult {
    if (!token) {
      return { valid: false, reason: 'missing_token' }
    }
    if (!session) {
      return { valid: false, reason: 'missing_session' }
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      return { valid: false, reason: 'invalid_token_format' }
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts
    const signingInput = `${encodedHeader}.${encodedPayload}`
    const signature = base64UrlDecode(encodedSignature)
    const signatureValid = verify(
      null,
      Buffer.from(signingInput),
      session.publicKeyObject as never,
      signature,
    )
    if (!signatureValid) {
      return { valid: false, reason: 'invalid_signature' }
    }

    let payload: CapabilityPayload
    try {
      payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf-8')) as CapabilityPayload
    } catch {
      return { valid: false, reason: 'invalid_payload' }
    }

    if (payload.sessionId !== session.identity.sessionId) {
      return { valid: false, reason: 'session_mismatch' }
    }
    if (payload.toolName !== expected.toolName || payload.ring !== expected.ring) {
      return { valid: false, reason: 'scope_mismatch' }
    }
    if (payload.expiresAt <= Date.now()) {
      return { valid: false, reason: 'expired_token' }
    }
    if (payload.oneTime && this.consumed.has(payload.capabilityId)) {
      return { valid: false, reason: 'token_already_used' }
    }

    if (expected.scopePath && payload.scopePaths?.length) {
      const expectedScopePath = expected.scopePath
      const matches = payload.scopePaths.some((scope) => (
        expectedScopePath === scope || expectedScopePath.startsWith(`${scope}/`)
      ))
      if (!matches) {
        return { valid: false, reason: 'path_scope_mismatch' }
      }
    }

    if (expected.consume !== false && payload.oneTime) {
      this.consumed.set(payload.capabilityId, payload.sessionId)
    }

    return { valid: true, payload }
  }

  revokeSession(sessionId: string): void {
    for (const [tokenId, ownerSessionId] of [...this.consumed.entries()]) {
      if (ownerSessionId === sessionId) {
        this.consumed.delete(tokenId)
      }
    }
  }

  clear(): void {
    this.consumed.clear()
  }
}
