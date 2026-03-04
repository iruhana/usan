import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const smokeRunner = resolve(projectRoot, 'scripts', 'run-electron-smoke.mjs')
const appEntry = resolve(projectRoot, 'out', 'main', 'index.js')
const rendererEntry = resolve(projectRoot, 'out', 'renderer', 'index.html')
const enabled = process.env['USAN_E2E_ELECTRON'] === '1'
const canRun = enabled && existsSync(smokeRunner) && existsSync(appEntry) && existsSync(rendererEntry)

describe('electron smoke e2e', () => {
  it.skipIf(!canRun)('boots the built Electron app in self-test mode', () => {
    const result = spawnSync(process.execPath, [smokeRunner], {
      env: {
        ...process.env,
        USAN_SMOKE_SELFTEST_TIMEOUT_MS: process.env['USAN_SMOKE_SELFTEST_TIMEOUT_MS'] ?? '45000',
      },
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 60000,
    })

    const combinedOutput = [result.stdout ?? '', result.stderr ?? ''].filter(Boolean).join('\n')

    expect(result.error == null, result.error?.message ?? 'unknown spawn error').toBe(true)
    expect(result.status, combinedOutput).toBe(0)
  }, 70000)
})
