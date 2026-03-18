import { describe, expect, it } from 'vitest'
import {
  applyPermissionGrantRequest,
  applyPermissionRevokeRequest,
  isPermissionGranted,
  isTimedGrantActive,
  normalizePermissionGrant,
  type PermissionGrant,
} from '@shared/types/permissions'

describe('permissions model', () => {
  it('normalizes legacy grant shape safely', () => {
    const normalized = normalizePermissionGrant({
      grantedAll: false,
      grantedAt: 0,
      version: '0.1.0',
    })

    expect(normalized.grantedAll).toBe(false)
    expect(normalized.toolGrants).toEqual({})
    expect(normalized.featureGrants).toEqual({})
    expect(normalized.skillGrants).toEqual({})
    expect(normalized.defaultTtlMinutes).toBeGreaterThan(0)
  })

  it('grants and checks tool permission with ttl', () => {
    const base = normalizePermissionGrant()
    const granted = applyPermissionGrantRequest(base, {
      scope: 'tools',
      items: ['run_command'],
      ttlMinutes: 5,
    })

    expect(isPermissionGranted(granted, { toolName: 'run_command' })).toBe(true)
    expect(isPermissionGranted(granted, { toolName: 'write_file' })).toBe(false)
    expect(granted.grantedAll).toBe(false)
  })

  it('supports skill-scoped grants', () => {
    const base = normalizePermissionGrant()
    const granted = applyPermissionGrantRequest(base, {
      scope: 'skills',
      items: ['finance-bot'],
      ttlMinutes: 10,
    })

    expect(isPermissionGranted(granted, { skillId: 'finance-bot' })).toBe(true)
    expect(isPermissionGranted(granted, { skillId: 'other-skill' })).toBe(false)
  })

  it('supports directory-scoped grants', () => {
    const base = normalizePermissionGrant()
    const granted = applyPermissionGrantRequest(base, {
      scope: 'directories',
      items: ['C:\\Users\\admin\\Desktop'],
      ttlMinutes: 10,
    })

    expect(isPermissionGranted(granted, { directoryPath: 'C:\\Users\\admin\\Desktop\\report.txt' })).toBe(true)
    expect(isPermissionGranted(granted, { directoryPath: 'D:\\Other\\report.txt' })).toBe(false)
  })

  it('ignores empty grant requests safely', () => {
    const base = normalizePermissionGrant()
    const noRequest = applyPermissionGrantRequest(base)
    const missingItems = applyPermissionGrantRequest(base, { scope: 'tools' })

    expect(noRequest).toEqual(base)
    expect(missingItems).toEqual(base)
    expect(isPermissionGranted(noRequest, { toolName: 'run_command' })).toBe(false)
  })

  it('revokes selected scope items', () => {
    const base = normalizePermissionGrant()
    const granted = applyPermissionGrantRequest(base, {
      scope: 'tools',
      items: ['run_command', 'read_file'],
      ttlMinutes: 5,
    })

    const revoked = applyPermissionRevokeRequest(granted, {
      scope: 'tools',
      items: ['run_command'],
    })

    expect(isPermissionGranted(revoked, { toolName: 'run_command' })).toBe(false)
    expect(isPermissionGranted(revoked, { toolName: 'read_file' })).toBe(true)
  })

  it('revokes everything when request is omitted', () => {
    const allGranted = applyPermissionGrantRequest(normalizePermissionGrant(), { scope: 'all' })
    const revoked = applyPermissionRevokeRequest(allGranted)

    expect(revoked.grantedAll).toBe(false)
    expect(revoked.toolGrants).toEqual({})
    expect(revoked.featureGrants).toEqual({})
    expect(revoked.skillGrants).toEqual({})
  })

  it('detects expired timed grants', () => {
    const expired: PermissionGrant = {
      ...normalizePermissionGrant(),
      toolGrants: {
        run_command: {
          grantedAt: Date.now() - 120_000,
          expiresAt: Date.now() - 1_000,
        },
      },
    }

    expect(isTimedGrantActive(expired.toolGrants.run_command)).toBe(false)
    expect(isPermissionGranted(expired, { toolName: 'run_command' })).toBe(false)
  })
})
