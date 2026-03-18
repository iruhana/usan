import type { KeyObject } from 'crypto'
import { isPermissionGranted, type PermissionGrant } from '@shared/types/permissions'
import { eventBus } from '../infrastructure/event-bus'
import { logObsInfo, logObsWarn } from '../observability'
import { AgentIdentityStore } from './agent-identity'
import { CapabilityTokenService } from './capability-tokens'
import { SecurityAuditTrail, type SecurityAuditSink } from './audit-log'
import { scanPromptInput } from './prompt-guard'
import { extractScopePath, getToolSecurityProfile, isLocalSkillInstructionRead } from './rings'
import type {
  GuardScanKind,
  GuardScanResult,
  IssuedCapability,
  SecurityActorType,
  SecuritySessionIdentity,
  ToolAuthorization,
  ToolExecutionContext,
  ToolOutputProtection,
} from './types'

const AUTO_ISSUE_TTL_MS = 10 * 60_000
const MAX_GUARD_TEXT_LENGTH = 4000

function safeSerializeForGuard(value: unknown): string {
  const seen = new WeakSet<object>()

  try {
    return JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === 'bigint') {
        return currentValue.toString()
      }

      if (typeof currentValue === 'object' && currentValue !== null) {
        if (seen.has(currentValue)) {
          return '[Circular]'
        }
        seen.add(currentValue)
      }

      return currentValue
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return JSON.stringify({ unserializable: true, message })
  }
}

function summarizeGuard(scan: GuardScanResult): Record<string, unknown> {
  return {
    severity: scan.severity,
    score: scan.score,
    findings: scan.findings.map((finding) => ({
      category: finding.category,
      label: finding.label,
      excerpt: finding.excerpt,
    })),
    summary: scan.summary,
  }
}

function buildToolGuardText(toolName: string, args: Record<string, unknown>): string {
  const raw = safeSerializeForGuard({ toolName, args })
  return raw.length <= MAX_GUARD_TEXT_LENGTH ? raw : raw.slice(0, MAX_GUARD_TEXT_LENGTH)
}

function isAgentActor(actorType: SecurityActorType): actorType is 'agent' | 'workflow' {
  return actorType === 'agent' || actorType === 'workflow'
}

function blockedMessage(reason: string): string {
  if (reason === 'ring2_requires_directory_approval') {
    return '이 작업은 승인된 폴더 또는 세션 capability가 있어야 실행할 수 있습니다.'
  }
  if (reason === 'ring3_requires_capability') {
    return '이 작업은 매번 명시적인 승인 capability가 있어야 실행할 수 있습니다.'
  }
  if (reason === 'prompt_guard_blocked') {
    return '보안 정책상 위험한 지시로 판단되어 작업을 차단했습니다.'
  }
  if (reason === 'missing_session_identity') {
    return '보안 세션이 준비되지 않아 작업을 실행할 수 없습니다.'
  }
  return '보안 정책에 의해 작업이 차단되었습니다.'
}

function hasUsableGrant(grant: PermissionGrant | undefined, toolName: string, scopePath?: string): boolean {
  if (!grant) return false
  return isPermissionGranted(grant, { toolName, directoryPath: scopePath })
}

export class SecurityRuntime {
  private identities = new AgentIdentityStore()
  private capabilities = new CapabilityTokenService()
  private auditTrail = new SecurityAuditTrail()
  private stagedCapabilities = new Map<string, string[]>()

  attachAuditSink(sink: SecurityAuditSink): void {
    this.auditTrail.attachSink(sink)
  }

  ensureSession(
    sessionId: string,
    actorType: SecuritySessionIdentity['actorType'],
    actorId?: string,
  ): SecuritySessionIdentity {
    return this.identities.getOrCreateSession(sessionId, actorType, actorId).identity
  }

  destroySession(sessionId: string): void {
    this.identities.destroySession(sessionId)
    this.capabilities.revokeSession(sessionId)
    this.stagedCapabilities.delete(sessionId)
  }

  issueCapabilityToken(
    sessionId: string,
    actorType: SecuritySessionIdentity['actorType'],
    actorId: string | undefined,
    options: {
      toolName: string
      ring: 0 | 1 | 2 | 3
      scopePaths?: string[]
      expiresInMs?: number
      oneTime?: boolean
      issuedFor?: 'manual' | 'directory_grant' | 'tool_grant'
    },
  ): IssuedCapability {
    const session = this.identities.getOrCreateSession(sessionId, actorType, actorId)
    const issued = this.capabilities.issue(session, options)
    return {
      token: issued.token,
      tokenId: issued.payload.capabilityId,
      expiresAt: issued.payload.expiresAt,
    }
  }

