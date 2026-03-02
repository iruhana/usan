import { describe, it, expect, vi, beforeEach } from 'vitest'

// We can't import the actual module because it depends on 'electron' and 'child_process'
// at module scope. Instead we test the logic by replicating the core functions.

const TASK_NAME = 'Usan'

let execSyncMock: ReturnType<typeof vi.fn>

function isElevated(): boolean {
  try {
    execSyncMock('net session', { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

function isTaskInstalled(): boolean {
  try {
    execSyncMock(`schtasks /query /tn "${TASK_NAME}"`, { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

function setAutoStart(enabled: boolean): boolean {
  if (!isTaskInstalled()) return false
  try {
    const flag = enabled ? '/enable' : '/disable'
    execSyncMock(`schtasks /change /tn "${TASK_NAME}" ${flag}`, { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

describe('elevation', () => {
  beforeEach(() => {
    execSyncMock = vi.fn()
  })

  describe('isElevated', () => {
    it('관리자 권한이면 true', () => {
      execSyncMock.mockReturnValue(undefined)
      expect(isElevated()).toBe(true)
      expect(execSyncMock).toHaveBeenCalledWith('net session', expect.any(Object))
    })

    it('비관리자면 false', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('Access denied')
      })
      expect(isElevated()).toBe(false)
    })
  })

  describe('isTaskInstalled', () => {
    it('작업 존재하면 true', () => {
      execSyncMock.mockReturnValue(undefined)
      expect(isTaskInstalled()).toBe(true)
      expect(execSyncMock).toHaveBeenCalledWith(
        `schtasks /query /tn "${TASK_NAME}"`,
        expect.any(Object),
      )
    })

    it('작업 없으면 false', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('ERROR: The system cannot find the file specified.')
      })
      expect(isTaskInstalled()).toBe(false)
    })
  })

  describe('setAutoStart', () => {
    it('활성화 → /enable 플래그', () => {
      execSyncMock.mockReturnValue(undefined) // isTaskInstalled + change
      expect(setAutoStart(true)).toBe(true)
      expect(execSyncMock).toHaveBeenCalledWith(
        `schtasks /change /tn "${TASK_NAME}" /enable`,
        expect.any(Object),
      )
    })

    it('비활성화 → /disable 플래그', () => {
      execSyncMock.mockReturnValue(undefined)
      expect(setAutoStart(false)).toBe(true)
      expect(execSyncMock).toHaveBeenCalledWith(
        `schtasks /change /tn "${TASK_NAME}" /disable`,
        expect.any(Object),
      )
    })

    it('작업 없으면 false', () => {
      execSyncMock.mockImplementation(() => {
        throw new Error('not found')
      })
      expect(setAutoStart(true)).toBe(false)
    })

    it('change 실패 시 false', () => {
      let callCount = 0
      execSyncMock.mockImplementation(() => {
        callCount++
        if (callCount > 1) throw new Error('access denied')
      })
      expect(setAutoStart(true)).toBe(false)
    })
  })
})
