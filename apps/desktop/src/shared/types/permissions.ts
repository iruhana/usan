/**
 * Permission system — 설치 시 한번에 전체 동의, 이후 팝업 ZERO
 */

export const ALL_PERMISSIONS = [
  // Screen
  'screen:capture',
  'screen:analyze',
  // Mouse
  'mouse:move',
  'mouse:click',
  'mouse:drag',
  // Keyboard
  'keyboard:type',
  'keyboard:shortcut',
  // Clipboard
  'clipboard:read',
  'clipboard:write',
  // File System
  'fs:read',
  'fs:write',
  'fs:delete',
  'fs:list',
  // Shell
  'shell:exec',
  'shell:admin',
  // Apps
  'app:launch',
  'app:close',
  'app:list',
  // Windows
  'window:focus',
  'window:resize',
  'window:list',
  // Browser
  'browser:navigate',
  'browser:interact',
  'browser:download',
  // Web
  'web:search',
  'web:fetch',
  // Packages
  'package:install',
  // Process
  'process:list',
  'process:kill',
  // Memory
  'memory:read',
  'memory:write',
  // Network
  'network:config',
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

export type PermissionScope = 'all' | 'tools' | 'features' | 'skills' | 'directories'

export interface TimedPermissionGrant {
  grantedAt: number
  expiresAt: number | null
}

export interface PermissionGrant {
  grantedAll: boolean
  grantedAt: number
  version: string
  toolGrants: Record<string, TimedPermissionGrant>
  featureGrants: Record<string, TimedPermissionGrant>
  skillGrants: Record<string, TimedPermissionGrant>
  directoryGrants: Record<string, TimedPermissionGrant>
  defaultTtlMinutes: number
}

export interface PermissionGrantRequest {
  scope?: PermissionScope
  items?: string[]
  ttlMinutes?: number
  confirmAll?: boolean
}

export interface PermissionRevokeRequest {
  scope?: Exclude<PermissionScope, 'all'>
  items?: string[]
}

export interface CapabilityGrantRequest {
  sessionId: string
  actorType: 'agent' | 'workflow'
  actorId?: string
  toolName: string
  scopePaths?: string[]
  ttlMinutes?: number
}

export interface CapabilityGrantResponse {
  tokenId: string
  expiresAt: number
  staged: true
  toolName: string
  ring: 3
}

export const DEFAULT_PERMISSION_VERSION = '0.2.0'
export const DEFAULT_PERMISSION_TTL_MINUTES = 15
export const MAX_PERMISSION_TTL_MINUTES = 24 * 60

export function normalizePermissionPath(path?: string): string {
  if (typeof path !== 'string') return ''
  const trimmed = path.trim().replace(/[\\]+/g, '/')
  if (!trimmed) return ''
  const collapsed = trimmed.replace(/\/+/g, '/').replace(/\/$/, '')
  if (/^[A-Z]:/.test(collapsed)) {
    return `${collapsed[0].toLowerCase()}${collapsed.slice(1)}`
  }
  return collapsed
}

function toSafeTtlMinutes(raw?: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return DEFAULT_PERMISSION_TTL_MINUTES
  return Math.min(Math.floor(raw), MAX_PERMISSION_TTL_MINUTES)
}

function createTimedGrant(ttlMinutes: number, now = Date.now()): TimedPermissionGrant {
  const safeTtlMinutes = toSafeTtlMinutes(ttlMinutes)
  return {
    grantedAt: now,
    expiresAt: now + safeTtlMinutes * 60_000,
  }
}

function normalizeTimedGrant(raw: unknown): TimedPermissionGrant | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const grantedAt = typeof item.grantedAt === 'number' && Number.isFinite(item.grantedAt) ? item.grantedAt : Date.now()
  const expiresAtRaw = item.expiresAt
  const expiresAt =
    expiresAtRaw === null
      ? null
      : typeof expiresAtRaw === 'number' && Number.isFinite(expiresAtRaw)
        ? expiresAtRaw
        : grantedAt + DEFAULT_PERMISSION_TTL_MINUTES * 60_000
  return { grantedAt, expiresAt }
}

function normalizeGrantMap(raw: unknown): Record<string, TimedPermissionGrant> {
  if (!raw || typeof raw !== 'object') return {}
  const result: Record<string, TimedPermissionGrant> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalized = normalizeTimedGrant(value)
    if (!normalized) continue
    if (!key || key.length > 200) continue
    result[key] = normalized
  }
  return result
}

export function normalizePermissionGrant(raw?: Partial<PermissionGrant> | null): PermissionGrant {
  const version =
    typeof raw?.version === 'string' && raw.version.trim()
      ? raw.version
      : DEFAULT_PERMISSION_VERSION
  const grantedAll = raw?.grantedAll === true
  const grantedAt =
    typeof raw?.grantedAt === 'number' && Number.isFinite(raw.grantedAt)
      ? raw.grantedAt
      : 0

  return {
    grantedAll,
    grantedAt,
    version,
    toolGrants: normalizeGrantMap(raw?.toolGrants),
    featureGrants: normalizeGrantMap(raw?.featureGrants),
    skillGrants: normalizeGrantMap(raw?.skillGrants),
    directoryGrants: normalizeGrantMap(raw?.directoryGrants),
    defaultTtlMinutes: toSafeTtlMinutes(raw?.defaultTtlMinutes),
  }
}

