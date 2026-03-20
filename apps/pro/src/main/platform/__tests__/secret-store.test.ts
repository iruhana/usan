// @vitest-environment node

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteProviderSecret,
  getProviderSecret,
  getProviderSecretsStatus,
  initializeSecretStore,
  resetSecretStoreForTests,
  setProviderSecret,
  setSecretStoreCryptoAdapterForTests,
} from '../secret-store'

const tempDirs: string[] = []

function createTempSecretStoreFile(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'usan-secret-store-'))
  tempDirs.push(tempDir)
  return join(tempDir, 'provider-secrets.json')
}

afterEach(() => {
  delete process.env.OPENAI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.GEMINI_API_KEY
  resetSecretStoreForTests()

  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

describe('secret-store', () => {
  it('stores provider secrets in encrypted local storage without persisting plaintext', () => {
    const filePath = createTempSecretStoreFile()
    setSecretStoreCryptoAdapterForTests({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`enc:${value}`, 'utf8'),
      decryptString: (value) => value.toString('utf8').replace(/^enc:/, ''),
    })

    initializeSecretStore(filePath)
    const snapshot = setProviderSecret('openai', 'sk-test-openai')

    expect(existsSync(filePath)).toBe(true)
    expect(snapshot.providers.find((provider) => provider.provider === 'openai')).toEqual({
      provider: 'openai',
      configured: true,
      source: 'secure_store',
    })
    expect(getProviderSecret('openai')).toBe('sk-test-openai')
    expect(readFileSync(filePath, 'utf8')).not.toContain('sk-test-openai')
  })

  it('falls back to environment variables when no secure store secret is present', () => {
    const filePath = createTempSecretStoreFile()
    process.env.OPENAI_API_KEY = 'env-openai-key'

    setSecretStoreCryptoAdapterForTests({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`enc:${value}`, 'utf8'),
      decryptString: (value) => value.toString('utf8').replace(/^enc:/, ''),
    })

    initializeSecretStore(filePath)
    expect(getProviderSecretsStatus().providers.find((provider) => provider.provider === 'openai')).toEqual({
      provider: 'openai',
      configured: true,
      source: 'environment',
    })

    setProviderSecret('openai', 'stored-openai-key')
    expect(getProviderSecret('openai')).toBe('stored-openai-key')

    const deleted = deleteProviderSecret('openai')
    expect(deleted.providers.find((provider) => provider.provider === 'openai')).toEqual({
      provider: 'openai',
      configured: true,
      source: 'environment',
    })
    expect(getProviderSecret('openai')).toBe('env-openai-key')
  })

  it('reports encryption availability in provider secret status', () => {
    const filePath = createTempSecretStoreFile()
    setSecretStoreCryptoAdapterForTests({
      isEncryptionAvailable: () => false,
      encryptString: (value) => Buffer.from(value, 'utf8'),
      decryptString: (value) => value.toString('utf8'),
    })

    const snapshot = initializeSecretStore(filePath)

    expect(snapshot.encryptionAvailable).toBe(false)
    expect(snapshot.providers.every((provider) => provider.source === 'none')).toBe(true)
    expect(() => setProviderSecret('anthropic', 'sk-ant-test')).toThrow('Secure local secret storage is unavailable on this system.')
  })
})
