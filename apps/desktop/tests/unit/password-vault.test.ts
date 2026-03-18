import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { writeFile, rename } from 'fs/promises'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/usan-test',
  },
}))

vi.mock('@main/security', () => ({
  encryptString: (value: string) => Buffer.from(value),
  decryptString: (value: Buffer) => value.toString(),
  validatePath: () => null,
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn(() => true),
  }
})

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  return {
    ...actual,
    writeFile: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
  }
})

describe('password-vault', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses browser CSV rows with quoted values', async () => {
    const { parseCredentialCsv } = await import('@main/password/password-vault')
    const csv = [
      'name,url,username,password',
      'Google,https://accounts.google.com,alice@example.com,"p,ass"',
      'GitHub,https://github.com,bob,secret123',
    ].join('\n')

    const rows = parseCredentialCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      site: 'https://accounts.google.com',
      username: 'alice@example.com',
      password: 'p,ass',
    })
  })

  it('returns empty list when password column is missing', async () => {
    const { parseCredentialCsv } = await import('@main/password/password-vault')
    const csv = ['name,url,username', 'Google,https://google.com,alice'].join('\n')
    expect(parseCredentialCsv(csv)).toEqual([])
  })

  it('imports CSV and skips duplicated credentials', async () => {
    const { importCredentialCsv } = await import('@main/password/password-vault')

    vi.mocked(readFileSync).mockImplementation((path: unknown, _encoding?: unknown) => {
      const pathText = String(path)
      if (pathText.endsWith('.csv')) {
        return [
          'name,url,username,password',
          'GitHub,https://github.com,bob,secret123',
          'GitHub,https://github.com,bob,secret123',
          'Google,https://google.com,alice,pass-2',
        ].join('\n')
      }
      throw new Error('ENOENT')
    })

    const result = await importCredentialCsv('C:\\Users\\admin\\Downloads\\passwords.csv')
    expect(result.importedCount).toBe(2)
    expect(result.skippedCount).toBe(1)
    expect(result.totalCount).toBe(2)

    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(rename).toHaveBeenCalledTimes(1)
  })
})
