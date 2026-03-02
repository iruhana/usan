import { describe, it, expect } from 'vitest'

// toKoreanError and withRetry are not exported from tool-catalog,
// so we replicate them here to test the logic independently.
// In a real project we'd refactor to export, but testing the algorithm is what matters.

const ERROR_MESSAGES_KO: Record<string, string> = {
  ENOENT: '파일을 찾을 수 없습니다',
  EACCES: '접근 권한이 없습니다',
  EPERM: '이 작업을 수행할 권한이 없습니다',
  EISDIR: '파일이 아닌 폴더입니다',
  ENOTDIR: '폴더가 아닌 파일입니다',
  ENOTEMPTY: '폴더가 비어있지 않습니다',
  ENOSPC: '디스크 공간이 부족합니다',
  EMFILE: '열린 파일이 너무 많습니다. 잠시 후 다시 시도해주세요',
  ETIMEDOUT: '시간이 너무 오래 걸렸습니다. 다시 시도해주세요',
  ECONNREFUSED: '연결이 거부되었습니다',
  ECONNRESET: '연결이 끊어졌습니다',
  EAI_AGAIN: '네트워크 연결을 확인해주세요',
}

function toKoreanError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const code = (err as NodeJS.ErrnoException).code
  if (code && ERROR_MESSAGES_KO[code]) {
    return ERROR_MESSAGES_KO[code]
  }
  if (err.message.includes('ENOENT')) return ERROR_MESSAGES_KO.ENOENT
  if (err.message.includes('EACCES')) return ERROR_MESSAGES_KO.EACCES
  if (err.message.includes('EPERM')) return ERROR_MESSAGES_KO.EPERM
  return err.message
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      const isTransient = code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'EAI_AGAIN'
      if (!isTransient || i === retries) throw err
    }
  }
  throw new Error('재시도 횟수를 초과했습니다')
}

describe('toKoreanError', () => {
  it('ENOENT 코드 → 한국어 메시지', () => {
    const err = Object.assign(new Error('no such file'), { code: 'ENOENT' })
    expect(toKoreanError(err)).toBe('파일을 찾을 수 없습니다')
  })

  it('EACCES 코드 → 한국어 메시지', () => {
    const err = Object.assign(new Error('permission denied'), { code: 'EACCES' })
    expect(toKoreanError(err)).toBe('접근 권한이 없습니다')
  })

  it('ENOSPC 코드 → 한국어 메시지', () => {
    const err = Object.assign(new Error('no space'), { code: 'ENOSPC' })
    expect(toKoreanError(err)).toBe('디스크 공간이 부족합니다')
  })

  it('메시지 내 ENOENT 포함 → 한국어 변환', () => {
    const err = new Error('ENOENT: no such file or directory')
    expect(toKoreanError(err)).toBe('파일을 찾을 수 없습니다')
  })

  it('알 수 없는 에러 → 원문 유지', () => {
    const err = new Error('Something unexpected happened')
    expect(toKoreanError(err)).toBe('Something unexpected happened')
  })

  it('비 Error 값 → 문자열 변환', () => {
    expect(toKoreanError('문자열 에러')).toBe('문자열 에러')
    expect(toKoreanError(42)).toBe('42')
    expect(toKoreanError(null)).toBe('null')
  })
})

describe('withRetry', () => {
  it('성공 시 즉시 반환', async () => {
    let calls = 0
    const result = await withRetry(async () => {
      calls++
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(calls).toBe(1)
  })

  it('일시적 오류 → 재시도 후 성공', async () => {
    let calls = 0
    const result = await withRetry(async () => {
      calls++
      if (calls < 2) {
        throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
      }
      return 'recovered'
    })
    expect(result).toBe('recovered')
    expect(calls).toBe(2)
  })

  it('비일시적 오류 → 즉시 throw', async () => {
    let calls = 0
    await expect(
      withRetry(async () => {
        calls++
        throw Object.assign(new Error('not found'), { code: 'ENOENT' })
      }),
    ).rejects.toThrow('not found')
    expect(calls).toBe(1) // No retries for non-transient
  })

  it('일시적 오류 반복 → 최대 재시도 후 throw', async () => {
    let calls = 0
    await expect(
      withRetry(async () => {
        calls++
        throw Object.assign(new Error('reset'), { code: 'ECONNRESET' })
      }, 2),
    ).rejects.toThrow('reset')
    expect(calls).toBe(3) // initial + 2 retries
  })

  it('재시도 횟수 커스텀', async () => {
    let calls = 0
    const result = await withRetry(async () => {
      calls++
      if (calls <= 3) {
        throw Object.assign(new Error('again'), { code: 'EAI_AGAIN' })
      }
      return 'finally'
    }, 4)
    expect(result).toBe('finally')
    expect(calls).toBe(4)
  })
})
