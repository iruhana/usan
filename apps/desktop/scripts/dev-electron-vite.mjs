import { spawn } from 'node:child_process'

const command = process.platform === 'win32' ? 'npx electron-vite dev' : 'npx electron-vite dev'
const env = { ...process.env }

// Ensure Electron is not forced to run as plain Node during local dev.
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(command, {
  env,
  shell: true,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
