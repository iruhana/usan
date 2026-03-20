import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const appRoot = process.cwd()
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const receiptPath = resolve(outputDir, 'verify-strict-receipt.json')
const markdownPath = resolve(outputDir, 'verify-strict-receipt.md')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const defaultReceiptRefreshIds = [
  'phase0:evidence-manifest',
  'phase0:bundle-evidence',
  'phase0:bundle-verify',
  'phase0:publish-readiness',
]

const baseCommandPlan = [
  { id: 'typecheck', command: npmCommand, args: ['run', 'typecheck'] },
  { id: 'lint', command: npmCommand, args: ['run', 'lint'] },
  { id: 'test:smoke', command: npmCommand, args: ['run', 'test:smoke'] },
  { id: 'test:a11y', command: npmCommand, args: ['run', 'test:a11y'] },
  { id: 'test', command: npmCommand, args: ['run', 'test'] },
  { id: 'build', command: npmCommand, args: ['run', 'build'] },
  { id: 'test:e2e:electron:compiled', command: npmCommand, args: ['run', 'test:e2e:electron:compiled'] },
]

const phase0CommandPlan = [
  'phase0:readiness',
  'phase0:closeout',
  'phase0:commit-handoff',
  'phase0:simulate-publish',
  'phase0:publish-status',
  'phase0:commit-dry-run',
  'phase0:push-handoff',
  'phase0:push-script',
  'phase0:push-script-whatif',
  'phase0:evidence-manifest',
  'phase0:bundle-evidence',
  'phase0:bundle-verify',
  'phase0:publish-readiness',
].map((id) => ({
  id,
  command: npmCommand,
  args: ['run', id],
}))

function readPlanFixture() {
  const fixturePath = process.env.VERIFY_STRICT_PLAN_FIXTURE
  if (!fixturePath) {
    return null
  }

  return JSON.parse(readFileSync(fixturePath, 'utf8'))
}

function normalizePlanEntry(entry) {
  if (
    !entry
    || typeof entry.id !== 'string'
    || typeof entry.command !== 'string'
    || !Array.isArray(entry.args)
    || entry.args.some((arg) => typeof arg !== 'string')
  ) {
    throw new Error('VERIFY_STRICT_PLAN_FIXTURE contains an invalid command entry.')
  }

  return {
    id: entry.id,
    command: entry.command,
    args: [...entry.args],
  }
}

const planFixture = readPlanFixture()
const commandPlan = Array.isArray(planFixture?.commands)
  ? planFixture.commands.map(normalizePlanEntry)
  : [...baseCommandPlan, ...phase0CommandPlan]
const receiptRefreshIds = Array.isArray(planFixture?.receiptRefreshIds)
  ? planFixture.receiptRefreshIds.filter((id) => typeof id === 'string')
  : defaultReceiptRefreshIds

function runCommand(step) {
  return new Promise((resolvePromise) => {
    const startedAt = new Date()
    const start = Date.now()
    const commandLine = [step.command, ...step.args].join(' ')
    const child = spawn(commandLine, {
      cwd: appRoot,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    })

    child.on('exit', (code, signal) => {
      resolvePromise({
        id: step.id,
        command: `${step.command} ${step.args.join(' ')}`,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - start,
        passed: code === 0,
        exitCode: code,
        signal,
      })
    })
  })
}

function writeReceipt(receipt) {
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)

  const lines = [
    '# Verify Strict Receipt',
    '',
    `- Generated at: ${receipt.generatedAt}`,
    `- Result: ${receipt.passed ? 'PASS' : 'FAIL'}`,
    `- Commands: ${receipt.commands.filter((command) => command.passed).length}/${receipt.commands.length}`,
    '',
    '## Commands',
  ]

  for (const command of receipt.commands) {
    lines.push(
      `- [${command.passed ? 'x' : ' '}] ${command.id}: ${command.command} (${command.durationMs}ms)`,
    )
  }

  if (receipt.failedCommandId) {
    lines.push('', `- Failed command: ${receipt.failedCommandId}`)
  }

  writeFileSync(markdownPath, `${lines.join('\n')}\n`)
}

const commandResults = []

for (const step of commandPlan) {
  const result = await runCommand(step)
  commandResults.push(result)

  const receipt = {
    generatedAt: new Date().toISOString(),
    passed: result.passed,
    failedCommandId: result.passed ? null : result.id,
    commands: [...commandResults],
  }

  writeReceipt(receipt)

  if (!result.passed) {
    process.exit(result.exitCode ?? 1)
  }
}

const finalReceipt = {
  generatedAt: new Date().toISOString(),
  passed: true,
  failedCommandId: null,
  commands: [...commandResults],
}

writeReceipt(finalReceipt)

const refreshSteps = receiptRefreshIds
  .map((id) => commandPlan.find((step) => step.id === id))
  .filter(Boolean)

if (refreshSteps.length > 0) {
  console.log('Refreshing receipt-dependent Phase 0 reports after final receipt stabilization...')
}

for (const step of refreshSteps) {
  const result = await runCommand(step)
  if (!result.passed) {
    process.exit(result.exitCode ?? 1)
  }
}
