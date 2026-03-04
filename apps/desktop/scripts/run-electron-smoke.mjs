import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electronBinary = require('electron')

const appEntry = resolve(process.cwd(), 'out', 'main', 'index.js')
const rendererEntry = resolve(process.cwd(), 'out', 'renderer', 'index.html')
const timeoutMs = Number.parseInt(process.env['USAN_SMOKE_SELFTEST_TIMEOUT_MS'] ?? '45000', 10)

if (!existsSync(appEntry) || !existsSync(rendererEntry)) {
  console.error('Smoke self-test requires a built app. Run "npm run build" first.')
  process.exit(1)
}

if (!existsSync(electronBinary)) {
  console.error(`Electron executable not found: ${electronBinary}`)
  process.exit(1)
}

const child = spawn(electronBinary, [appEntry], {
  env: (() => {
    const nextEnv = {
      ...process.env,
      USAN_SMOKE_SELFTEST: '1',
      USAN_SMOKE_SELFTEST_TIMEOUT_MS: String(timeoutMs),
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    }
    delete nextEnv.ELECTRON_RUN_AS_NODE
    return nextEnv
  })(),
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''

child.stdout.on('data', (chunk) => {
  stdout += chunk.toString('utf8')
})

child.stderr.on('data', (chunk) => {
  stderr += chunk.toString('utf8')
})

const guard = setTimeout(() => {
  child.kill('SIGKILL')
}, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs + 5000 : 50000)

child.on('error', (err) => {
  clearTimeout(guard)
  console.error(`Failed to launch Electron smoke self-test: ${err.message}`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  clearTimeout(guard)

  if (code === 0) {
    console.log('Electron smoke self-test passed.')
    process.exit(0)
  }

  const details = [
    `Electron smoke self-test failed (code=${code}, signal=${signal ?? 'none'}).`,
    stdout ? `--- stdout ---\n${stdout.trim()}` : '',
    stderr ? `--- stderr ---\n${stderr.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  console.error(details)
  process.exit(1)
})
