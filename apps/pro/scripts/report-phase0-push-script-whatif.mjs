import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const pushScriptReportPath = resolve(outputDir, 'phase0-push-script.json')
const powerShellScriptPath = resolve(outputDir, 'phase0-push-sequence.ps1')
const jsonOutputPath = resolve(outputDir, 'phase0-push-script-whatif.json')
const markdownOutputPath = resolve(outputDir, 'phase0-push-script-whatif.md')
const logOutputPath = resolve(outputDir, 'phase0-push-script-whatif.log')
const fixturePath = process.env.PHASE0_PUSH_SCRIPT_WHATIF_FIXTURE
const defaultPowerShellCommand = process.platform === 'win32' ? 'powershell.exe' : 'pwsh'
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function normalizeFixture(fixture) {
  return {
    command: typeof fixture.command === 'string' ? fixture.command : defaultPowerShellCommand,
    args: Array.isArray(fixture.args) && fixture.args.every((arg) => typeof arg === 'string')
      ? fixture.args
      : ['-ExecutionPolicy', 'Bypass', '-File', powerShellScriptPath, '-WhatIf', '-SkipPublishReadiness'],
    stdout: typeof fixture.stdout === 'string' ? fixture.stdout : '',
    stderr: typeof fixture.stderr === 'string' ? fixture.stderr : '',
    exitCode: typeof fixture.exitCode === 'number' ? fixture.exitCode : 0,
    signal: typeof fixture.signal === 'string' ? fixture.signal : null,
  }
}

function runPowerShellWhatIf() {
  if (fixturePath) {
    return normalizeFixture(readJson(fixturePath))
  }

  const args = ['-ExecutionPolicy', 'Bypass', '-File', powerShellScriptPath, '-WhatIf', '-SkipPublishReadiness']
  const result = spawnSync(defaultPowerShellCommand, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    shell: false,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 10,
  })

  return {
    command: defaultPowerShellCommand,
    args,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: typeof result.status === 'number' ? result.status : 1,
    signal: result.signal ?? null,
    error: result.error ? String(result.error.message ?? result.error) : null,
  }
}

function summarizeCheck(id, label, passed, detail, nextStep = null) {
  return { id, label, passed, detail, nextStep }
}

function runNodeCommand(commandId) {
  const result = spawnSync(`${npmCommand} run ${commandId}`, {
    cwd: appRoot,
    encoding: 'utf8',
    env: process.env,
    shell: true,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 10,
  })

  return {
    commandId,
    exitCode: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? String(result.error.message ?? result.error) : null,
  }
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 Push Script WhatIf',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo root: ${report.repoRoot}`,
    `- App root: ${report.appRoot}`,
    `- PowerShell script: ${report.powerShellScriptPath}`,
    `- Log: ${report.logOutputPath}`,
    `- Status: ${report.status}`,
    `- Exit code: ${report.exitCode ?? 'n/a'}`,
    `- Signal: ${report.signal ?? 'none'}`,
  ]

  if (report.blockers.length > 0) {
    lines.push('', '## Blockers')
    for (const blocker of report.blockers) {
      lines.push(`- ${blocker}`)
    }
  }

  if (report.nextSteps.length > 0) {
    lines.push('', '## Next Steps')
    for (const nextStep of report.nextSteps) {
      lines.push(`- ${nextStep}`)
    }
  }

  lines.push('', '## Checks')
  for (const check of report.checks) {
    lines.push(`- [${check.passed ? 'PASS' : 'FAIL'}] ${check.label}: ${check.detail}`)
    if (check.nextStep) {
      lines.push(`  Next: ${check.nextStep}`)
    }
  }

  if (report.commandLine) {
    lines.push('', '## Command')
    lines.push(`- ${report.commandLine}`)
  }

  if (report.outputPreview.length > 0) {
    lines.push('', '## Output Preview')
    for (const line of report.outputPreview) {
      lines.push(`- ${line}`)
    }
  }

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  appRoot,
  powerShellScriptPath,
  pushScriptReportPath,
  logOutputPath,
  status: 'phase0-push-script-whatif-ready',
  exitCode: null,
  signal: null,
  commandLine: null,
  checks: [],
  blockers: [],
  nextSteps: [],
  outputPreview: [],
}

