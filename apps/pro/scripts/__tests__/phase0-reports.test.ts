/* @vitest-environment node */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const testFileDir = dirname(fileURLToPath(import.meta.url))
const scriptsDir = resolve(testFileDir, '..')
const reportCiStatusScriptPath = resolve(scriptsDir, 'report-phase0-ci-status.mjs')
const reportCiCompareScriptPath = resolve(scriptsDir, 'report-phase0-ci-compare.mjs')
const runCiObserveScriptPath = resolve(scriptsDir, 'run-phase0-ci-observe.mjs')
const reportCloseoutScriptPath = resolve(scriptsDir, 'report-phase0-closeout.mjs')
const reportCommitHandoffScriptPath = resolve(scriptsDir, 'report-phase0-commit-handoff.mjs')
const reportCommitDryRunScriptPath = resolve(scriptsDir, 'report-phase0-commit-dry-run.mjs')
const reportStageScopeScriptPath = resolve(scriptsDir, 'report-phase0-stage-scope.mjs')
const reportPublishStatusScriptPath = resolve(scriptsDir, 'report-phase0-publish-status.mjs')
const reportSimulatePublishScriptPath = resolve(scriptsDir, 'report-phase0-simulate-publish.mjs')
const reportPushHandoffScriptPath = resolve(scriptsDir, 'report-phase0-push-handoff.mjs')
const reportPushScriptScriptPath = resolve(scriptsDir, 'report-phase0-push-script.mjs')
const reportPushScriptWhatIfScriptPath = resolve(scriptsDir, 'report-phase0-push-script-whatif.mjs')
const reportEvidenceManifestScriptPath = resolve(scriptsDir, 'report-phase0-evidence-manifest.mjs')
const reportBundleEvidenceScriptPath = resolve(scriptsDir, 'report-phase0-bundle-evidence.mjs')
const reportBundleVerifyScriptPath = resolve(scriptsDir, 'report-phase0-bundle-verify.mjs')
const reportPublishReadinessScriptPath = resolve(scriptsDir, 'report-phase0-publish-readiness.mjs')
const runVerifyStrictScriptPath = resolve(scriptsDir, 'run-verify-strict.mjs')
const remoteObservationEvidenceFiles = [
  'phase0-ci-status.json',
  'phase0-ci-status.md',
  'phase0-ci-compare.json',
  'phase0-ci-compare.md',
  'phase0-ci-observed-run.json',
]
const criticalPublishTargets = [
  '.github/workflows/pro-quality.yml',
  'apps/pro/docs/phase0-closeout-2026-03-20.md',
  'apps/pro/scripts/report-phase0-ci-status.mjs',
  'apps/pro/scripts/report-phase0-ci-compare.mjs',
  'apps/pro/scripts/report-phase0-closeout.mjs',
  'apps/pro/scripts/report-phase0-commit-dry-run.mjs',
  'apps/pro/scripts/report-phase0-publish-status.mjs',
  'apps/pro/scripts/report-phase0-simulate-publish.mjs',
  'apps/pro/scripts/report-phase0-stage-scope.mjs',
  'apps/pro/scripts/report-phase0-push-handoff.mjs',
  'apps/pro/scripts/report-phase0-push-script.mjs',
  'apps/pro/scripts/report-phase0-push-script-whatif.mjs',
  'apps/pro/scripts/report-phase0-evidence-manifest.mjs',
  'apps/pro/scripts/report-phase0-bundle-evidence.mjs',
  'apps/pro/scripts/report-phase0-bundle-verify.mjs',
  'apps/pro/scripts/report-phase0-publish-readiness.mjs',
  'apps/pro/scripts/run-phase0-ci-observe.mjs',
  'apps/pro/scripts/run-verify-strict.mjs',
]

const fixtureRoots: string[] = []

function createFixture() {
  const repoRoot = mkdtempSync(join(tmpdir(), 'usan-pro-phase0-'))
  const appRoot = join(repoRoot, 'apps', 'pro')
  mkdirSync(appRoot, { recursive: true })
  mkdirSync(join(repoRoot, '.github', 'workflows'), { recursive: true })
  mkdirSync(join(appRoot, 'docs'), { recursive: true })
  mkdirSync(join(appRoot, 'output', 'phase0-readiness'), { recursive: true })
  writeFileSync(join(repoRoot, '.github', 'workflows', 'pro-quality.yml'), 'name: Pro Quality\n')
  writeFileSync(join(appRoot, '.gitignore'), 'output/\n')
  writeFileSync(join(appRoot, 'docs', 'phase0-closeout-2026-03-20.md'), '# closeout\n')
  fixtureRoots.push(repoRoot)
  return { repoRoot, appRoot }
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writePushScriptWhatIfEvidence(
  outputDir: string,
  overrides: Record<string, unknown> = {},
) {
  writeJson(join(outputDir, 'phase0-push-script-whatif.json'), {
    generatedAt: '2026-03-20T00:00:05.250Z',
    status: 'phase0-push-script-whatif-ready',
    exitCode: 0,
    checks: [{ id: 'whatif-exit', passed: true }],
    ...overrides,
  })
  writeFileSync(join(outputDir, 'phase0-push-script-whatif.md'), '# push script whatif\n')
  writeFileSync(join(outputDir, 'phase0-push-script-whatif.log'), 'What if: Performing the operation "Stage Phase 0 scope"\n')
}

function materializeCriticalPublishTargets(repoRoot: string, omitPaths: string[] = []) {
  const omitted = new Set(omitPaths.map((item) => item.replace(/\\/g, '/')))
  for (const relativePath of criticalPublishTargets) {
    const normalizedPath = relativePath.replace(/\\/g, '/')
    if (omitted.has(normalizedPath)) {
      continue
    }

    const absolutePath = join(repoRoot, ...normalizedPath.split('/'))
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, `fixture for ${normalizedPath}\n`)
  }
}

function runNode(scriptPath: string, cwd: string, args: string[] = [], env: NodeJS.ProcessEnv = process.env) {
  execFileSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    env,
    stdio: 'pipe',
  })
}

function initCleanRepoWithUpstream(repoRoot: string) {
  execFileSync('git', ['init', '-b', 'main'], { cwd: repoRoot, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'Codex Test'], { cwd: repoRoot, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'codex@example.com'], { cwd: repoRoot, stdio: 'ignore' })
  execFileSync('git', ['add', '.'], { cwd: repoRoot, stdio: 'ignore' })
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repoRoot, stdio: 'ignore' })

  const remoteRoot = join(dirname(repoRoot), `${Math.random().toString(16).slice(2)}-remote.git`)
  fixtureRoots.push(remoteRoot)
  execFileSync('git', ['init', '--bare', remoteRoot], { cwd: repoRoot, stdio: 'ignore' })
  execFileSync('git', ['remote', 'add', 'origin', remoteRoot], { cwd: repoRoot, stdio: 'ignore' })
  execFileSync('git', ['push', '-u', 'origin', 'main'], { cwd: repoRoot, stdio: 'ignore' })
  execFileSync('git', ['remote', 'set-url', 'origin', 'https://github.com/iruhana/usan.git'], { cwd: repoRoot, stdio: 'ignore' })
}

function createEvidencePayload(appRoot: string) {
  const outputDir = join(appRoot, 'output', 'phase0-readiness')
  const visualOutputDir = join(appRoot, 'output', 'playwright', 'electron-smoke')
  const visualManifest = {
    themes: {
      dark: {
        screenshotPath: 'C:\\remote\\pro-electron-smoke\\shell-dark.png',
        zones: [{ zone: 'titlebar', path: 'C:\\remote\\pro-electron-smoke\\dark-titlebar.png' }],
      },
      light: {
        screenshotPath: 'C:\\remote\\pro-electron-smoke\\shell-light.png',
        zones: [{ zone: 'titlebar', path: 'C:\\remote\\pro-electron-smoke\\light-titlebar.png' }],
      },
    },
    reducedMotion: {
      animationDuration: '1e-05s',
      animationIterationCount: '1',
    },
  }

  mkdirSync(visualOutputDir, { recursive: true })

  const readiness = {
    passed: true,
    passedChecks: 74,
    totalChecks: 74,
    acceptanceResults: [{ id: 'acceptance-shell' }],
    exitResults: [{ id: 'exit-phase0' }],
  }
  const receipt = {
    passed: true,
    commands: [{ id: 'typecheck' }, { id: 'lint' }, { id: 'phase0:push-handoff' }],
  }

  writeJson(join(outputDir, 'phase0-readiness.json'), readiness)
  writeJson(join(outputDir, 'verify-strict-receipt.json'), receipt)
  writeJson(join(visualOutputDir, 'shell-visual-manifest.json'), visualManifest)
  writeFileSync(join(visualOutputDir, 'shell-dark.png'), 'placeholder')
  writeFileSync(join(visualOutputDir, 'dark-titlebar.png'), 'placeholder')
  writeFileSync(join(visualOutputDir, 'shell-light.png'), 'placeholder')
  writeFileSync(join(visualOutputDir, 'light-titlebar.png'), 'placeholder')

  return {
    readiness,
    receipt,
    visualManifest,
    files: {
      'pro-electron-smoke/shell-dark.png': 'placeholder',
      'pro-electron-smoke/dark-titlebar.png': 'placeholder',
      'pro-electron-smoke/shell-light.png': 'placeholder',
      'pro-electron-smoke/light-titlebar.png': 'placeholder',
    },
  }
}

function writeCompareEvidence(appRoot: string, options?: { observedRunId?: number; downloadRunId?: number }) {
  const observedRunId = options?.observedRunId ?? 123
  const downloadRunId = options?.downloadRunId ?? 123
  const outputDir = join(appRoot, 'output', 'phase0-readiness')
  const artifactDir = join(outputDir, 'ci-artifacts', `run-${downloadRunId}`)
  const readinessArtifactDir = join(artifactDir, 'pro-phase0-readiness')
  const smokeArtifactDir = join(artifactDir, 'pro-electron-smoke')
  const evidence = createEvidencePayload(appRoot)

  mkdirSync(readinessArtifactDir, { recursive: true })
  mkdirSync(smokeArtifactDir, { recursive: true })
  writeJson(join(readinessArtifactDir, 'phase0-readiness.json'), evidence.readiness)
  writeJson(join(readinessArtifactDir, 'verify-strict-receipt.json'), evidence.receipt)
  writeJson(join(smokeArtifactDir, 'shell-visual-manifest.json'), evidence.visualManifest)

  for (const [relativePath, content] of Object.entries(evidence.files)) {
    writeFileSync(join(artifactDir, relativePath), content)
  }

  writeJson(join(outputDir, 'ci-artifacts', 'latest-download.json'), {
    runId: downloadRunId,
    branchName: 'main',
    artifactDir,
    artifactNames: ['pro-electron-smoke', 'pro-phase0-readiness'],
  })
  writeJson(join(outputDir, 'phase0-ci-observed-run.json'), {
    runId: observedRunId,
    branchName: 'main',
    artifactDir,
    artifactNames: ['pro-electron-smoke', 'pro-phase0-readiness'],
  })
}

afterEach(() => {
  while (fixtureRoots.length > 0) {
    const target = fixtureRoots.pop()
    if (target) {
      rmSync(target, { recursive: true, force: true })
    }
  }
})

