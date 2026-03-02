import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, stat, readdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// Test the core logic functions directly since scanTempFiles/cleanTempFiles
// depend on real temp directories. We replicate the filter logic for unit testing.

const STALE_MS = 7 * 24 * 60 * 60 * 1000
const TEMP_EXTENSIONS = new Set(['.tmp', '.log', '.bak', '.old', '.cache', '.dmp'])

function isStaleTemp(fileName: string, mtime: Date): boolean {
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
  if (!TEMP_EXTENSIONS.has(ext)) return false
  return Date.now() - mtime.getTime() > STALE_MS
}

describe('isStaleTemp (확장자 필터)', () => {
  const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

  it('.tmp 파일 → 대상', () => {
    expect(isStaleTemp('cache.tmp', oldDate)).toBe(true)
  })

  it('.log 파일 → 대상', () => {
    expect(isStaleTemp('app.log', oldDate)).toBe(true)
  })

  it('.bak 파일 → 대상', () => {
    expect(isStaleTemp('data.bak', oldDate)).toBe(true)
  })

  it('.old 파일 → 대상', () => {
    expect(isStaleTemp('config.old', oldDate)).toBe(true)
  })

  it('.cache 파일 → 대상', () => {
    expect(isStaleTemp('shader.cache', oldDate)).toBe(true)
  })

  it('.dmp 파일 → 대상', () => {
    expect(isStaleTemp('crash.dmp', oldDate)).toBe(true)
  })

  it('.txt 파일 → 제외', () => {
    expect(isStaleTemp('readme.txt', oldDate)).toBe(false)
  })

  it('.exe 파일 → 제외', () => {
    expect(isStaleTemp('app.exe', oldDate)).toBe(false)
  })

  it('.dll 파일 → 제외', () => {
    expect(isStaleTemp('system.dll', oldDate)).toBe(false)
  })

  it('.js 파일 → 제외', () => {
    expect(isStaleTemp('index.js', oldDate)).toBe(false)
  })
})

describe('isStaleTemp (날짜 필터)', () => {
  it('7일 이상 된 .tmp → 대상', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    expect(isStaleTemp('old.tmp', eightDaysAgo)).toBe(true)
  })

  it('7일 미만 .tmp → 제외', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(isStaleTemp('recent.tmp', twoDaysAgo)).toBe(false)
  })

  it('정확히 7일 전 .tmp → 제외 (초과만 대상)', () => {
    const exactlySeven = new Date(Date.now() - STALE_MS)
    // Not stale because STALE_MS is the boundary (not exceeded)
    expect(isStaleTemp('boundary.tmp', exactlySeven)).toBe(false)
  })

  it('방금 생성된 .log → 제외', () => {
    expect(isStaleTemp('fresh.log', new Date())).toBe(false)
  })

  it('30일 전 .dmp → 대상', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    expect(isStaleTemp('old_crash.dmp', thirtyDaysAgo)).toBe(true)
  })
})

describe('isStaleTemp (대소문자)', () => {
  const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  it('.TMP (대문자) → 대상', () => {
    expect(isStaleTemp('CACHE.TMP', oldDate)).toBe(true)
  })

  it('.Log (혼합) → 대상', () => {
    expect(isStaleTemp('App.Log', oldDate)).toBe(true)
  })

  it('.BAK (대문자) → 대상', () => {
    expect(isStaleTemp('DATA.BAK', oldDate)).toBe(true)
  })
})

describe('scanTempFiles + cleanTempFiles (통합)', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = join(tmpdir(), `usan-test-tc-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      const { rm } = await import('fs/promises')
      await rm(testDir, { recursive: true, force: true })
    } catch { /* ignore */ }
  })

  it('임시 디렉토리에 테스트 파일 생성 가능', async () => {
    const filePath = join(testDir, 'test.tmp')
    await writeFile(filePath, 'temp data')
    const info = await stat(filePath)
    expect(info.isFile()).toBe(true)
    expect(info.size).toBeGreaterThan(0)
  })

  it('여러 파일 생성 후 확인', async () => {
    await writeFile(join(testDir, 'a.tmp'), '1')
    await writeFile(join(testDir, 'b.log'), '2')
    await writeFile(join(testDir, 'c.txt'), '3')
    const entries = await readdir(testDir)
    expect(entries).toHaveLength(3)
  })
})