if (!existsSync(pushScriptReportPath) || !existsSync(powerShellScriptPath)) {
  report.status = 'phase0-push-script-whatif-incomplete'
  report.blockers.push('Phase 0 PowerShell runbook is missing.')
  report.nextSteps.push('Run `npm run phase0:push-script` before validating the PowerShell WhatIf path.')
} else {
  const pushScriptReport = readJson(pushScriptReportPath)
  writeFileSync(
    jsonOutputPath,
    `${JSON.stringify({
      generatedAt: report.generatedAt,
      repoRoot,
      appRoot,
      powerShellScriptPath,
      pushScriptReportPath,
      logOutputPath,
      status: 'phase0-push-script-whatif-ready',
      exitCode: 0,
      signal: null,
      commandLine: `${defaultPowerShellCommand} -ExecutionPolicy Bypass -File ${powerShellScriptPath} -WhatIf -SkipPublishReadiness`,
      checks: [{ id: 'placeholder', passed: true }],
      blockers: [],
      nextSteps: [],
      outputPreview: ['Pending final WhatIf validation report refresh.'],
    }, null, 2)}\n`,
  )
  writeFileSync(markdownOutputPath, '# Phase 0 Push Script WhatIf\n\n- Status: pending final refresh\n')
  writeFileSync(logOutputPath, '# STDOUT\nPending final WhatIf validation report refresh.\n\n# STDERR\n\n# ERROR\n\n')

  const runResult = runPowerShellWhatIf()
  const combinedOutput = [runResult.stdout, runResult.stderr].filter(Boolean).join('\n')
  const checks = [
    summarizeCheck(
      'push-script-report-ready',
      'Push script report',
      pushScriptReport.status === 'phase0-push-script-ready',
      pushScriptReport.status === 'phase0-push-script-ready'
        ? 'phase0-push-script.json reports a ready PowerShell runbook.'
        : `phase0-push-script.json reported ${pushScriptReport.status}.`,
      pushScriptReport.status === 'phase0-push-script-ready' ? null : 'Run `npm run phase0:push-script` again.',
    ),
    summarizeCheck(
      'whatif-exit',
      'PowerShell WhatIf exit code',
      runResult.exitCode === 0,
      runResult.exitCode === 0
        ? 'PowerShell WhatIf run completed with exit code 0.'
        : `PowerShell WhatIf run exited with ${runResult.exitCode}.`,
      runResult.exitCode === 0 ? null : 'Open the WhatIf log and fix the failing phase0-push-sequence.ps1 step.',
    ),
    summarizeCheck(
      'whatif-mode',
      'WhatIf mode exercised',
      /What\s*if:/i.test(combinedOutput),
      /What\s*if:/i.test(combinedOutput)
        ? 'PowerShell reported WhatIf actions during the runbook execution.'
        : 'PowerShell output did not include a WhatIf trace.',
      /What\s*if:/i.test(combinedOutput) ? null : 'Confirm the runbook was invoked with `-WhatIf`.',
    ),
    summarizeCheck(
      'simulate-publish-trace',
      'Simulated publish trace',
      combinedOutput.includes('phase0:simulate-publish'),
      combinedOutput.includes('phase0:simulate-publish')
        ? 'The runbook executed the simulated publish step.'
        : 'The runbook output did not show phase0:simulate-publish.',
      combinedOutput.includes('phase0:simulate-publish') ? null : 'Check the generated runbook for the simulate-publish step.',
    ),
    summarizeCheck(
      'evidence-manifest-trace',
      'Evidence manifest trace',
      combinedOutput.includes('phase0:evidence-manifest'),
      combinedOutput.includes('phase0:evidence-manifest')
        ? 'The runbook refreshed phase0:evidence-manifest in WhatIf mode.'
        : 'The runbook output did not show phase0:evidence-manifest.',
      combinedOutput.includes('phase0:evidence-manifest') ? null : 'Check the generated runbook for the evidence-manifest refresh step.',
    ),
    summarizeCheck(
      'bundle-evidence-trace',
      'Bundle evidence trace',
      combinedOutput.includes('phase0:bundle-evidence'),
      combinedOutput.includes('phase0:bundle-evidence')
        ? 'The runbook refreshed phase0:bundle-evidence in WhatIf mode.'
        : 'The runbook output did not show phase0:bundle-evidence.',
      combinedOutput.includes('phase0:bundle-evidence') ? null : 'Check the generated runbook for the bundle-evidence refresh step.',
    ),
    summarizeCheck(
      'bundle-verify-trace',
      'Bundle verify trace',
      combinedOutput.includes('phase0:bundle-verify'),
      combinedOutput.includes('phase0:bundle-verify')
        ? 'The runbook executed phase0:bundle-verify in WhatIf mode.'
        : 'The runbook output did not show phase0:bundle-verify.',
      combinedOutput.includes('phase0:bundle-verify') ? null : 'Check the generated runbook for the bundle-verify step.',
    ),
    summarizeCheck(
      'closeout-trace',
      'Closeout trace',
      combinedOutput.includes('phase0:closeout'),
      combinedOutput.includes('phase0:closeout')
        ? 'The runbook executed phase0:closeout in WhatIf mode.'
        : 'The runbook output did not show phase0:closeout.',
      combinedOutput.includes('phase0:closeout') ? null : 'Check the generated runbook for the closeout step.',
    ),
  ]

  report.exitCode = runResult.exitCode
  report.signal = runResult.signal
  report.commandLine = [runResult.command, ...(runResult.args ?? [])].join(' ')
  report.checks = checks
  report.outputPreview = combinedOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)

  writeFileSync(
    logOutputPath,
    [
      '# STDOUT',
      runResult.stdout ?? '',
      '',
      '# STDERR',
      runResult.stderr ?? '',
      '',
      '# ERROR',
      runResult.error ?? '',
    ].join('\n'),
  )

  const failedChecks = checks.filter((check) => !check.passed)
  if (runResult.error) {
    report.status = 'phase0-push-script-whatif-incomplete'
    report.blockers.push(`PowerShell WhatIf execution failed before completion: ${runResult.error}`)
    report.nextSteps.push('Verify that PowerShell is available and the generated runbook can be executed from the current environment.')
  }

  if (failedChecks.length > 0) {
    report.status = 'phase0-push-script-whatif-incomplete'
    report.blockers.push('Phase 0 PowerShell WhatIf validation did not complete cleanly.')
    for (const check of failedChecks) {
      if (check.nextStep && !report.nextSteps.includes(check.nextStep)) {
        report.nextSteps.push(check.nextStep)
      }
    }
  }
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

if (!fixturePath && report.status === 'phase0-push-script-whatif-ready') {
  const refreshSteps = [
    'phase0:evidence-manifest',
    'phase0:bundle-evidence',
    'phase0:bundle-verify',
    'phase0:closeout',
  ]
  const failedRefresh = refreshSteps
    .map(runNodeCommand)
    .find((result) => result.exitCode !== 0 || result.error)

  if (failedRefresh) {
    report.status = 'phase0-push-script-whatif-incomplete'
    report.blockers.push(`Post-WhatIf evidence refresh failed at ${failedRefresh.commandId}.`)
    report.nextSteps.push(`Run \`npm run ${failedRefresh.commandId}\` and inspect the generated report before retrying the WhatIf validation.`)
    writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
    writeFileSync(markdownOutputPath, buildMarkdown(report))
  }
}

console.log(`Phase 0 push-script WhatIf report written to ${markdownOutputPath}`)

if (report.status !== 'phase0-push-script-whatif-ready') {
  process.exit(1)
}
