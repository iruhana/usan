import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const command = process.platform === 'win32' ? (process.env['ComSpec'] || 'cmd.exe') : 'sh'
const commandArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npm run test:e2e:electron']
  : ['-lc', 'npm run test:e2e:electron']
const packageJson = resolve(projectRoot, 'package.json')
const smokeRunner = resolve(projectRoot, 'scripts', 'run-electron-smoke.mjs')
const enabled = process.env['USAN_E2E_ELECTRON'] === '1'
const canRun = enabled && existsSync(packageJson) && existsSync(smokeRunner)

describe('electron smoke e2e', () => {
  it.skipIf(!canRun)('boots the built Electron app in self-test mode', () => {
    const result = spawnSync(command, commandArgs, {
      env: {
        ...process.env,
        USAN_SMOKE_SELFTEST_TIMEOUT_MS: process.env['USAN_SMOKE_SELFTEST_TIMEOUT_MS'] ?? '45000',
        USAN_E2E_ELECTRON: '1',
        NODE_OPTIONS: '',
      },
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 120000,
      cwd: projectRoot,
    })

    const combinedOutput = [result.stdout ?? '', result.stderr ?? ''].filter(Boolean).join('\n')

    expect(result.error == null, result.error?.message ?? 'unknown spawn error').toBe(true)
    expect(result.status, combinedOutput).toBe(0)
  }, 130000)
})
