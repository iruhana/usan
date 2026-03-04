import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electronBinary = require('electron')
const appEntry = resolve(process.cwd(), 'out', 'main', 'index.js')
const aliveMs = Number.parseInt(process.env['USAN_RUNTIME_SMOKE_ALIVE_MS'] ?? '15000', 10)

const env = {
  ...process.env,
  ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
}
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electronBinary, [appEntry], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''
let killedByUs = false

child.stdout.on('data', (chunk) => {
  stdout += chunk.toString('utf8')
})

child.stderr.on('data', (chunk) => {
  stderr += chunk.toString('utf8')
})

child.on('error', (err) => {
  console.error(`Failed to launch Electron runtime smoke: ${err.message}`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (stdout.trim()) {
    console.log('--- stdout ---')
    console.log(stdout.trim())
  }
  if (stderr.trim()) {
    console.log('--- stderr ---')
    console.log(stderr.trim())
  }

  if (killedByUs && signal === 'SIGTERM') {
    console.log(`Runtime smoke passed: app stayed alive for ${aliveMs}ms`)
    process.exit(0)
  }

  if (code === 0) {
    console.log('Runtime smoke passed: app exited cleanly')
    process.exit(0)
  }

  console.error(`Runtime smoke failed: code=${code}, signal=${signal ?? 'none'}`)
  process.exit(1)
})

setTimeout(() => {
  killedByUs = true
  child.kill('SIGTERM')
}, Number.isFinite(aliveMs) && aliveMs > 0 ? aliveMs : 15000)

