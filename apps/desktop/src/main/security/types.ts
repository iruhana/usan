import type { PermissionGrant } from '@shared/types/permissions'

export type SecurityRing = 0 | 1 | 2 | 3

export type SecurityActorType = 'agent' | 'workflow' | 'renderer' | 'system'

export type GuardScanKind = 'user_input' | 'tool_args' | 'tool_output' | 'rag_context'

export type GuardSeverity = 'safe' | 'low' | 'medium' | 'high' | 'critical'

export type ToolAuditStatus = 'allowed' | 'blocked' | 'completed' | 'failed' | 'sanitized'

export interface GuardFinding {
  category: string
  label: string
  score: number
  excerpt?: string
}

export interface GuardScanResult {
  severity: GuardSeverity
  score: number
  blocked: boolean
  findings: GuardFinding[]
  summary: string
}

export interface SecuritySessionIdentity {
  sessionId: string
  actorType: Extract<SecurityActorType, 'agent' | 'workflow'>
  actorId?: string
  createdAt: number
  publicKey: string
  fingerprint: string
}

export interface ToolSecurityProfile {
  toolName: string
  ring: SecurityRing
  category: string
  description: string
  pathArgKeys?: string[]
  scansUntrustedOutput?: boolean
}

export interface ToolExecutionContext {
  actorType: SecurityActorType
  actorId?: string
  source: string
  sessionId?: string
  conversationId?: string
  workflowRunId?: string
  capabilityToken?: string
  permissionGrant?: PermissionGrant
}

export interface IssuedCapability {
  token: string
  tokenId: string
  expiresAt: number
}

export interface ToolAuthorization {
  allowed: boolean
  profile: ToolSecurityProfile
  session?: SecuritySessionIdentity
  reason?: string
  requestGuard?: GuardScanResult
  capability?: {
    tokenId: string
    expiresAt: number
    mode: 'verified' | 'auto-issued'
  }
  scopePath?: string
}

export interface ToolOutputProtection {
  result: unknown
  sanitized: boolean
  guard?: GuardScanResult
  reason?: string
}

export interface SecurityAuditRecord {
  occurredAt: number
  actorType: SecurityActorType
  actorId?: string
  source: string
  sessionId?: string
  conversationId?: string
  workflowRunId?: string
  toolName: string
  ring: SecurityRing
  status: ToolAuditStatus
  reason?: string
  requestJson?: string | null
  responseJson?: string | null
  capabilityId?: string
  capabilityExpiresAt?: number
  sessionPublicKey?: string
  sessionFingerprint?: string
  guardKind?: GuardScanKind
  guardSeverity?: GuardSeverity
  guardScore?: number
  guardFindingsJson?: string | null
  scopePath?: string
}
