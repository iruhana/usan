import { describe, expect, it } from 'vitest'
import {
  applyPermissionGrantRequest,
  applyPermissionRevokeRequest,
  isPermissionGranted,
  normalizePermissionGrant,
  type PermissionGrant,
} from '@shared/types/permissions'

describe('permissions e2e flow', () => {
  it('supports all -> revoke -> granular -> expiry lifecycle', () => {
    const baseline = normalizePermissionGrant()

    const grantedAll = applyPermissionGrantRequest(baseline, { scope: 'all' })
    expect(grantedAll.grantedAll).toBe(true)
    expect(isPermissionGranted(grantedAll, { toolName: 'run_command' })).toBe(true)

    const revokedAll = applyPermissionRevokeRequest(grantedAll)
    expect(revokedAll.grantedAll).toBe(false)
    expect(isPermissionGranted(revokedAll, { toolName: 'run_command' })).toBe(false)

    const granular = applyPermissionGrantRequest(revokedAll, {
      scope: 'tools',
      items: ['run_command'],
      ttlMinutes: 1,
    })
    expect(isPermissionGranted(granular, { toolName: 'run_command' })).toBe(true)
    expect(isPermissionGranted(granular, { toolName: 'write_file' })).toBe(false)

    const expired: PermissionGrant = {
      ...granular,
      toolGrants: {
        run_command: {
          grantedAt: Date.now() - 120_000,
          expiresAt: Date.now() - 1_000,
        },
      },
    }
    expect(isPermissionGranted(expired, { toolName: 'run_command' })).toBe(false)
  })
})