describe('Phase 0 reporting scripts', () => {
  it('marks ci compare as pending until an observed run exists', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    writeJson(join(outputDir, 'phase0-ci-compare.json'), {
      passed: false,
      passedChecks: 0,
      totalChecks: 1,
    })
    writeJson(join(outputDir, 'phase0-ci-status.fixture.json'), {
      authOk: true,
      workflows: {
        workflows: [
          {
            id: 42,
            name: 'Pro Quality',
            state: 'active',
            html_url: 'https://example.com/workflows/42',
            path: '.github/workflows/pro-quality.yml',
          },
        ],
      },
      runs: [],
    })

    runNode(reportCiStatusScriptPath, appRoot, ['--ref', 'main'], {
      ...process.env,
      PHASE0_CI_STATUS_FIXTURE: join(outputDir, 'phase0-ci-status.fixture.json'),
    })

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-ci-status.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-ci-status.md'), 'utf8')

    expect(report.status).toBe('no-remote-runs-for-branch')
    expect(report.targetBranch).toBe('main')
    expect(report.compareReport.status).toBe('pending')
    expect(report.blockers).toContain('Remote workflow exists but no runs have been observed for branch main yet.')
    expect(markdown).toContain('- Result: PENDING')
  })

  it('reports phase0-complete when local readiness, observed CI, and compare all pass on a clean tracked branch', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot)
    initCleanRepoWithUpstream(repoRoot)

    writeJson(join(outputDir, 'phase0-readiness.json'), {
      passed: true,
      passedChecks: 74,
      totalChecks: 74,
    })
    writeJson(join(outputDir, 'phase0-ci-status.json'), {
      status: 'observed-run-confirmed',
      ready: true,
      targetBranch: 'main',
    })
    writeJson(join(outputDir, 'phase0-ci-compare.json'), {
      passed: true,
      passedChecks: 18,
      totalChecks: 18,
    })

    runNode(reportCloseoutScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-closeout.json'), 'utf8'))
    expect(report.status).toBe('phase0-complete')
    expect(report.readyForPhase1).toBe(true)
    expect(report.blockers).toEqual([])
    expect(report.gitSummary.branchName).toBe('main')
    expect(report.gitSummary.hasUpstream).toBe(true)
    expect(report.gitSummary.dirty).toBe(false)
    expect(report.gitIdentitySummary.userName).toBe('Codex Test')
    expect(report.gitIdentitySummary.userEmail).toBe('codex@example.com')
    expect(report.gitIdentitySummary.remoteMatchesExpectation).toBe(true)
  })

  it('blocks closeout when origin remote does not match iruhana/usan', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    initCleanRepoWithUpstream(repoRoot)
    execFileSync('git', ['remote', 'set-url', 'origin', 'https://github.com/example/usan-fork.git'], {
      cwd: repoRoot,
      stdio: 'ignore',
    })

    writeJson(join(outputDir, 'phase0-readiness.json'), {
      passed: true,
      passedChecks: 74,
      totalChecks: 74,
    })
    writeJson(join(outputDir, 'phase0-ci-status.json'), {
      status: 'observed-run-confirmed',
      ready: true,
      targetBranch: 'main',
    })
    writeJson(join(outputDir, 'phase0-ci-compare.json'), {
      passed: true,
      passedChecks: 18,
      totalChecks: 18,
    })

    runNode(reportCloseoutScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-closeout.json'), 'utf8'))
    expect(report.status).toBe('phase0-complete-with-local-blockers')
    expect(report.readyForPhase1).toBe(false)
    expect(report.gitIdentitySummary.remoteMatchesExpectation).toBe(false)
    expect(report.blockers).toContain('Origin remote points to example/usan-fork, expected iruhana/usan.')
    expect(report.nextSteps).toContain('Update origin to iruhana/usan before running the final Phase 0 push and CI observation.')
  })

  it('blocks closeout when critical publish targets are still untracked', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot, ['apps/pro/scripts/run-phase0-ci-observe.mjs'])
    initCleanRepoWithUpstream(repoRoot)
    writeFileSync(join(appRoot, 'scripts', 'run-phase0-ci-observe.mjs'), 'console.log("fixture")\n')

    writeJson(join(outputDir, 'phase0-readiness.json'), {
      passed: true,
      passedChecks: 74,
      totalChecks: 74,
    })
    writeJson(join(outputDir, 'phase0-ci-status.json'), {
      status: 'observed-run-confirmed',
      ready: true,
      targetBranch: 'main',
    })
    writeJson(join(outputDir, 'phase0-ci-compare.json'), {
      passed: true,
      passedChecks: 18,
      totalChecks: 18,
    })

    runNode(reportCloseoutScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-closeout.json'), 'utf8'))
    const publishTarget = report.publishTargets.find((target) => target.path === 'apps/pro/scripts/run-phase0-ci-observe.mjs')

    expect(report.status).toBe('phase0-complete-with-local-blockers')
    expect(report.blockers).toContain('Critical Phase 0 publish targets are still untracked.')
    expect(report.nextSteps).toContain('Stage the untracked publish targets before push: apps/pro/scripts/run-phase0-ci-observe.mjs')
    expect(publishTarget?.status).toBe('untracked')
    expect(report.stageCommand).toContain('apps/pro/scripts/run-phase0-ci-observe.mjs')
  })

  it('blocks closeout when a critical publish target is missing', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot, ['apps/pro/scripts/run-phase0-ci-observe.mjs'])
    initCleanRepoWithUpstream(repoRoot)

    writeJson(join(outputDir, 'phase0-readiness.json'), {
      passed: true,
      passedChecks: 74,
      totalChecks: 74,
    })
    writeJson(join(outputDir, 'phase0-ci-status.json'), {
      status: 'observed-run-confirmed',
      ready: true,
      targetBranch: 'main',
    })
    writeJson(join(outputDir, 'phase0-ci-compare.json'), {
      passed: true,
      passedChecks: 18,
      totalChecks: 18,
    })

    runNode(reportCloseoutScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-closeout.json'), 'utf8'))
    const missingTarget = report.publishTargets.find((target) => target.path === 'apps/pro/scripts/run-phase0-ci-observe.mjs')

    expect(report.status).toBe('phase0-complete-with-local-blockers')
    expect(report.blockers).toContain('Critical Phase 0 publish targets are missing from the worktree.')
    expect(report.nextSteps).toContain('Restore or recreate the missing publish targets before push: apps/pro/scripts/run-phase0-ci-observe.mjs')
    expect(missingTarget?.status).toBe('missing')
  })

  it('renders push handoff with both branch-scoped and existing-run observe commands', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      blockers: ['Remote repository does not yet contain .github/workflows/pro-quality.yml.'],
      gitSummary: {
        branchName: 'main',
        changedEntries: [
          { category: 'modified', path: 'apps/pro/package.json' },
          { category: 'untracked', path: '.github/workflows/pro-quality.yml' },
        ],
      },
      publishTargets: [
        { path: '.github/workflows/pro-quality.yml', status: 'untracked' },
      ],
      stageCommand: 'git -C "C:\\Users\\admin\\Projects\\usan" add -- ".github/workflows/pro-quality.yml"',
    })
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), {
      stageCommand: 'git -C "C:\\Users\\admin\\Projects\\usan" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"',
      commitCommand: 'git -C "C:\\Users\\admin\\Projects\\usan" commit -F "C:\\Users\\admin\\Projects\\usan\\apps\\pro\\output\\phase0-readiness\\phase0-commit-message.txt"',
    })

    runNode(reportPushHandoffScriptPath, appRoot)

    const markdown = readFileSync(join(outputDir, 'phase0-push-handoff.md'), 'utf8')
    expect(markdown).toContain('## Step 2')
    expect(markdown).toContain('## Step 3')
    expect(markdown).toContain('npm run phase0:simulate-publish')
    expect(markdown).toContain('npm run phase0:stage-scope -- --apply')
    expect(markdown).toContain('npm run phase0:publish-status')
    expect(markdown).toContain('npm run phase0:commit-dry-run')
    expect(markdown).toContain('npm run phase0:ci-observe -- --ref main')
    expect(markdown).toContain('npm run phase0:ci-observe -- --run-id <existing-run-id>')
    expect(markdown).toContain('[modified] apps/pro/package.json')
    expect(markdown).toContain('- Git user.name: unknown')
    expect(markdown).toContain('- Origin remote: unknown')
    expect(markdown).toContain('## Priority Publish Targets')
    expect(markdown).toContain('[untracked] .github/workflows/pro-quality.yml')
    expect(markdown).toContain('## Recommended Stage Command')
    expect(markdown).toContain('git -C "C:\\Users\\admin\\Projects\\usan" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"')
    expect(markdown).toContain('git -C "C:\\Users\\admin\\Projects\\usan" commit -F "C:\\Users\\admin\\Projects\\usan\\apps\\pro\\output\\phase0-readiness\\phase0-commit-message.txt"')
    expect(markdown).toContain('## Optional Step 10')
    expect(markdown).toContain('npm run phase0:push-script')
    expect(markdown).toContain('phase0-push-sequence.ps1')
    expect(markdown).toContain('## Optional Step 11')
    expect(markdown).toContain('npm run phase0:push-script-whatif')
    expect(markdown).toContain('phase0-push-script-whatif.md')
    expect(markdown).toContain('## Optional Step 12')
    expect(markdown).toContain('npm run phase0:bundle-evidence')
    expect(markdown).toContain('phase0-closeout-bundle')
    expect(markdown).toContain('## Optional Step 13')
    expect(markdown).toContain('npm run phase0:bundle-verify')
    expect(markdown).toContain('phase0-bundle-verify.md')
    expect(markdown).toContain('## Optional Step 14')
    expect(markdown).toContain('npm run phase0:publish-readiness')
    expect(markdown).toContain('phase0-publish-readiness.md')
  })

  it('renders a PowerShell push script for the standard phase0 publish flow', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')

    writeJson(join(outputDir, 'phase0-push-handoff.json'), {
      branchName: 'main',
    })
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), {
      commitMessagePath: 'C:\\Users\\admin\\Projects\\usan\\apps\\pro\\output\\phase0-readiness\\phase0-commit-message.txt',
    })

    runNode(reportPushScriptScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-push-script.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-push-script.md'), 'utf8')
    const powerShellScript = readFileSync(join(outputDir, 'phase0-push-sequence.ps1'), 'utf8')

    expect(report.status).toBe('phase0-push-script-ready')
    expect(report.branchName).toBe('main')
    expect(report.pushHandoffPath).toBe(join(outputDir, 'phase0-push-handoff.json'))
    expect(report.commitHandoffPath).toBe(join(outputDir, 'phase0-commit-handoff.json'))
    expect(markdown).toContain('powershell -ExecutionPolicy Bypass -File')
    expect(markdown).toContain('-WhatIf')
    expect(markdown).toContain('-ObserveRunId <run-id>')
    expect(markdown).toContain('-SkipEvidenceManifest -SkipBundleEvidence -SkipBundleVerify -SkipPublishReadiness')
    expect(powerShellScript).toContain("[CmdletBinding(SupportsShouldProcess=$true, ConfirmImpact='Medium')]")
    expect(powerShellScript).toContain('function Assert-Phase0ReportStatus {')
    expect(powerShellScript).toContain('$Phase0OutputDir = Join-Path $AppRoot \'output\\phase0-readiness\'')
    expect(powerShellScript).toContain('Command failed with exit code ${LASTEXITCODE}: $DisplayCommand')
    expect(powerShellScript).toContain('return $true')
    expect(powerShellScript).toContain('return $false')
    expect(powerShellScript).toContain('$StageExecuted = $false')
    expect(powerShellScript).toContain("'run', 'phase0:simulate-publish'")
    expect(powerShellScript).toContain("'run', 'phase0:stage-scope', '--', '--apply'")
    expect(powerShellScript).toContain("'run', 'phase0:commit-dry-run'")
    expect(powerShellScript).toContain("'run', 'phase0:evidence-manifest'")
    expect(powerShellScript).toContain("'run', 'phase0:bundle-evidence'")
    expect(powerShellScript).toContain("'run', 'phase0:bundle-verify'")
    expect(powerShellScript).toContain("'run', 'phase0:publish-readiness'")
    expect(powerShellScript).toContain("$publishStatusAllowed = if ($StageExecuted -or $SkipStage)")
    expect(powerShellScript).toContain("$commitDryRunAllowed = if ($StageExecuted -or $SkipStage)")
    expect(powerShellScript).toContain("$publishReadinessAllowed = if ($StageExecuted -or $SkipStage)")
    expect(powerShellScript).toContain("Assert-Phase0ReportStatus -ReportPath $SimulatePublishReportPath")
    expect(powerShellScript).toContain("Assert-Phase0ReportStatus -ReportPath $PublishStatusReportPath")
    expect(powerShellScript).toContain("Assert-Phase0ReportStatus -ReportPath $CommitDryRunReportPath")
    expect(powerShellScript).toContain("Assert-Phase0ReportStatus -ReportPath $EvidenceManifestReportPath")
    expect(powerShellScript).toContain("Assert-Phase0ReportStatus -ReportPath $BundleEvidenceReportPath")
    expect(powerShellScript).toContain("Assert-Phase0ReportStatus -ReportPath $BundleVerifyReportPath")
    expect(powerShellScript).toContain("Assert-Phase0ReportStatus -ReportPath $PublishReadinessReportPath")
    expect(powerShellScript).toContain("'-C', $RepoRoot, 'commit', '-F', $CommitMessagePath")
    expect(powerShellScript).toContain("@('run', 'phase0:ci-observe', '--', '--run-id', $ObserveRunId)")
    expect(powerShellScript).toContain('if ($ObserveExecuted) {')
  })

  it('records a successful PowerShell WhatIf run as phase0 evidence', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    const fixturePath = join(outputDir, 'phase0-push-script-whatif.fixture.json')

    writeJson(join(outputDir, 'phase0-push-script.json'), { status: 'phase0-push-script-ready' })
    writeFileSync(join(outputDir, 'phase0-push-sequence.ps1'), 'Write-Host "phase0"\n')
    writeJson(fixturePath, {
      exitCode: 0,
      stdout: [
        '>> npm.cmd run phase0:simulate-publish',
        '>> npm.cmd run phase0:evidence-manifest',
        '>> npm.cmd run phase0:bundle-evidence',
        '>> npm.cmd run phase0:bundle-verify',
        '>> npm.cmd run phase0:publish-readiness',
        '>> npm.cmd run phase0:closeout',
        'What if: Performing the operation "Stage Phase 0 scope" on target "C:\\Users\\admin\\Projects\\usan"',
      ].join('\n'),
      stderr: '',
    })

    runNode(reportPushScriptWhatIfScriptPath, appRoot, [], {
      ...process.env,
      PHASE0_PUSH_SCRIPT_WHATIF_FIXTURE: fixturePath,
    })

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-push-script-whatif.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-push-script-whatif.md'), 'utf8')
    const log = readFileSync(join(outputDir, 'phase0-push-script-whatif.log'), 'utf8')

    expect(report.status).toBe('phase0-push-script-whatif-ready')
    expect(report.exitCode).toBe(0)
    expect(report.checks.every((check) => check.passed)).toBe(true)
    expect(markdown).toContain('PowerShell WhatIf exit code')
    expect(markdown).toContain('phase0:bundle-verify')
    expect(log).toContain('What if:')
    expect(log).toContain('phase0:publish-readiness')
  })

  it('generates a push script that accepts clean-tree simulate publish status', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: { branchName: 'main' },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
    })
    writeJson(join(outputDir, 'phase0-push-handoff.json'), {
      branchName: 'main',
    })
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), {
      stageCommand: 'git -C "C:\\Users\\admin\\Projects\\usan" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"',
      commitCommand: 'git -C "C:\\Users\\admin\\Projects\\usan" commit -F "C:\\Users\\admin\\Projects\\usan\\apps\\pro\\output\\phase0-readiness\\phase0-commit-message.txt"',
      commitMessagePath: join(outputDir, 'phase0-commit-message.txt'),
    })
    writeFileSync(join(outputDir, 'phase0-commit-message.txt'), 'feat(pro): close out phase 0 hardening\n')

    runNode(reportPushScriptScriptPath, appRoot)

    const powerShellScript = readFileSync(join(outputDir, 'phase0-push-sequence.ps1'), 'utf8')
    expect(powerShellScript).toContain("'phase0-simulate-publish-ready', 'phase0-simulate-publish-clean-tree'")
  })

  it('bundles local phase0 evidence into a single payload directory', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    const visualDir = join(appRoot, 'output', 'playwright', 'electron-smoke')

    writeJson(join(outputDir, 'phase0-readiness.json'), { passed: true })
    writeFileSync(join(outputDir, 'phase0-readiness.md'), '# readiness\n')
    writeJson(join(outputDir, 'verify-strict-receipt.json'), { passed: true })
    writeFileSync(join(outputDir, 'verify-strict-receipt.md'), '# receipt\n')
    writeJson(join(outputDir, 'phase0-closeout.json'), { status: 'phase0-local-complete-remote-pending' })
    writeFileSync(join(outputDir, 'phase0-closeout.md'), '# closeout\n')
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-handoff.md'), '# commit handoff\n')
    writeFileSync(join(outputDir, 'phase0-commit-message.txt'), 'feat(pro): close out phase 0 hardening\n')
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-dry-run.md'), '# commit dry run\n')
    writeJson(join(outputDir, 'phase0-publish-status.json'), { status: 'phase0-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-publish-status.md'), '# publish status\n')
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), { status: 'phase0-simulate-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-simulate-publish.md'), '# simulate publish\n')
    writeJson(join(outputDir, 'phase0-stage-scope.json'), { status: 'phase0-stage-scope-ready' })
    writeFileSync(join(outputDir, 'phase0-stage-scope.md'), '# stage scope\n')
    writeJson(join(outputDir, 'phase0-push-handoff.json'), { status: 'phase0-push-handoff-ready' })
    writeFileSync(join(outputDir, 'phase0-push-handoff.md'), '# push handoff\n')
    writeJson(join(outputDir, 'phase0-push-script.json'), { status: 'phase0-push-script-ready' })
    writeFileSync(join(outputDir, 'phase0-push-script.md'), '# push script\n')
    writeFileSync(join(outputDir, 'phase0-push-sequence.ps1'), 'Write-Host "phase0"\n')
    writePushScriptWhatIfEvidence(outputDir)
    writeJson(join(outputDir, 'phase0-publish-readiness.json'), { status: 'phase0-publish-prepared-local-only' })
    writeFileSync(join(outputDir, 'phase0-publish-readiness.md'), '# publish readiness\n')
    writeJson(join(outputDir, 'phase0-evidence-manifest.json'), { status: 'phase0-evidence-manifest-ready' })
    writeFileSync(join(outputDir, 'phase0-evidence-manifest.md'), '# evidence manifest\n')
    writeJson(join(outputDir, 'phase0-ci-status.json'), { status: 'remote-workflow-missing' })
    writeFileSync(join(outputDir, 'phase0-ci-status.md'), '# ci status\n')
    writeJson(join(outputDir, 'phase0-ci-compare.json'), { passed: false })
    writeFileSync(join(outputDir, 'phase0-ci-compare.md'), '# ci compare\n')
    writeJson(join(outputDir, 'phase0-ci-observed-run.json'), { runId: 123 })
    mkdirSync(visualDir, { recursive: true })
    writeJson(join(visualDir, 'shell-visual-manifest.json'), { themes: { dark: {}, light: {} } })
    writeFileSync(join(visualDir, 'shell-dark.png'), 'dark')

    runNode(reportBundleEvidenceScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-bundle-evidence.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-bundle-evidence.md'), 'utf8')
    const manifest = JSON.parse(readFileSync(join(outputDir, 'phase0-closeout-bundle', 'bundle-manifest.json'), 'utf8'))

    expect(report.status).toBe('phase0-bundle-ready')
    expect(report.missingFiles).toEqual([])
    expect(report.missingDirectories).toEqual([])
    expect(report.includedFiles.some((entry) => entry.relativePath === 'phase0-push-sequence.ps1')).toBe(true)
    expect(report.includedFiles.some((entry) => entry.relativePath === 'phase0-publish-readiness.md')).toBe(true)
    expect(report.includedFiles.some((entry) => entry.relativePath === 'phase0-evidence-manifest.json')).toBe(true)
    expect(report.includedDirectories.some((entry) => entry.id === 'electron-smoke')).toBe(true)
    expect(markdown).toContain('## Included Files')
    expect(markdown).toContain('phase0-push-sequence.ps1')
    expect(markdown).toContain('phase0-publish-readiness.md')
    expect(markdown).toContain('phase0-evidence-manifest.json')
    expect(manifest.status).toBe('phase0-bundle-ready')
    expect(manifest.fileCount).toBe(report.includedFiles.length)
    expect(readFileSync(join(outputDir, 'phase0-closeout-bundle', 'payload', 'phase0-push-sequence.ps1'), 'utf8')).toContain('Write-Host')
    expect(readFileSync(join(outputDir, 'phase0-closeout-bundle', 'payload', 'playwright', 'electron-smoke', 'shell-dark.png'), 'utf8')).toBe('dark')
  })

  it('marks observed-run evidence as pending while remote confirmation is still pending', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    const visualDir = join(appRoot, 'output', 'playwright', 'electron-smoke')

    writeJson(join(outputDir, 'phase0-readiness.json'), { passed: true })
    writeFileSync(join(outputDir, 'phase0-readiness.md'), '# readiness\n')
    writeJson(join(outputDir, 'verify-strict-receipt.json'), { passed: true })
    writeFileSync(join(outputDir, 'verify-strict-receipt.md'), '# receipt\n')
    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      remoteConfirmationReady: false,
    })
    writeFileSync(join(outputDir, 'phase0-closeout.md'), '# closeout\n')
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-handoff.md'), '# commit handoff\n')
    writeFileSync(join(outputDir, 'phase0-commit-message.txt'), 'feat(pro): close out phase 0 hardening\n')
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-dry-run.md'), '# commit dry run\n')
    writeJson(join(outputDir, 'phase0-publish-status.json'), { status: 'phase0-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-publish-status.md'), '# publish status\n')
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), { status: 'phase0-simulate-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-simulate-publish.md'), '# simulate publish\n')
    writeJson(join(outputDir, 'phase0-stage-scope.json'), { status: 'phase0-stage-scope-ready' })
    writeFileSync(join(outputDir, 'phase0-stage-scope.md'), '# stage scope\n')
    writeJson(join(outputDir, 'phase0-push-handoff.json'), { status: 'phase0-push-handoff-ready' })
    writeFileSync(join(outputDir, 'phase0-push-handoff.md'), '# push handoff\n')
    writeJson(join(outputDir, 'phase0-push-script.json'), { status: 'phase0-push-script-ready' })
    writeFileSync(join(outputDir, 'phase0-push-script.md'), '# push script\n')
    writeFileSync(join(outputDir, 'phase0-push-sequence.ps1'), 'Write-Host "phase0"\n')
    writePushScriptWhatIfEvidence(outputDir)
    writeJson(join(outputDir, 'phase0-publish-readiness.json'), { status: 'phase0-publish-prepared-local-only' })
    writeFileSync(join(outputDir, 'phase0-publish-readiness.md'), '# publish readiness\n')
    writeJson(join(outputDir, 'phase0-evidence-manifest.json'), { status: 'phase0-evidence-manifest-local-ready-remote-pending' })
    writeFileSync(join(outputDir, 'phase0-evidence-manifest.md'), '# evidence manifest\n')
    writeJson(join(outputDir, 'phase0-ci-status.json'), { status: 'remote-workflow-missing', ready: false })
    writeFileSync(join(outputDir, 'phase0-ci-status.md'), '# ci status\n')
    writeJson(join(outputDir, 'phase0-ci-compare.json'), { passed: false })
    writeFileSync(join(outputDir, 'phase0-ci-compare.md'), '# ci compare\n')
    mkdirSync(visualDir, { recursive: true })
    writeJson(join(visualDir, 'shell-visual-manifest.json'), { themes: { dark: {}, light: {} } })
    writeFileSync(join(visualDir, 'shell-dark.png'), 'dark')

    runNode(reportBundleEvidenceScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-bundle-evidence.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-bundle-evidence.md'), 'utf8')
    const manifest = JSON.parse(readFileSync(join(outputDir, 'phase0-closeout-bundle', 'bundle-manifest.json'), 'utf8'))

    expect(report.status).toBe('phase0-bundle-local-ready-remote-pending')
    expect(report.missingFiles).toEqual([])
    expect(report.pendingFiles).toEqual(['phase0-ci-observed-run.json'])
    expect(report.blockers).toEqual([])
    expect(report.nextSteps.some((step) => step.includes('remote Phase 0 observation run'))).toBe(true)
    expect(markdown).toContain('## Pending Files')
    expect(markdown).toContain('phase0-ci-observed-run.json')
    expect(manifest.status).toBe('phase0-bundle-local-ready-remote-pending')
    expect(manifest.pendingFileCount).toBe(1)
  })

  it('treats missing ci status and compare reports as pending remote evidence when bundling a clean local-only closeout', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    const visualDir = join(appRoot, 'output', 'playwright', 'electron-smoke')

    writeJson(join(outputDir, 'phase0-readiness.json'), { passed: true })
    writeFileSync(join(outputDir, 'phase0-readiness.md'), '# readiness\n')
    writeJson(join(outputDir, 'verify-strict-receipt.json'), { passed: true })
    writeFileSync(join(outputDir, 'verify-strict-receipt.md'), '# receipt\n')
    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      remoteConfirmationReady: false,
    })
    writeFileSync(join(outputDir, 'phase0-closeout.md'), '# closeout\n')
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-handoff.md'), '# commit handoff\n')
    writeFileSync(join(outputDir, 'phase0-commit-message.txt'), 'feat(pro): close out phase 0 hardening\n')
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-dry-run.md'), '# commit dry run\n')
    writeJson(join(outputDir, 'phase0-publish-status.json'), { status: 'phase0-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-publish-status.md'), '# publish status\n')
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), { status: 'phase0-simulate-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-simulate-publish.md'), '# simulate publish\n')
    writeJson(join(outputDir, 'phase0-stage-scope.json'), { status: 'phase0-stage-scope-ready' })
    writeFileSync(join(outputDir, 'phase0-stage-scope.md'), '# stage scope\n')
    writeJson(join(outputDir, 'phase0-push-handoff.json'), { status: 'phase0-push-handoff-ready' })
    writeFileSync(join(outputDir, 'phase0-push-handoff.md'), '# push handoff\n')
    writeJson(join(outputDir, 'phase0-push-script.json'), { status: 'phase0-push-script-ready' })
    writeFileSync(join(outputDir, 'phase0-push-script.md'), '# push script\n')
    writeFileSync(join(outputDir, 'phase0-push-sequence.ps1'), 'Write-Host "phase0"\n')
    writePushScriptWhatIfEvidence(outputDir)
    writeJson(join(outputDir, 'phase0-publish-readiness.json'), { status: 'phase0-publish-prepared-local-only' })
    writeFileSync(join(outputDir, 'phase0-publish-readiness.md'), '# publish readiness\n')
    writeJson(join(outputDir, 'phase0-evidence-manifest.json'), { status: 'phase0-evidence-manifest-local-ready-remote-pending' })
    writeFileSync(join(outputDir, 'phase0-evidence-manifest.md'), '# evidence manifest\n')
    mkdirSync(visualDir, { recursive: true })
    writeJson(join(visualDir, 'shell-visual-manifest.json'), { themes: { dark: {}, light: {} } })
    writeFileSync(join(visualDir, 'shell-dark.png'), 'dark')

    runNode(reportBundleEvidenceScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-bundle-evidence.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-bundle-evidence.md'), 'utf8')

    expect(report.status).toBe('phase0-bundle-local-ready-remote-pending')
    expect(report.missingFiles).toEqual([])
    expect(report.pendingFiles).toEqual(remoteObservationEvidenceFiles)
    expect(report.includedFiles.some((entry) => entry.relativePath === 'phase0-ci-status.json')).toBe(false)
    expect(markdown).toContain('phase0-ci-status.json')
    expect(markdown).toContain('phase0-ci-compare.json')
    expect(markdown).toContain('phase0-ci-observed-run.json')
  })

  it('generates an evidence manifest with hashes for readiness and visual outputs', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    const visualDir = join(appRoot, 'output', 'playwright', 'electron-smoke')

    writeJson(join(outputDir, 'phase0-readiness.json'), { passed: true })
    writeFileSync(join(outputDir, 'phase0-readiness.md'), '# readiness\n')
    writeJson(join(outputDir, 'verify-strict-receipt.json'), { passed: true })
    writeFileSync(join(outputDir, 'verify-strict-receipt.md'), '# receipt\n')
    writeJson(join(outputDir, 'phase0-closeout.json'), { status: 'phase0-local-complete-remote-pending' })
    writeFileSync(join(outputDir, 'phase0-closeout.md'), '# closeout\n')
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-handoff.md'), '# commit handoff\n')
    writeFileSync(join(outputDir, 'phase0-commit-message.txt'), 'feat(pro): close out phase 0 hardening\n')
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-dry-run.md'), '# commit dry run\n')
    writeJson(join(outputDir, 'phase0-publish-status.json'), { status: 'phase0-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-publish-status.md'), '# publish status\n')
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), { status: 'phase0-simulate-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-simulate-publish.md'), '# simulate publish\n')
    writeJson(join(outputDir, 'phase0-stage-scope.json'), { status: 'phase0-stage-scope-ready' })
    writeFileSync(join(outputDir, 'phase0-stage-scope.md'), '# stage scope\n')
    writeJson(join(outputDir, 'phase0-push-handoff.json'), { status: 'phase0-push-handoff-ready' })
    writeFileSync(join(outputDir, 'phase0-push-handoff.md'), '# push handoff\n')
    writeJson(join(outputDir, 'phase0-push-script.json'), { status: 'phase0-push-script-ready' })
    writeFileSync(join(outputDir, 'phase0-push-script.md'), '# push script\n')
    writeFileSync(join(outputDir, 'phase0-push-sequence.ps1'), 'Write-Host "phase0"\n')
    writePushScriptWhatIfEvidence(outputDir)
    writeJson(join(outputDir, 'phase0-publish-readiness.json'), { status: 'phase0-publish-prepared-local-only' })
    writeFileSync(join(outputDir, 'phase0-publish-readiness.md'), '# publish readiness\n')
    writeJson(join(outputDir, 'phase0-ci-status.json'), { status: 'remote-workflow-missing', ready: false })
    writeFileSync(join(outputDir, 'phase0-ci-status.md'), '# ci status\n')
    writeJson(join(outputDir, 'phase0-ci-compare.json'), { passed: false })
    writeFileSync(join(outputDir, 'phase0-ci-compare.md'), '# ci compare\n')
    mkdirSync(visualDir, { recursive: true })
    writeJson(join(visualDir, 'shell-visual-manifest.json'), { themes: { dark: {}, light: {} } })
    writeFileSync(join(visualDir, 'shell-dark.png'), 'dark')

    runNode(reportEvidenceManifestScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-evidence-manifest.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-evidence-manifest.md'), 'utf8')

    expect(report.status).toBe('phase0-evidence-manifest-local-ready-remote-pending')
    expect(report.pendingFiles).toEqual(['phase0-ci-observed-run.json'])
    expect(report.evidenceFiles.some((entry) => entry.relativePath === 'output/phase0-readiness/phase0-readiness.json')).toBe(true)
    expect(report.visualFiles.some((entry) => entry.relativePath === 'output/playwright/electron-smoke/shell-dark.png')).toBe(true)
    expect(markdown).toContain('## Evidence Files')
    expect(markdown).toContain('## Visual Files')
  })

  it('treats missing ci status and compare reports as pending remote evidence in a clean local-only evidence manifest', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    const visualDir = join(appRoot, 'output', 'playwright', 'electron-smoke')

    writeJson(join(outputDir, 'phase0-readiness.json'), { passed: true })
    writeFileSync(join(outputDir, 'phase0-readiness.md'), '# readiness\n')
    writeJson(join(outputDir, 'verify-strict-receipt.json'), { passed: true })
    writeFileSync(join(outputDir, 'verify-strict-receipt.md'), '# receipt\n')
    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      remoteConfirmationReady: false,
    })
    writeFileSync(join(outputDir, 'phase0-closeout.md'), '# closeout\n')
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-handoff.md'), '# commit handoff\n')
    writeFileSync(join(outputDir, 'phase0-commit-message.txt'), 'feat(pro): close out phase 0 hardening\n')
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-dry-run.md'), '# commit dry run\n')
    writeJson(join(outputDir, 'phase0-publish-status.json'), { status: 'phase0-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-publish-status.md'), '# publish status\n')
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), { status: 'phase0-simulate-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-simulate-publish.md'), '# simulate publish\n')
    writeJson(join(outputDir, 'phase0-stage-scope.json'), { status: 'phase0-stage-scope-ready' })
    writeFileSync(join(outputDir, 'phase0-stage-scope.md'), '# stage scope\n')
    writeJson(join(outputDir, 'phase0-push-handoff.json'), { status: 'phase0-push-handoff-ready' })
    writeFileSync(join(outputDir, 'phase0-push-handoff.md'), '# push handoff\n')
    writeJson(join(outputDir, 'phase0-push-script.json'), { status: 'phase0-push-script-ready' })
    writeFileSync(join(outputDir, 'phase0-push-script.md'), '# push script\n')
    writeFileSync(join(outputDir, 'phase0-push-sequence.ps1'), 'Write-Host "phase0"\n')
    writePushScriptWhatIfEvidence(outputDir)
    writeJson(join(outputDir, 'phase0-publish-readiness.json'), { status: 'phase0-publish-prepared-local-only' })
    writeFileSync(join(outputDir, 'phase0-publish-readiness.md'), '# publish readiness\n')
    mkdirSync(visualDir, { recursive: true })
    writeJson(join(visualDir, 'shell-visual-manifest.json'), { themes: { dark: {}, light: {} } })
    writeFileSync(join(visualDir, 'shell-dark.png'), 'dark')

    runNode(reportEvidenceManifestScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-evidence-manifest.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-evidence-manifest.md'), 'utf8')

    expect(report.status).toBe('phase0-evidence-manifest-local-ready-remote-pending')
    expect(report.missingRequiredFiles).toEqual([])
    expect(report.pendingFiles).toEqual(remoteObservationEvidenceFiles)
    expect(report.evidenceFiles.some((entry) => entry.relativePath === 'output/phase0-readiness/phase0-ci-status.json')).toBe(false)
    expect(markdown).toContain('phase0-ci-status.json')
    expect(markdown).toContain('phase0-ci-compare.json')
    expect(markdown).toContain('phase0-ci-observed-run.json')
  })

  it('verifies that the bundled payload matches the local evidence manifest in a local-only closeout', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    const visualDir = join(appRoot, 'output', 'playwright', 'electron-smoke')

    writeJson(join(outputDir, 'phase0-readiness.json'), { passed: true })
    writeFileSync(join(outputDir, 'phase0-readiness.md'), '# readiness\n')
    writeJson(join(outputDir, 'verify-strict-receipt.json'), { passed: true })
    writeFileSync(join(outputDir, 'verify-strict-receipt.md'), '# receipt\n')
    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      remoteConfirmationReady: false,
    })
    writeFileSync(join(outputDir, 'phase0-closeout.md'), '# closeout\n')
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-handoff.md'), '# commit handoff\n')
    writeFileSync(join(outputDir, 'phase0-commit-message.txt'), 'feat(pro): close out phase 0 hardening\n')
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-dry-run.md'), '# commit dry run\n')
    writeJson(join(outputDir, 'phase0-publish-status.json'), { status: 'phase0-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-publish-status.md'), '# publish status\n')
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), { status: 'phase0-simulate-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-simulate-publish.md'), '# simulate publish\n')
    writeJson(join(outputDir, 'phase0-stage-scope.json'), { status: 'phase0-stage-scope-ready' })
    writeFileSync(join(outputDir, 'phase0-stage-scope.md'), '# stage scope\n')
    writeJson(join(outputDir, 'phase0-push-handoff.json'), { status: 'phase0-push-handoff-ready' })
    writeFileSync(join(outputDir, 'phase0-push-handoff.md'), '# push handoff\n')
    writeJson(join(outputDir, 'phase0-push-script.json'), { status: 'phase0-push-script-ready' })
    writeFileSync(join(outputDir, 'phase0-push-script.md'), '# push script\n')
    writeFileSync(join(outputDir, 'phase0-push-sequence.ps1'), 'Write-Host "phase0"\n')
    writePushScriptWhatIfEvidence(outputDir)
    writeJson(join(outputDir, 'phase0-publish-readiness.json'), { status: 'phase0-publish-prepared-local-only' })
    writeFileSync(join(outputDir, 'phase0-publish-readiness.md'), '# publish readiness\n')
    mkdirSync(visualDir, { recursive: true })
    writeJson(join(visualDir, 'shell-visual-manifest.json'), { themes: { dark: {}, light: {} } })
    writeFileSync(join(visualDir, 'shell-dark.png'), 'dark')

    runNode(reportEvidenceManifestScriptPath, appRoot)
    runNode(reportBundleEvidenceScriptPath, appRoot)
    runNode(reportBundleVerifyScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-bundle-verify.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-bundle-verify.md'), 'utf8')

    expect(report.status).toBe('phase0-bundle-verify-local-ready-remote-pending')
    expect(report.missingBundleFiles).toEqual([])
    expect(report.mismatchedFiles).toEqual([])
    expect(report.pendingFiles).toEqual(remoteObservationEvidenceFiles)
    expect(report.verifiedFiles.some((file) => file.sourceRelativePath === 'output/phase0-readiness/phase0-readiness.json')).toBe(true)
    expect(report.verifiedFiles.some((file) => file.sourceRelativePath === 'output/playwright/electron-smoke/shell-dark.png')).toBe(true)
    expect(markdown).toContain('## Manifest Checks')
    expect(markdown).toContain('## Verified Files')
  })

  it('fails bundle verification when a copied payload file is tampered with', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    const visualDir = join(appRoot, 'output', 'playwright', 'electron-smoke')

    writeJson(join(outputDir, 'phase0-readiness.json'), { passed: true })
    writeFileSync(join(outputDir, 'phase0-readiness.md'), '# readiness\n')
    writeJson(join(outputDir, 'verify-strict-receipt.json'), { passed: true })
    writeFileSync(join(outputDir, 'verify-strict-receipt.md'), '# receipt\n')
    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      remoteConfirmationReady: false,
    })
    writeFileSync(join(outputDir, 'phase0-closeout.md'), '# closeout\n')
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-handoff.md'), '# commit handoff\n')
    writeFileSync(join(outputDir, 'phase0-commit-message.txt'), 'feat(pro): close out phase 0 hardening\n')
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), { status: 'phase0-commit-ready' })
    writeFileSync(join(outputDir, 'phase0-commit-dry-run.md'), '# commit dry run\n')
    writeJson(join(outputDir, 'phase0-publish-status.json'), { status: 'phase0-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-publish-status.md'), '# publish status\n')
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), { status: 'phase0-simulate-publish-ready' })
    writeFileSync(join(outputDir, 'phase0-simulate-publish.md'), '# simulate publish\n')
    writeJson(join(outputDir, 'phase0-stage-scope.json'), { status: 'phase0-stage-scope-ready' })
    writeFileSync(join(outputDir, 'phase0-stage-scope.md'), '# stage scope\n')
    writeJson(join(outputDir, 'phase0-push-handoff.json'), { status: 'phase0-push-handoff-ready' })
    writeFileSync(join(outputDir, 'phase0-push-handoff.md'), '# push handoff\n')
    writeJson(join(outputDir, 'phase0-push-script.json'), { status: 'phase0-push-script-ready' })
    writeFileSync(join(outputDir, 'phase0-push-script.md'), '# push script\n')
    writeFileSync(join(outputDir, 'phase0-push-sequence.ps1'), 'Write-Host "phase0"\n')
    writePushScriptWhatIfEvidence(outputDir)
    writeJson(join(outputDir, 'phase0-publish-readiness.json'), { status: 'phase0-publish-prepared-local-only' })
    writeFileSync(join(outputDir, 'phase0-publish-readiness.md'), '# publish readiness\n')
    mkdirSync(visualDir, { recursive: true })
    writeJson(join(visualDir, 'shell-visual-manifest.json'), { themes: { dark: {}, light: {} } })
    writeFileSync(join(visualDir, 'shell-dark.png'), 'dark')

    runNode(reportEvidenceManifestScriptPath, appRoot)
    runNode(reportBundleEvidenceScriptPath, appRoot)
    writeFileSync(join(outputDir, 'phase0-closeout-bundle', 'payload', 'phase0-readiness.json'), 'tampered')
    runNode(reportBundleVerifyScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-bundle-verify.json'), 'utf8'))

    expect(report.status).toBe('phase0-bundle-verify-incomplete')
    expect(report.blockers).toContain('Some copied bundle payload files do not match the local evidence hashes.')
    expect(report.mismatchedFiles.some((file) => file.bundleRelativePath === 'phase0-readiness.json')).toBe(true)
  })

  it('summarizes publish readiness as local-only prepared while remote observation is still pending', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      localReadinessPassed: true,
      remoteConfirmationReady: false,
      gitSummary: {
        branchName: 'main',
        hasUpstream: true,
      },
    })
    writeJson(join(outputDir, 'verify-strict-receipt.json'), {
      passed: true,
      commands: [
        { id: 'typecheck', startedAt: '2026-03-20T00:00:00.000Z' },
        { id: 'phase0:simulate-publish', startedAt: '2026-03-20T00:00:01.000Z' },
        { id: 'phase0:publish-status', startedAt: '2026-03-20T00:00:02.000Z' },
        { id: 'phase0:commit-dry-run', startedAt: '2026-03-20T00:00:03.000Z' },
        { id: 'phase0:push-script-whatif', startedAt: '2026-03-20T00:00:03.750Z' },
        { id: 'phase0:evidence-manifest', startedAt: '2026-03-20T00:00:04.000Z' },
        { id: 'phase0:bundle-evidence', startedAt: '2026-03-20T00:00:05.000Z' },
        { id: 'phase0:bundle-verify', startedAt: '2026-03-20T00:00:06.000Z' },
        { id: 'phase0:publish-readiness', startedAt: '2026-03-20T00:00:07.000Z' },
      ],
    })
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), {
      generatedAt: '2026-03-20T00:00:01.500Z',
      status: 'phase0-simulate-publish-ready',
      simulatedReady: true,
      simulatedStagedEntries: [{ path: 'ISSUES.md' }],
    })
    writeJson(join(outputDir, 'phase0-publish-status.json'), {
      generatedAt: '2026-03-20T00:00:02.500Z',
      status: 'phase0-publish-not-ready',
      readyToCommit: false,
      stagedScopedEntries: [],
      unstagedScopedEntries: [{ path: 'apps/pro/package.json' }],
      untrackedScopedEntries: [{ path: '.github/workflows/pro-quality.yml' }],
      stageCommand: 'git -C "C:\\Users\\admin\\Projects\\usan" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"',
    })
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), {
      generatedAt: '2026-03-20T00:00:03.500Z',
      status: 'phase0-commit-not-ready',
      readyToCommit: false,
      nextSteps: ['Stage the standard Phase 0 scope and ensure the commit message file exists before retrying the dry run.'],
    })
    writeJson(join(outputDir, 'phase0-evidence-manifest.json'), {
      generatedAt: '2026-03-20T00:00:04.500Z',
      status: 'phase0-evidence-manifest-local-ready-remote-pending',
    })
    writeJson(join(outputDir, 'phase0-bundle-evidence.json'), {
      generatedAt: '2026-03-20T00:00:05.500Z',
      status: 'phase0-bundle-local-ready-remote-pending',
      nextSteps: ['Complete one successful remote Phase 0 observation run to populate the pending remote evidence files.'],
    })
    writeJson(join(outputDir, 'phase0-bundle-verify.json'), {
      generatedAt: '2026-03-20T00:00:06.500Z',
      status: 'phase0-bundle-verify-local-ready-remote-pending',
      nextSteps: ['Complete one successful remote Phase 0 observation run to replace the pending remote bundle evidence.'],
    })
    writePushScriptWhatIfEvidence(outputDir)

    runNode(reportPublishReadinessScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-publish-readiness.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-publish-readiness.md'), 'utf8')

    expect(report.status).toBe('phase0-publish-prepared-local-only')
    expect(report.readyToStage).toBe(true)
    expect(report.readyToCommitNow).toBe(false)
    expect(report.readyToObserveNow).toBe(false)
    expect(report.remoteConfirmationReady).toBe(false)
    expect(report.blockers).toContain('Real git index is not staged for commit yet.')
    expect(report.nextSteps.some((step) => step.includes('Push the Phase 0 scope'))).toBe(true)
    expect(markdown).toContain('## Checks')
    expect(markdown).toContain('Simulated publish path')
    expect(markdown).toContain('Remote confirmation')
  })

  it('blocks publish readiness when verify strict receipt misses publish preflight coverage', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      localReadinessPassed: true,
      remoteConfirmationReady: false,
      gitSummary: {
        branchName: 'main',
        hasUpstream: true,
      },
    })
    writeJson(join(outputDir, 'verify-strict-receipt.json'), {
      passed: true,
      commands: [
        { id: 'typecheck', startedAt: '2026-03-20T00:00:00.000Z' },
        { id: 'phase0:simulate-publish', startedAt: '2026-03-20T00:00:01.000Z' },
        { id: 'phase0:evidence-manifest', startedAt: '2026-03-20T00:00:04.000Z' },
        { id: 'phase0:bundle-evidence', startedAt: '2026-03-20T00:00:05.000Z' },
        { id: 'phase0:bundle-verify', startedAt: '2026-03-20T00:00:06.000Z' },
        { id: 'phase0:publish-readiness', startedAt: '2026-03-20T00:00:07.000Z' },
      ],
    })
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), {
      generatedAt: '2026-03-20T00:00:01.500Z',
      status: 'phase0-simulate-publish-ready',
      simulatedReady: true,
      simulatedStagedEntries: [{ path: 'ISSUES.md' }],
    })
    writeJson(join(outputDir, 'phase0-publish-status.json'), {
      generatedAt: '2026-03-20T00:00:02.500Z',
      status: 'phase0-publish-not-ready',
      readyToCommit: false,
      stagedScopedEntries: [],
      unstagedScopedEntries: [{ path: 'apps/pro/package.json' }],
      untrackedScopedEntries: [{ path: '.github/workflows/pro-quality.yml' }],
      stageCommand: 'git -C "C:\\Users\\admin\\Projects\\usan" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"',
    })
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), {
      generatedAt: '2026-03-20T00:00:03.500Z',
      status: 'phase0-commit-not-ready',
      readyToCommit: false,
      nextSteps: ['Stage the standard Phase 0 scope and ensure the commit message file exists before retrying the dry run.'],
    })
    writeJson(join(outputDir, 'phase0-evidence-manifest.json'), {
      generatedAt: '2026-03-20T00:00:04.500Z',
      status: 'phase0-evidence-manifest-local-ready-remote-pending',
    })
    writeJson(join(outputDir, 'phase0-bundle-evidence.json'), {
      generatedAt: '2026-03-20T00:00:05.500Z',
      status: 'phase0-bundle-local-ready-remote-pending',
      nextSteps: ['Complete one successful remote Phase 0 observation run to populate the pending remote evidence files.'],
    })
    writeJson(join(outputDir, 'phase0-bundle-verify.json'), {
      generatedAt: '2026-03-20T00:00:06.500Z',
      status: 'phase0-bundle-verify-local-ready-remote-pending',
      nextSteps: ['Complete one successful remote Phase 0 observation run to replace the pending remote bundle evidence.'],
    })
    writePushScriptWhatIfEvidence(outputDir)

    runNode(reportPublishReadinessScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-publish-readiness.json'), 'utf8'))
    const coverageCheck = report.checks.find((check) => check.id === 'strict-receipt-coverage')

    expect(report.status).toBe('phase0-publish-readiness-incomplete')
    expect(report.blockers).toContain('Strict receipt does not include the full publish preflight coverage yet.')
    expect(coverageCheck?.passed).toBe(false)
    expect(coverageCheck?.detail).toContain('phase0:publish-status')
    expect(report.evidencePaths).toContain(join(outputDir, 'verify-strict-receipt.json'))
  })

  it('blocks publish readiness when preflight reports predate the strict receipt steps', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      localReadinessPassed: true,
      remoteConfirmationReady: false,
      gitSummary: {
        branchName: 'main',
        hasUpstream: true,
      },
    })
    writeJson(join(outputDir, 'verify-strict-receipt.json'), {
      passed: true,
      commands: [
        { id: 'phase0:simulate-publish', startedAt: '2026-03-20T00:00:05.000Z' },
        { id: 'phase0:publish-status', startedAt: '2026-03-20T00:00:06.000Z' },
        { id: 'phase0:commit-dry-run', startedAt: '2026-03-20T00:00:07.000Z' },
        { id: 'phase0:evidence-manifest', startedAt: '2026-03-20T00:00:08.000Z' },
        { id: 'phase0:bundle-evidence', startedAt: '2026-03-20T00:00:09.000Z' },
        { id: 'phase0:bundle-verify', startedAt: '2026-03-20T00:00:10.000Z' },
      ],
    })
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), {
      generatedAt: '2026-03-20T00:00:01.500Z',
      status: 'phase0-simulate-publish-ready',
      simulatedReady: true,
      simulatedStagedEntries: [{ path: 'ISSUES.md' }],
    })
    writeJson(join(outputDir, 'phase0-publish-status.json'), {
      generatedAt: '2026-03-20T00:00:02.500Z',
      status: 'phase0-publish-not-ready',
      readyToCommit: false,
      stagedScopedEntries: [],
      unstagedScopedEntries: [{ path: 'apps/pro/package.json' }],
      untrackedScopedEntries: [{ path: '.github/workflows/pro-quality.yml' }],
      stageCommand: 'git -C "C:\\Users\\admin\\Projects\\usan" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"',
    })
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), {
      generatedAt: '2026-03-20T00:00:03.500Z',
      status: 'phase0-commit-not-ready',
      readyToCommit: false,
      nextSteps: ['Stage the standard Phase 0 scope and ensure the commit message file exists before retrying the dry run.'],
    })
    writeJson(join(outputDir, 'phase0-evidence-manifest.json'), {
      generatedAt: '2026-03-20T00:00:08.500Z',
      status: 'phase0-evidence-manifest-local-ready-remote-pending',
    })
    writeJson(join(outputDir, 'phase0-bundle-evidence.json'), {
      generatedAt: '2026-03-20T00:00:09.500Z',
      status: 'phase0-bundle-local-ready-remote-pending',
      nextSteps: ['Complete one successful remote Phase 0 observation run to populate the pending remote evidence files.'],
    })
    writeJson(join(outputDir, 'phase0-bundle-verify.json'), {
      generatedAt: '2026-03-20T00:00:10.500Z',
      status: 'phase0-bundle-verify-local-ready-remote-pending',
      nextSteps: ['Complete one successful remote Phase 0 observation run to replace the pending remote bundle evidence.'],
    })
    writePushScriptWhatIfEvidence(outputDir)

    runNode(reportPublishReadinessScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-publish-readiness.json'), 'utf8'))
    const freshnessCheck = report.checks.find((check) => check.id === 'strict-receipt-freshness')

    expect(report.status).toBe('phase0-publish-readiness-incomplete')
    expect(report.blockers).toContain('Publish preflight evidence is stale relative to the latest strict receipt.')
    expect(freshnessCheck?.passed).toBe(false)
    expect(freshnessCheck?.detail).toContain('predates phase0:simulate-publish')
  })

  it('blocks publish readiness when verify strict receipt misses evidence packaging coverage', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      localReadinessPassed: true,
      remoteConfirmationReady: false,
      gitSummary: {
        branchName: 'main',
        hasUpstream: true,
      },
    })
    writeJson(join(outputDir, 'verify-strict-receipt.json'), {
      passed: true,
      commands: [
        { id: 'phase0:simulate-publish', startedAt: '2026-03-20T00:00:01.000Z' },
        { id: 'phase0:publish-status', startedAt: '2026-03-20T00:00:02.000Z' },
        { id: 'phase0:commit-dry-run', startedAt: '2026-03-20T00:00:03.000Z' },
        { id: 'phase0:publish-readiness', startedAt: '2026-03-20T00:00:06.000Z' },
      ],
    })
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), {
      generatedAt: '2026-03-20T00:00:01.500Z',
      status: 'phase0-simulate-publish-ready',
      simulatedReady: true,
      simulatedStagedEntries: [{ path: 'ISSUES.md' }],
    })
    writeJson(join(outputDir, 'phase0-publish-status.json'), {
      generatedAt: '2026-03-20T00:00:02.500Z',
      status: 'phase0-publish-not-ready',
      readyToCommit: false,
      stagedScopedEntries: [],
      unstagedScopedEntries: [{ path: 'apps/pro/package.json' }],
      untrackedScopedEntries: [{ path: '.github/workflows/pro-quality.yml' }],
      stageCommand: 'git -C "C:\\Users\\admin\\Projects\\usan" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"',
    })
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), {
      generatedAt: '2026-03-20T00:00:03.500Z',
      status: 'phase0-commit-not-ready',
      readyToCommit: false,
      nextSteps: ['Stage the standard Phase 0 scope and ensure the commit message file exists before retrying the dry run.'],
    })
    writeJson(join(outputDir, 'phase0-evidence-manifest.json'), {
      generatedAt: '2026-03-20T00:00:04.500Z',
      status: 'phase0-evidence-manifest-local-ready-remote-pending',
    })
    writeJson(join(outputDir, 'phase0-bundle-evidence.json'), {
      generatedAt: '2026-03-20T00:00:05.500Z',
      status: 'phase0-bundle-local-ready-remote-pending',
      nextSteps: ['Complete one successful remote Phase 0 observation run to populate the pending remote evidence files.'],
    })
    writeJson(join(outputDir, 'phase0-bundle-verify.json'), {
      generatedAt: '2026-03-20T00:00:06.500Z',
      status: 'phase0-bundle-verify-local-ready-remote-pending',
      nextSteps: ['Complete one successful remote Phase 0 observation run to replace the pending remote bundle evidence.'],
    })
    writePushScriptWhatIfEvidence(outputDir)

    runNode(reportPublishReadinessScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-publish-readiness.json'), 'utf8'))
    const coverageCheck = report.checks.find((check) => check.id === 'strict-evidence-packaging-coverage')

    expect(report.status).toBe('phase0-publish-readiness-incomplete')
    expect(report.blockers).toContain('Strict receipt does not include evidence packaging coverage yet.')
    expect(coverageCheck?.passed).toBe(false)
    expect(coverageCheck?.detail).toContain('phase0:push-script-whatif')
  })

  it('blocks publish readiness when evidence packaging outputs predate the strict receipt steps', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      localReadinessPassed: true,
      remoteConfirmationReady: false,
      gitSummary: {
        branchName: 'main',
        hasUpstream: true,
      },
    })
    writeJson(join(outputDir, 'verify-strict-receipt.json'), {
      passed: true,
      commands: [
        { id: 'phase0:simulate-publish', startedAt: '2026-03-20T00:00:01.000Z' },
        { id: 'phase0:publish-status', startedAt: '2026-03-20T00:00:02.000Z' },
        { id: 'phase0:commit-dry-run', startedAt: '2026-03-20T00:00:03.000Z' },
        { id: 'phase0:push-script-whatif', startedAt: '2026-03-20T00:00:07.000Z' },
        { id: 'phase0:evidence-manifest', startedAt: '2026-03-20T00:00:08.000Z' },
        { id: 'phase0:bundle-evidence', startedAt: '2026-03-20T00:00:09.000Z' },
        { id: 'phase0:bundle-verify', startedAt: '2026-03-20T00:00:10.000Z' },
      ],
    })
    writeJson(join(outputDir, 'phase0-simulate-publish.json'), {
      generatedAt: '2026-03-20T00:00:01.500Z',
      status: 'phase0-simulate-publish-ready',
      simulatedReady: true,
      simulatedStagedEntries: [{ path: 'ISSUES.md' }],
    })
    writeJson(join(outputDir, 'phase0-publish-status.json'), {
      generatedAt: '2026-03-20T00:00:02.500Z',
      status: 'phase0-publish-not-ready',
      readyToCommit: false,
      stagedScopedEntries: [],
      unstagedScopedEntries: [{ path: 'apps/pro/package.json' }],
      untrackedScopedEntries: [{ path: '.github/workflows/pro-quality.yml' }],
      stageCommand: 'git -C "C:\\Users\\admin\\Projects\\usan" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"',
    })
    writeJson(join(outputDir, 'phase0-commit-dry-run.json'), {
      generatedAt: '2026-03-20T00:00:03.500Z',
      status: 'phase0-commit-not-ready',
      readyToCommit: false,
      nextSteps: ['Stage the standard Phase 0 scope and ensure the commit message file exists before retrying the dry run.'],
    })
    writeJson(join(outputDir, 'phase0-evidence-manifest.json'), {
      generatedAt: '2026-03-20T00:00:04.500Z',
      status: 'phase0-evidence-manifest-local-ready-remote-pending',
    })
    writeJson(join(outputDir, 'phase0-bundle-evidence.json'), {
      generatedAt: '2026-03-20T00:00:05.500Z',
      status: 'phase0-bundle-local-ready-remote-pending',
      nextSteps: ['Complete one successful remote Phase 0 observation run to populate the pending remote evidence files.'],
    })
    writeJson(join(outputDir, 'phase0-bundle-verify.json'), {
      generatedAt: '2026-03-20T00:00:05.750Z',
      status: 'phase0-bundle-verify-local-ready-remote-pending',
      nextSteps: ['Complete one successful remote Phase 0 observation run to replace the pending remote bundle evidence.'],
    })
    writePushScriptWhatIfEvidence(outputDir, {
      generatedAt: '2026-03-20T00:00:07.500Z',
    })

    runNode(reportPublishReadinessScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-publish-readiness.json'), 'utf8'))
    const freshnessCheck = report.checks.find((check) => check.id === 'strict-evidence-packaging-freshness')

    expect(report.status).toBe('phase0-publish-readiness-incomplete')
    expect(report.blockers).toContain('Evidence packaging outputs are stale relative to the latest strict receipt.')
    expect(freshnessCheck?.passed).toBe(false)
    expect(freshnessCheck?.detail).toContain('predates phase0:evidence-manifest')
  })

  it('renders commit handoff for the standard phase0 publish scope', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot)
    initCleanRepoWithUpstream(repoRoot)

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: {
        branchName: 'main',
        changedEntries: [
          { category: 'modified', path: 'ISSUES.md' },
          { category: 'modified', path: 'apps/pro/package.json' },
          { category: 'untracked', path: '.github/workflows/pro-quality.yml' },
        ],
      },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
      publishTargets: [
        { path: '.github/workflows/pro-quality.yml', status: 'untracked' },
        { path: 'apps/pro/scripts/run-phase0-ci-observe.mjs', status: 'tracked-clean' },
      ],
    })

    runNode(reportCommitHandoffScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-commit-handoff.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-commit-handoff.md'), 'utf8')
    const commitMessage = readFileSync(join(outputDir, 'phase0-commit-message.txt'), 'utf8')

    expect(report.status).toBe('phase0-commit-ready')
    expect(report.outsideScopeEntries).toEqual([])
    expect(report.stageCommand).toBe(`git -C "${repoRoot}" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"`)
    expect(report.commitCommand).toBe(`git -C "${repoRoot}" commit -F "${join(outputDir, 'phase0-commit-message.txt')}"`)
    expect(markdown).toContain('## Commit Message')
    expect(markdown).toContain(join(outputDir, 'phase0-commit-message.txt'))
    expect(markdown).toContain('feat(pro): close out phase 0 hardening')
    expect(commitMessage).toContain('feat(pro): close out phase 0 hardening')
    expect(commitMessage).toContain('- add phase0 readiness, closeout, CI observation, and Electron smoke reporting')
  })

  it('commit dry run reports ready when staged scope and commit message file are valid', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot)
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true}\n')
    initCleanRepoWithUpstream(repoRoot)

    writeFileSync(join(repoRoot, 'ISSUES.md'), 'updated issue log\n')
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true,"version":"0.2.0"}\n')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: {
        branchName: 'main',
        changedEntries: [
          { category: 'modified', path: 'ISSUES.md' },
          { category: 'modified', path: 'apps/pro/package.json' },
        ],
      },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
      publishTargets: [
        { path: '.github/workflows/pro-quality.yml', status: 'tracked-clean' },
      ],
    })
    runNode(reportCommitHandoffScriptPath, appRoot)
    execFileSync('git', ['add', '--', 'ISSUES.md', 'apps/pro'], {
      cwd: repoRoot,
      stdio: 'ignore',
    })

    runNode(reportCommitDryRunScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-commit-dry-run.json'), 'utf8'))
    const markdown = readFileSync(join(outputDir, 'phase0-commit-dry-run.md'), 'utf8')

    expect(report.status).toBe('phase0-commit-ready')
    expect(report.readyToCommit).toBe(true)
    expect(report.dryRunResult.ok).toBe(true)
    expect(markdown).toContain('## Dry Run Result')
  })

  it('commit dry run blocks when nothing is staged', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot)
    initCleanRepoWithUpstream(repoRoot)

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: {
        branchName: 'main',
        changedEntries: [],
      },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
      publishTargets: [
        { path: '.github/workflows/pro-quality.yml', status: 'tracked-clean' },
      ],
    })
    runNode(reportCommitHandoffScriptPath, appRoot)
    runNode(reportCommitDryRunScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-commit-dry-run.json'), 'utf8'))

    expect(report.status).toBe('phase0-commit-not-ready')
    expect(report.readyToCommit).toBe(false)
    expect(report.blockers).toContain('No staged entries exist for the Phase 0 commit.')
    expect(report.nextSteps[0]).toContain('Stage the standard Phase 0 scope')
  })

  it('simulate publish reports ready without mutating the real git index', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot)
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true}\n')
    initCleanRepoWithUpstream(repoRoot)

    writeFileSync(join(repoRoot, 'ISSUES.md'), 'updated issue log\n')
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true,"version":"0.2.0"}\n')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: {
        branchName: 'main',
        changedEntries: [
          { category: 'modified', path: 'ISSUES.md' },
          { category: 'modified', path: 'apps/pro/package.json' },
        ],
      },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
      publishTargets: [
        { path: '.github/workflows/pro-quality.yml', status: 'tracked-clean' },
      ],
    })
    runNode(reportCommitHandoffScriptPath, appRoot)
    runNode(reportSimulatePublishScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-simulate-publish.json'), 'utf8'))
    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim()

    expect(report.status).toBe('phase0-simulate-publish-ready')
    expect(report.simulatedReady).toBe(true)
    expect(report.realStagedOutsideScopeEntries).toEqual([])
    expect(report.simulatedStagedEntries.some((entry) => entry.path === 'ISSUES.md')).toBe(true)
    expect(staged).toBe('')
  })

  it('simulate publish treats a clean committed tree as a ready no-op', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot)
    writeFileSync(join(repoRoot, 'ISSUES.md'), 'fixture issue log\n')
    initCleanRepoWithUpstream(repoRoot)

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: {
        branchName: 'main',
        changedEntries: [],
      },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
      publishTargets: [
        { path: '.github/workflows/pro-quality.yml', status: 'tracked-clean' },
      ],
    })
    runNode(reportCommitHandoffScriptPath, appRoot)
    runNode(reportSimulatePublishScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-simulate-publish.json'), 'utf8'))

    expect(report.status).toBe('phase0-simulate-publish-clean-tree')
    expect(report.simulatedReady).toBe(true)
    expect(report.simulationMode).toBe('clean-tree-noop')
    expect(report.realScopedWorktreeEntries).toEqual([])
    expect(report.simulatedStagedEntries).toEqual([])
    expect(report.blockers).toEqual([])
  })

  it('simulate publish blocks when real staged outside-scope entries already exist', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot)
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true}\n')
    initCleanRepoWithUpstream(repoRoot)

    writeFileSync(join(repoRoot, 'ISSUES.md'), 'updated issue log\n')
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true,"version":"0.2.0"}\n')
    mkdirSync(join(repoRoot, 'apps', 'web'), { recursive: true })
    writeFileSync(join(repoRoot, 'apps', 'web', 'package.json'), '{"name":"usan-web"}\n')
    execFileSync('git', ['add', '--', 'apps/web/package.json'], {
      cwd: repoRoot,
      stdio: 'ignore',
    })

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: {
        branchName: 'main',
        changedEntries: [
          { category: 'modified', path: 'apps/pro/package.json' },
          { category: 'modified', path: 'apps/web/package.json' },
        ],
      },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
      publishTargets: [
        { path: '.github/workflows/pro-quality.yml', status: 'tracked-clean' },
      ],
    })
    runNode(reportCommitHandoffScriptPath, appRoot)
    runNode(reportSimulatePublishScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-simulate-publish.json'), 'utf8'))

    expect(report.status).toBe('phase0-simulate-publish-blocked')
    expect(report.blockers).toContain('Real staged entries outside the Phase 0 publish scope already exist.')
    expect(report.nextSteps[0]).toContain('apps/web/package.json')
  })

  it('stage-scope dry-run does not mutate the git index and refreshes publish status', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot)
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true}\n')
    initCleanRepoWithUpstream(repoRoot)

    writeFileSync(join(repoRoot, 'ISSUES.md'), 'updated issue log\n')

    writeJson(join(outputDir, 'phase0-commit-handoff.json'), {
      publishScopeRoots: ['ISSUES.md', '.github/workflows/pro-quality.yml', 'apps/pro'],
      stageCommand: `git -C "${repoRoot}" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"`,
      commitCommand: `git -C "${repoRoot}" commit -F "${join(outputDir, 'phase0-commit-message.txt')}"`,
    })
    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: { branchName: 'main' },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
    })

    runNode(reportStageScopeScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-stage-scope.json'), 'utf8'))
    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim()

    expect(report.mode).toBe('dry-run')
    expect(report.applied).toBe(false)
    expect(report.publishStatus?.status).toBe('phase0-publish-not-ready')
    expect(staged).toBe('')
  })

  it('stage-scope apply stages the standard publish scope and makes publish-status ready', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot)
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true}\n')
    initCleanRepoWithUpstream(repoRoot)

    writeFileSync(join(repoRoot, 'ISSUES.md'), 'updated issue log\n')
    writeFileSync(join(repoRoot, '.github', 'workflows', 'pro-quality.yml'), 'name: Pro Quality\non: workflow_dispatch\n')
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true,"version":"0.2.0"}\n')

    writeJson(join(outputDir, 'phase0-commit-handoff.json'), {
      publishScopeRoots: ['ISSUES.md', '.github/workflows/pro-quality.yml', 'apps/pro'],
      stageCommand: `git -C "${repoRoot}" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"`,
      commitCommand: `git -C "${repoRoot}" commit -F "${join(outputDir, 'phase0-commit-message.txt')}"`,
    })
    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: { branchName: 'main' },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
    })

    runNode(reportStageScopeScriptPath, appRoot, ['--apply'])

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-stage-scope.json'), 'utf8'))
    const publishStatus = JSON.parse(readFileSync(join(outputDir, 'phase0-publish-status.json'), 'utf8'))

    expect(report.mode).toBe('apply')
    expect(report.applied).toBe(true)
    expect(report.publishStatus?.readyToCommit).toBe(true)
    expect(publishStatus.readyToCommit).toBe(true)
    expect(report.stagedScopeEntries.some((entry) => entry.path === 'ISSUES.md')).toBe(true)
    expect(report.stagedScopeEntries.some((entry) => entry.path === 'apps/pro/package.json')).toBe(true)
  })

  it('reports publish-ready when the full phase0 scope is staged with no scoped drift left', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot)
    initCleanRepoWithUpstream(repoRoot)

    writeFileSync(join(repoRoot, 'ISSUES.md'), 'updated issue log\n')
    writeFileSync(join(repoRoot, '.github', 'workflows', 'pro-quality.yml'), 'name: Pro Quality\non: workflow_dispatch\n')
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true}\n')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: {
        branchName: 'main',
      },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
    })
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), {
      publishScopeRoots: ['ISSUES.md', '.github/workflows/pro-quality.yml', 'apps/pro'],
      stageCommand: `git -C "${repoRoot}" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"`,
      commitCommand: `git -C "${repoRoot}" commit -F "${join(outputDir, 'phase0-commit-message.txt')}"`,
    })

    execFileSync('git', ['add', '--', 'ISSUES.md', '.github/workflows/pro-quality.yml', 'apps/pro'], {
      cwd: repoRoot,
      stdio: 'ignore',
    })

    runNode(reportPublishStatusScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-publish-status.json'), 'utf8'))
    expect(report.status).toBe('phase0-publish-ready')
    expect(report.readyToCommit).toBe(true)
    expect(report.stagedOutsideScopeEntries).toEqual([])
    expect(report.unstagedScopedEntries).toEqual([])
    expect(report.untrackedScopedEntries).toEqual([])
  })

  it('blocks publish status when scoped changes remain unstaged or outside-scope files are staged', () => {
    const { repoRoot, appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    materializeCriticalPublishTargets(repoRoot)
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true}\n')
    initCleanRepoWithUpstream(repoRoot)

    mkdirSync(join(repoRoot, 'apps', 'web'), { recursive: true })
    writeFileSync(join(repoRoot, 'apps', 'web', 'package.json'), '{"name":"usan-web"}\n')
    writeFileSync(join(repoRoot, 'ISSUES.md'), 'updated issue log\n')
    writeFileSync(join(appRoot, 'package.json'), '{"name":"usan-pro","private":true,"version":"0.2.0"}\n')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: {
        branchName: 'main',
      },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
    })
    writeJson(join(outputDir, 'phase0-commit-handoff.json'), {
      publishScopeRoots: ['ISSUES.md', '.github/workflows/pro-quality.yml', 'apps/pro'],
      stageCommand: `git -C "${repoRoot}" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"`,
      commitCommand: `git -C "${repoRoot}" commit -F "${join(outputDir, 'phase0-commit-message.txt')}"`,
    })

    execFileSync('git', ['add', '--', 'ISSUES.md', 'apps/web/package.json'], {
      cwd: repoRoot,
      stdio: 'ignore',
    })

    runNode(reportPublishStatusScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-publish-status.json'), 'utf8'))
    expect(report.status).toBe('phase0-publish-not-ready')
    expect(report.readyToCommit).toBe(false)
    expect(report.blockers).toContain('Some Phase 0 publish-scope entries are still unstaged.')
    expect(report.blockers).toContain('Staged entries exist outside the standard Phase 0 publish scope.')
    expect(report.nextSteps.some((step) => step.includes('apps/pro/package.json'))).toBe(true)
    expect(report.nextSteps.some((step) => step.includes('apps/web/package.json'))).toBe(true)
  })

  it('blocks commit handoff when dirty entries exist outside the standard phase0 scope', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')

    writeJson(join(outputDir, 'phase0-closeout.json'), {
      status: 'phase0-local-complete-remote-pending',
      gitSummary: {
        branchName: 'main',
        changedEntries: [
          { category: 'modified', path: 'apps/pro/package.json' },
          { category: 'modified', path: 'apps/web/package.json' },
        ],
      },
      gitIdentitySummary: {
        userName: 'Codex Test',
        userEmail: 'codex@example.com',
        remoteMatchesExpectation: true,
      },
      publishTargets: [
        { path: '.github/workflows/pro-quality.yml', status: 'tracked-clean' },
      ],
    })

    runNode(reportCommitHandoffScriptPath, appRoot)

    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-commit-handoff.json'), 'utf8'))

    expect(report.status).toBe('phase0-commit-blocked')
    expect(report.blockers).toContain('Dirty entries exist outside the standard Phase 0 publish scope.')
    expect(report.nextSteps[0]).toContain('apps/web/package.json')
  })

  it('fails ci compare when the observed run id does not match the downloaded artifact run', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    writeCompareEvidence(appRoot, { observedRunId: 456, downloadRunId: 123 })

    let error: Error | null = null
    try {
      runNode(reportCiCompareScriptPath, appRoot)
    } catch (caught) {
      error = caught as Error
    }

    expect(error).not.toBeNull()
    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-ci-compare.json'), 'utf8'))
    const observedRunCheck = report.checks.find((check) => check.id === 'observed-run-id-parity')

    expect(report.passed).toBe(false)
    expect(observedRunCheck?.passed).toBe(false)
    expect(observedRunCheck?.detail).toContain('observed=456 download=123')
  })

  it('fails ci compare when a downloaded screenshot hash differs from the local evidence', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    writeCompareEvidence(appRoot)
    writeFileSync(join(outputDir, 'ci-artifacts', 'run-123', 'pro-electron-smoke', 'shell-dark.png'), 'tampered-remote')

    let error: Error | null = null
    try {
      runNode(reportCiCompareScriptPath, appRoot)
    } catch (caught) {
      error = caught as Error
    }

    expect(error).not.toBeNull()
    const report = JSON.parse(readFileSync(join(outputDir, 'phase0-ci-compare.json'), 'utf8'))
    const hashCheck = report.checks.find((check) => check.id === 'visual-dark-shell-screenshot-hash-parity')

    expect(report.passed).toBe(false)
    expect(hashCheck?.passed).toBe(false)
    expect(hashCheck?.detail).toContain('local=')
    expect(hashCheck?.detail).toContain('remote=')
  })

  it('reuses an existing successful run and refreshes ci status plus compare outputs', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    const evidence = createEvidencePayload(appRoot)
    const fixturePath = join(outputDir, 'phase0-ci-observe.fixture.json')

    writeJson(fixturePath, {
      authOk: true,
      remoteBranches: ['main'],
      workflow: {
        id: 42,
        name: 'Pro Quality',
        state: 'active',
        html_url: 'https://example.com/workflows/42',
        path: '.github/workflows/pro-quality.yml',
      },
      runs: [
        {
          databaseId: 123,
          name: 'Pro Quality',
          displayTitle: 'Phase 0 Observe',
          status: 'completed',
          conclusion: 'success',
          event: 'workflow_dispatch',
          headBranch: 'main',
          headSha: 'abc123',
          createdAt: '2026-03-20T12:00:00.000Z',
          updatedAt: '2026-03-20T12:05:00.000Z',
          url: 'https://example.com/runs/123',
        },
      ],
      runViews: {
        123: {
          jobs: [{ name: 'verify:strict', status: 'completed', conclusion: 'success' }],
        },
      },
      artifacts: {
        123: {
          artifacts: [
            { name: 'pro-electron-smoke', expired: false },
            { name: 'pro-phase0-readiness', expired: false },
          ],
        },
      },
      runsById: {
        123: {
          id: 123,
          status: 'completed',
          conclusion: 'success',
          head_branch: 'main',
          head_sha: 'abc123',
          created_at: '2026-03-20T12:00:00.000Z',
          updated_at: '2026-03-20T12:05:00.000Z',
          html_url: 'https://example.com/runs/123',
          event: 'workflow_dispatch',
          workflow_id: 42,
        },
      },
      downloads: {
        123: {
          phase0Readiness: evidence.readiness,
          verifyStrictReceipt: evidence.receipt,
          shellVisualManifest: evidence.visualManifest,
          files: evidence.files,
        },
      },
    })

    runNode(runCiObserveScriptPath, appRoot, ['--ref', 'main', '--run-id', '123'], {
      ...process.env,
      PHASE0_CI_OBSERVE_FIXTURE: fixturePath,
    })

    const ciStatus = JSON.parse(readFileSync(join(outputDir, 'phase0-ci-status.json'), 'utf8'))
    const ciCompare = JSON.parse(readFileSync(join(outputDir, 'phase0-ci-compare.json'), 'utf8'))
    const observedRun = JSON.parse(readFileSync(join(outputDir, 'phase0-ci-observed-run.json'), 'utf8'))
    const latestDownload = JSON.parse(readFileSync(join(outputDir, 'ci-artifacts', 'latest-download.json'), 'utf8'))

    expect(observedRun.runId).toBe(123)
    expect(latestDownload.runId).toBe(123)
    expect(ciCompare.passed).toBe(true)
    expect(ciStatus.ready).toBe(true)
    expect(ciStatus.status).toBe('observed-run-confirmed')
  })

  it('refreshes receipt-dependent outputs after the final strict receipt is written', () => {
    const { appRoot } = createFixture()
    const outputDir = join(appRoot, 'output', 'phase0-readiness')
    const fixtureDir = join(appRoot, 'verify-strict-fixture')
    const nodeCommand = process.platform === 'win32' ? 'node.exe' : 'node'
    mkdirSync(fixtureDir, { recursive: true })

    const noOpScriptPath = join(fixtureDir, 'noop.mjs')
    const bundleEvidenceScriptPath = join(fixtureDir, 'bundle-evidence.mjs')
    const bundleVerifyScriptPath = join(fixtureDir, 'bundle-verify.mjs')
    const publishReadinessScriptPath = join(fixtureDir, 'publish-readiness.mjs')
    const planFixturePath = join(fixtureDir, 'verify-strict-plan.json')

    writeFileSync(noOpScriptPath, 'console.log("ok")\n')
    writeFileSync(bundleEvidenceScriptPath, [
      "import { copyFileSync, mkdirSync } from 'node:fs'",
      "import { dirname, resolve } from 'node:path'",
      'const appRoot = process.cwd()',
      "const outputDir = resolve(appRoot, 'output', 'phase0-readiness')",
      "const receiptPath = resolve(outputDir, 'verify-strict-receipt.json')",
      "const bundleReceiptPath = resolve(outputDir, 'bundle-receipt.json')",
      'mkdirSync(dirname(bundleReceiptPath), { recursive: true })',
      'copyFileSync(receiptPath, bundleReceiptPath)',
    ].join('\n'))
    writeFileSync(bundleVerifyScriptPath, [
      "import { existsSync, readFileSync, writeFileSync } from 'node:fs'",
      "import { resolve } from 'node:path'",
      'const appRoot = process.cwd()',
      "const outputDir = resolve(appRoot, 'output', 'phase0-readiness')",
      "const receiptPath = resolve(outputDir, 'verify-strict-receipt.json')",
      "const bundleReceiptPath = resolve(outputDir, 'bundle-receipt.json')",
      "const reportPath = resolve(outputDir, 'phase0-bundle-verify.json')",
      'const report = {',
      "  status: 'pass',",
      '  matches: true,',
      '}',
      'if (!existsSync(receiptPath) || !existsSync(bundleReceiptPath)) {',
      "  report.status = 'missing'",
      '  report.matches = false',
      '} else {',
      "  const receipt = readFileSync(receiptPath, 'utf8')",
      "  const bundleReceipt = readFileSync(bundleReceiptPath, 'utf8')",
      '  report.matches = receipt === bundleReceipt',
      "  report.status = report.matches ? 'pass' : 'fail'",
      '}',
      "writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\\n`)",
    ].join('\n'))
    writeFileSync(publishReadinessScriptPath, [
      "import { readFileSync, writeFileSync } from 'node:fs'",
      "import { resolve } from 'node:path'",
      'const appRoot = process.cwd()',
      "const outputDir = resolve(appRoot, 'output', 'phase0-readiness')",
      "const bundleVerifyPath = resolve(outputDir, 'phase0-bundle-verify.json')",
      "const reportPath = resolve(outputDir, 'phase0-publish-readiness.json')",
      "const bundleVerify = JSON.parse(readFileSync(bundleVerifyPath, 'utf8'))",
      "writeFileSync(reportPath, `${JSON.stringify({ status: bundleVerify.status }, null, 2)}\\n`)",
    ].join('\n'))

    writeJson(planFixturePath, {
      commands: [
        { id: 'typecheck', command: nodeCommand, args: [noOpScriptPath] },
        { id: 'lint', command: nodeCommand, args: [noOpScriptPath] },
        { id: 'phase0:evidence-manifest', command: nodeCommand, args: [noOpScriptPath] },
        { id: 'phase0:bundle-evidence', command: nodeCommand, args: [bundleEvidenceScriptPath] },
        { id: 'phase0:bundle-verify', command: nodeCommand, args: [bundleVerifyScriptPath] },
        { id: 'phase0:publish-readiness', command: nodeCommand, args: [publishReadinessScriptPath] },
      ],
      receiptRefreshIds: [
        'phase0:evidence-manifest',
        'phase0:bundle-evidence',
        'phase0:bundle-verify',
        'phase0:publish-readiness',
      ],
    })

    runNode(runVerifyStrictScriptPath, appRoot, [], {
      ...process.env,
      VERIFY_STRICT_PLAN_FIXTURE: planFixturePath,
    })

    const finalReceipt = readFileSync(join(outputDir, 'verify-strict-receipt.json'), 'utf8')
    const bundledReceipt = readFileSync(join(outputDir, 'bundle-receipt.json'), 'utf8')
    const bundleVerify = JSON.parse(readFileSync(join(outputDir, 'phase0-bundle-verify.json'), 'utf8'))
    const publishReadiness = JSON.parse(readFileSync(join(outputDir, 'phase0-publish-readiness.json'), 'utf8'))

    expect(bundledReceipt).toBe(finalReceipt)
    expect(bundleVerify.status).toBe('pass')
    expect(bundleVerify.matches).toBe(true)
    expect(publishReadiness.status).toBe('pass')
  })
})