  approveSessionCapability(
    sessionId: string,
    actorType: SecuritySessionIdentity['actorType'],
    actorId: string | undefined,
    options: {
      toolName: string
      ring: 0 | 1 | 2 | 3
      scopePaths?: string[]
      expiresInMs?: number
      oneTime?: boolean
      issuedFor?: 'manual' | 'directory_grant' | 'tool_grant'
    },
  ): Omit<IssuedCapability, 'token'> {
    const issued = this.issueCapabilityToken(sessionId, actorType, actorId, options)
    const existing = this.stagedCapabilities.get(sessionId) ?? []
    existing.push(issued.token)
    this.stagedCapabilities.set(sessionId, existing)
    return {
      tokenId: issued.tokenId,
      expiresAt: issued.expiresAt,
    }
  }

  scanUserInput(text: string): GuardScanResult {
    return scanPromptInput(text, 'user_input')
  }

  filterRagChunks(chunks: string[]): { accepted: string[]; rejectedCount: number } {
    const accepted: string[] = []
    let rejectedCount = 0
    for (const chunk of chunks) {
      const scan = scanPromptInput(chunk, 'rag_context')
      if (scan.blocked) {
        rejectedCount++
        logObsWarn('security_rag_chunk_rejected', summarizeGuard(scan))
        continue
      }
      accepted.push(chunk)
    }
    return { accepted, rejectedCount }
  }

  authorizeToolExecution(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): ToolAuthorization {
    const profile = getToolSecurityProfile(toolName)
    const scopePath = extractScopePath(profile, args)
    const requestGuard = scanPromptInput(buildToolGuardText(toolName, args), 'tool_args')

    if (requestGuard.blocked) {
      return {
        allowed: false,
        profile,
        scopePath,
        requestGuard,
        reason: 'prompt_guard_blocked',
      }
    }

    if (!isAgentActor(context.actorType)) {
      return {
        allowed: true,
        profile,
        scopePath,
        requestGuard,
      }
    }

    if (!context.sessionId) {
      return {
        allowed: false,
        profile,
        scopePath,
        requestGuard,
        reason: 'missing_session_identity',
      }
    }

    const session = this.identities.getOrCreateSession(context.sessionId, context.actorType, context.actorId)

    if (profile.ring <= 1) {
      return {
        allowed: true,
        profile,
        session: session.identity,
        scopePath,
        requestGuard,
      }
    }

    if (profile.ring === 2) {
      const verified = this.capabilities.verify(context.capabilityToken, session, {
        toolName,
        ring: 2,
        scopePath,
        consume: false,
      })
      if (verified.valid && verified.payload) {
        return {
          allowed: true,
          profile,
          session: session.identity,
          scopePath,
          requestGuard,
          capability: {
            tokenId: verified.payload.capabilityId,
            expiresAt: verified.payload.expiresAt,
            mode: 'verified',
          },
        }
      }

      if (hasUsableGrant(context.permissionGrant, toolName, scopePath)) {
        const issued = this.capabilities.issue(session, {
          toolName,
          ring: 2,
          scopePaths: scopePath ? [scopePath] : undefined,
          expiresInMs: AUTO_ISSUE_TTL_MS,
          oneTime: false,
          issuedFor: scopePath ? 'directory_grant' : 'tool_grant',
        })
        return {
          allowed: true,
          profile,
          session: session.identity,
          scopePath,
          requestGuard,
          capability: {
            tokenId: issued.payload.capabilityId,
            expiresAt: issued.payload.expiresAt,
            mode: 'auto-issued',
          },
        }
      }

      return {
        allowed: false,
        profile,
        session: session.identity,
        scopePath,
        requestGuard,
        reason: 'ring2_requires_directory_approval',
      }
    }

    if (!context.capabilityToken) {
      const stagedCapability = this.consumeStagedCapability(session, {
        toolName,
        ring: 3,
        scopePath,
      })
      if (stagedCapability) {
        return {
          allowed: true,
          profile,
          session: session.identity,
          scopePath,
          requestGuard,
          capability: stagedCapability,
        }
      }
    }

    const verified = this.capabilities.verify(context.capabilityToken, session, {
      toolName,
      ring: 3,
      scopePath,
    })
    if (verified.valid && verified.payload) {
      return {
        allowed: true,
        profile,
        session: session.identity,
        scopePath,
        requestGuard,
        capability: {
          tokenId: verified.payload.capabilityId,
          expiresAt: verified.payload.expiresAt,
          mode: 'verified',
        },
      }
    }

    return {
      allowed: false,
      profile,
      session: session.identity,
      scopePath,
      requestGuard,
      reason: 'ring3_requires_capability',
    }
  }