export function isTimedGrantActive(grant: TimedPermissionGrant | undefined, now = Date.now()): boolean {
  if (!grant) return false
  if (grant.expiresAt === null) return true
  return grant.expiresAt > now
}

function hasMapGrant(
  map: Record<string, TimedPermissionGrant>,
  name: string | undefined,
  now = Date.now(),
): boolean {
  if (!name) return false
  return isTimedGrantActive(map[name], now)
}

function hasDirectoryGrant(
  map: Record<string, TimedPermissionGrant>,
  directoryPath: string | undefined,
  now = Date.now(),
): boolean {
  if (!directoryPath) return false
  const normalizedPath = normalizePermissionPath(directoryPath)
  if (!normalizedPath) return false
  return Object.entries(map).some(([scopePath, grant]) => {
    if (!isTimedGrantActive(grant, now)) return false
    return normalizedPath === scopePath || normalizedPath.startsWith(`${scopePath}/`)
  })
}

export function isPermissionGranted(
  grant: PermissionGrant,
  input: { toolName?: string; featureName?: string; skillId?: string; directoryPath?: string },
): boolean {
  if (grant.grantedAll) return true
  const now = Date.now()
  if (hasMapGrant(grant.toolGrants, input.toolName, now)) return true
  if (hasMapGrant(grant.featureGrants, input.featureName, now)) return true
  if (hasMapGrant(grant.skillGrants, input.skillId, now)) return true
  if (hasDirectoryGrant(grant.directoryGrants, input.directoryPath, now)) return true
  return false
}

function grantItems(
  existing: Record<string, TimedPermissionGrant>,
  items: string[] | undefined,
  ttlMinutes: number,
  now = Date.now(),
): Record<string, TimedPermissionGrant> {
  if (!items?.length) return existing
  const next = { ...existing }
  const grant = createTimedGrant(ttlMinutes, now)
  for (const item of items) {
    const key = item.trim()
    if (!key || key.length > 200) continue
    next[key] = grant
  }
  return next
}

function normalizeGrantItems(items?: string[], scope?: Exclude<PermissionScope, 'all'>): string[] | undefined {
  if (!items?.length) return undefined
  const normalized = items
    .map((item) => scope === 'directories' ? normalizePermissionPath(item) : item.trim())
    .filter((item) => item.length > 0 && item.length <= 200)
  if (!normalized.length) return undefined
  return [...new Set(normalized)]
}

export function applyPermissionGrantRequest(
  current: PermissionGrant,
  request?: PermissionGrantRequest,
): PermissionGrant {
  const normalized = normalizePermissionGrant(current)
  if (!request?.scope) {
    return normalized
  }
  const scope = request.scope
  if (scope === 'all') {
    return {
      ...normalized,
      grantedAll: true,
      grantedAt: Date.now(),
      version: DEFAULT_PERMISSION_VERSION,
    }
  }

  const items = normalizeGrantItems(request.items, scope)
  if (!items?.length) {
    return normalized
  }

  const ttlMinutes = toSafeTtlMinutes(request.ttlMinutes ?? normalized.defaultTtlMinutes)
  return {
    ...normalized,
    defaultTtlMinutes: ttlMinutes,
    toolGrants:
      scope === 'tools'
        ? grantItems(normalized.toolGrants, items, ttlMinutes)
        : normalized.toolGrants,
    featureGrants:
      scope === 'features'
        ? grantItems(normalized.featureGrants, items, ttlMinutes)
        : normalized.featureGrants,
    skillGrants:
      scope === 'skills'
        ? grantItems(normalized.skillGrants, items, ttlMinutes)
        : normalized.skillGrants,
    directoryGrants:
      scope === 'directories'
        ? grantItems(normalized.directoryGrants, items, ttlMinutes)
        : normalized.directoryGrants,
  }
}

function revokeItems(
  existing: Record<string, TimedPermissionGrant>,
  items?: string[],
): Record<string, TimedPermissionGrant> {
  if (!items?.length) return {}
  const next = { ...existing }
  for (const item of items) delete next[item]
  return next
}

export function applyPermissionRevokeRequest(
  current: PermissionGrant,
  request?: PermissionRevokeRequest,
): PermissionGrant {
  const normalized = normalizePermissionGrant(current)
  if (!request?.scope) {
    return {
      ...normalized,
      grantedAll: false,
      grantedAt: 0,
      toolGrants: {},
      featureGrants: {},
      skillGrants: {},
      directoryGrants: {},
    }
  }

  const next: PermissionGrant = {
    ...normalized,
    grantedAll: false,
  }

  if (request.scope === 'tools') {
    next.toolGrants = revokeItems(normalized.toolGrants, request.items)
  } else if (request.scope === 'features') {
    next.featureGrants = revokeItems(normalized.featureGrants, request.items)
  } else if (request.scope === 'skills') {
    next.skillGrants = revokeItems(normalized.skillGrants, request.items)
  } else if (request.scope === 'directories') {
    next.directoryGrants = revokeItems(normalized.directoryGrants, normalizeGrantItems(request.items, 'directories'))
  }

  return next
}
