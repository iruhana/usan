import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const command = process.platform === 'win32' ? (process.env['ComSpec'] || 'cmd.exe') : 'sh'
const commandArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npm run test:e2e:electron:a11y']
  : ['-lc', 'npm run test:e2e:electron:a11y']
const packageJson = resolve(projectRoot, 'package.json')
const runner = resolve(projectRoot, 'scripts', 'run-electron-a11y.mjs')
const enabled = process.env['USAN_E2E_ELECTRON'] === '1'
const canRun = enabled && existsSync(packageJson) && existsSync(runner)

describe('electron a11y e2e', () => {
  it.skipIf(!canRun)('scans core pages, recovery surfaces, key modals, and onboarding for serious accessibility issues', () => {
    const result = spawnSync(command, commandArgs, {
      env: {
        ...process.env,
        USAN_E2E_ELECTRON: '1',
        NODE_OPTIONS: '',
      },
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 240000,
      cwd: projectRoot,
    })

    const combinedOutput = [result.stdout ?? '', result.stderr ?? ''].filter(Boolean).join('\n')
    expect(result.error == null, result.error?.message ?? 'unknown spawn error').toBe(true)
    expect(result.status, combinedOutput).toBe(0)
  }, 250000)
})