  protectToolOutput(
    toolName: string,
    args: Record<string, unknown>,
    result: unknown,
    context: ToolExecutionContext,
  ): ToolOutputProtection {
    const profile = getToolSecurityProfile(toolName)
    if (!isAgentActor(context.actorType) || !profile.scansUntrustedOutput || isLocalSkillInstructionRead(toolName, args)) {
      return { result, sanitized: false }
    }

    const serialized = safeSerializeForGuard(result)
    const scan = scanPromptInput(
      serialized.length <= MAX_GUARD_TEXT_LENGTH ? serialized : serialized.slice(0, MAX_GUARD_TEXT_LENGTH),
      'tool_output',
    )
    if (!scan.blocked) {
      return { result, sanitized: false, guard: scan }
    }

    return {
      sanitized: true,
      guard: scan,
      reason: 'untrusted_output_sanitized',
      result: {
        blocked: true,
        message: '외부 데이터에서 프롬프트 인젝션 가능성이 감지되어 원본 결과를 모델에 전달하지 않았습니다.',
        severity: scan.severity,
        score: scan.score,
        findings: scan.findings.map((finding) => ({
          category: finding.category,
          label: finding.label,
        })),
      },
    }
  }

  recordToolAudit(
    context: ToolExecutionContext,
    authorization: ToolAuthorization,
    status: 'allowed' | 'blocked' | 'completed' | 'failed' | 'sanitized',
    payload: {
      reason?: string
      request?: unknown
      response?: unknown
      guardKind?: GuardScanKind
      guard?: GuardScanResult
    } = {},
  ): void {
    const guard = payload.guard ?? authorization.requestGuard
    const reason = payload.reason ?? authorization.reason
    this.auditTrail.record({
      occurredAt: Date.now(),
      actorType: context.actorType,
      actorId: context.actorId,
      source: context.source,
      sessionId: context.sessionId,
      conversationId: context.conversationId,
      workflowRunId: context.workflowRunId,
      toolName: authorization.profile.toolName,
      ring: authorization.profile.ring,
      status,
      reason,
      request: payload.request,
      response: payload.response,
      capabilityId: authorization.capability?.tokenId,
      capabilityExpiresAt: authorization.capability?.expiresAt,
      sessionPublicKey: authorization.session?.publicKey,
      sessionFingerprint: authorization.session?.fingerprint,
      guardKind: payload.guardKind,
      guardSeverity: guard?.severity,
      guardScore: guard?.score,
      guardFindings: guard?.findings,
      scopePath: authorization.scopePath,
    })

    eventBus.emit(
      'security.audit',
      {
        toolName: authorization.profile.toolName,
        actorType: context.actorType,
        sessionId: context.sessionId ?? null,
        ring: authorization.profile.ring,
        status,
        reason: reason ?? null,
        guardSeverity: guard?.severity ?? null,
        capabilityId: authorization.capability?.tokenId ?? null,
      },
      'security-runtime',
    )

    const obsPayload = {
      toolName: authorization.profile.toolName,
      actorType: context.actorType,
      sessionId: context.sessionId ?? null,
      ring: authorization.profile.ring,
      status,
      reason: reason ?? null,
      capabilityId: authorization.capability?.tokenId ?? null,
      guardSeverity: guard?.severity ?? null,
      guardScore: guard?.score ?? null,
    }
    if (status === 'blocked' || status === 'failed' || status === 'sanitized') {
      logObsWarn('security_tool_audit', obsPayload)
    } else {
      logObsInfo('security_tool_audit', obsPayload)
    }
  }

  explainBlockedTool(authorization: ToolAuthorization): string {
    return blockedMessage(authorization.reason ?? 'blocked')
  }

  recentAudit(limit = 20) {
    return this.auditTrail.recent(limit)
  }

  clear(): void {
    this.identities.clear()
    this.capabilities.clear()
    this.stagedCapabilities.clear()
  }

  private consumeStagedCapability(
    session: {
      identity: SecuritySessionIdentity
      publicKeyObject: KeyObject
    },
    expected: {
      toolName: string
      ring: 3
      scopePath?: string
    },
  ): ToolAuthorization['capability'] | undefined {
    const staged = this.stagedCapabilities.get(session.identity.sessionId)
    if (!staged?.length) return undefined

    const remaining: string[] = []
    let matched: ToolAuthorization['capability'] | undefined

    for (const token of staged) {
      if (matched) {
        remaining.push(token)
        continue
      }

      const verified = this.capabilities.verify(token, session, expected)
      if (verified.valid && verified.payload) {
        matched = {
          tokenId: verified.payload.capabilityId,
          expiresAt: verified.payload.expiresAt,
          mode: 'verified',
        }
        continue
      }

      if (
        verified.reason === 'expired_token'
        || verified.reason === 'token_already_used'
        || verified.reason === 'invalid_signature'
        || verified.reason === 'invalid_payload'
        || verified.reason === 'session_mismatch'
      ) {
        continue
      }

      remaining.push(token)
    }

    if (remaining.length > 0) {
      this.stagedCapabilities.set(session.identity.sessionId, remaining)
    } else {
      this.stagedCapabilities.delete(session.identity.sessionId)
    }

    return matched
  }
}

export const securityRuntime = new SecurityRuntime()
