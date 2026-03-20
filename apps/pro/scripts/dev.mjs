import { spawn } from 'node:child_process'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn('npx electron-vite dev', {
  env,
  shell: true,
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
})

child.on('exit', (code, signal) => {
  if (signal) { process.kill(process.pid, signal); return }
  process.exit(code ?? 0)
})

child.on('error', (err) => { console.error(err); process.exit(1) })
