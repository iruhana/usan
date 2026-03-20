import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const closeoutDocPath = resolve(appRoot, 'docs', 'phase0-closeout-2026-03-20.md')
const readinessPath = resolve(outputDir, 'phase0-readiness.json')
const ciStatusPath = resolve(outputDir, 'phase0-ci-status.json')
const ciComparePath = resolve(outputDir, 'phase0-ci-compare.json')
const commitHandoffPath = resolve(outputDir, 'phase0-commit-handoff.json')
const commitDryRunPath = resolve(outputDir, 'phase0-commit-dry-run.json')
const publishStatusPath = resolve(outputDir, 'phase0-publish-status.json')
const simulatePublishPath = resolve(outputDir, 'phase0-simulate-publish.json')
const stageScopePath = resolve(outputDir, 'phase0-stage-scope.json')
const pushScriptPath = resolve(outputDir, 'phase0-push-script.json')
const pushScriptWhatIfPath = resolve(outputDir, 'phase0-push-script-whatif.json')
const evidenceManifestPath = resolve(outputDir, 'phase0-evidence-manifest.json')
const bundleEvidencePath = resolve(outputDir, 'phase0-bundle-evidence.json')
const bundleVerifyPath = resolve(outputDir, 'phase0-bundle-verify.json')
const publishReadinessPath = resolve(outputDir, 'phase0-publish-readiness.json')
const jsonOutputPath = resolve(outputDir, 'phase0-closeout.json')
const markdownOutputPath = resolve(outputDir, 'phase0-closeout.md')
const expectedRemoteOwner = 'iruhana'
const expectedRemoteRepo = 'usan'
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

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function runGit(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim()
}

function parseGitHubRemote(remoteUrl) {
  const httpsMatch = remoteUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?$/i)
  if (httpsMatch) {
    return { host: 'github.com', owner: httpsMatch[1], repo: httpsMatch[2] }
  }

  const sshMatch = remoteUrl.match(/^git@github\.com:([^/]+)\/([^/.]+?)(?:\.git)?$/i)
  if (sshMatch) {
    return { host: 'github.com', owner: sshMatch[1], repo: sshMatch[2] }
  }

  return null
}

function getGitIdentitySummary() {
  try {
    const userName = runGit(['config', 'user.name'])
    const userEmail = runGit(['config', 'user.email'])
    const remoteUrl = runGit(['remote', 'get-url', 'origin'])
    const parsedRemote = parseGitHubRemote(remoteUrl)

    return {
      userName,
      userEmail,
      remoteUrl,
      parsedRemote,
      expectedRemoteOwner,
      expectedRemoteRepo,
      remoteMatchesExpectation: parsedRemote
        ? parsedRemote.owner === expectedRemoteOwner && parsedRemote.repo === expectedRemoteRepo
        : null,
    }
  } catch {
    return null
  }
}

function getGitSummary() {
  try {
    const statusOutput = execFileSync('git', ['status', '--porcelain', '--branch'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trimEnd()

    const lines = statusOutput.split(/\r?\n/)
    const branchLine = lines[0] ?? ''
    const [, branchPart = '', trackingPart = ''] = branchLine.match(/^## ([^.]*)((?:\.\.\.[^\s]+)?(?: .+)?)?$/) ?? []
    const branchName = branchPart || 'unknown'
    const hasUpstream = trackingPart.includes('...')
    const aheadMatch = trackingPart.match(/ahead (\d+)/)
    const behindMatch = trackingPart.match(/behind (\d+)/)
    const changedEntries = lines.slice(1).filter(Boolean).map((line) => {
      if (line.startsWith('?? ')) {
        return {
          code: '??',
          category: 'untracked',
          path: line.slice(3),
        }
      }

      const code = line.slice(0, 2)
      const rawPath = line.slice(3)
      const path = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) : rawPath
      let category = 'modified'

      if (code.includes('D')) {
        category = 'deleted'
      } else if (code.includes('R')) {
        category = 'renamed'
      } else if (code.includes('A')) {
        category = 'added'
      }

      return {
        code,
        category,
        path,
      }
    })

    const countsByCategory = changedEntries.reduce((accumulator, entry) => {
      accumulator[entry.category] = (accumulator[entry.category] ?? 0) + 1
      return accumulator
    }, {})

    return {
      branchName,
      hasUpstream,
      ahead: aheadMatch ? Number.parseInt(aheadMatch[1], 10) : 0,
      behind: behindMatch ? Number.parseInt(behindMatch[1], 10) : 0,
      dirty: changedEntries.length > 0,
      changedEntriesCount: changedEntries.length,
      changedEntries,
      countsByCategory,
    }
  } catch {
    return null
  }
}

function getCriticalPublishTargetSummary(gitSummary) {
  const normalizedChangedEntries = (gitSummary?.changedEntries ?? []).map((entry) => ({
    ...entry,
    normalizedPath: entry.path.replace(/\\/g, '/'),
  }))
  const changedEntriesByPath = new Map(
    normalizedChangedEntries.map((entry) => [entry.normalizedPath, entry]),
  )

  return criticalPublishTargets.map((relativePath) => {
    const normalizedPath = relativePath.replace(/\\/g, '/')
    const absolutePath = resolve(repoRoot, normalizedPath)
    const changedEntry = changedEntriesByPath.get(normalizedPath)
      ?? normalizedChangedEntries.find((entry) =>
        entry.category === 'untracked'
        && normalizedPath.startsWith(`${entry.normalizedPath.replace(/\/$/, '')}/`),
      )
      ?? null
    const exists = existsSync(absolutePath)

    let status = 'tracked-clean'
    if (!exists) {
      status = 'missing'
    } else if (changedEntry?.category === 'untracked') {
      status = 'untracked'
    } else if (changedEntry) {
      status = 'tracked-dirty'
    }

    return {
      path: normalizedPath,
      exists,
      status,
      gitCategory: changedEntry?.category ?? null,
      gitCode: changedEntry?.code ?? null,
    }
  })
}

function getPublishTargetStageCommand(publishTargets) {
  const stageableTargets = (publishTargets ?? [])
    .filter((target) => target.status === 'tracked-dirty' || target.status === 'untracked')
    .map((target) => target.path)

  if (stageableTargets.length === 0) {
    return null
  }

  const quotedTargets = stageableTargets.map((target) => `"${target}"`).join(' ')
  return `git -C "${repoRoot}" add -- ${quotedTargets}`
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 Closeout Status',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Closeout doc: ${closeoutDocPath}`,
    `- Status: ${report.status}`,
    `- Local readiness: ${report.localReadinessPassed ? 'PASS' : 'FAIL'}`,
    `- Remote confirmation: ${report.remoteConfirmationReady ? 'PASS' : 'PENDING'}`,
    `- Ready to begin Phase 1 by default: ${report.readyForPhase1 ? 'yes' : 'no'}`,
  ]

  if (report.readinessSummary) {
    lines.push(`- Local checks: ${report.readinessSummary.passedChecks}/${report.readinessSummary.totalChecks}`)
  }

  if (report.gitSummary) {
    lines.push(`- Branch: ${report.gitSummary.branchName}`)
    lines.push(`- Has upstream: ${report.gitSummary.hasUpstream ? 'yes' : 'no'}`)
    lines.push(`- Ahead: ${report.gitSummary.ahead}`)
    lines.push(`- Behind: ${report.gitSummary.behind}`)
    lines.push(`- Dirty worktree: ${report.gitSummary.dirty ? 'yes' : 'no'} (${report.gitSummary.changedEntriesCount} entries)`)
    lines.push(`- Modified entries: ${report.gitSummary.countsByCategory.modified ?? 0}`)
    lines.push(`- Added entries: ${report.gitSummary.countsByCategory.added ?? 0}`)
    lines.push(`- Deleted entries: ${report.gitSummary.countsByCategory.deleted ?? 0}`)
    lines.push(`- Renamed entries: ${report.gitSummary.countsByCategory.renamed ?? 0}`)
    lines.push(`- Untracked entries: ${report.gitSummary.countsByCategory.untracked ?? 0}`)
  }

  if (report.gitIdentitySummary) {
    lines.push(`- Git user.name: ${report.gitIdentitySummary.userName}`)
    lines.push(`- Git user.email: ${report.gitIdentitySummary.userEmail}`)
    lines.push(`- Origin remote: ${report.gitIdentitySummary.remoteUrl}`)
    if (report.gitIdentitySummary.parsedRemote) {
      lines.push(`- Origin owner/repo: ${report.gitIdentitySummary.parsedRemote.owner}/${report.gitIdentitySummary.parsedRemote.repo}`)
      lines.push(`- Origin matches expected remote: ${report.gitIdentitySummary.remoteMatchesExpectation ? 'yes' : 'no'}`)
    }
  }

  if (report.ciStatusSummary) {
    lines.push(`- CI status: ${report.ciStatusSummary.status}`)
    if (report.ciStatusSummary.targetBranch) {
      lines.push(`- CI target branch: ${report.ciStatusSummary.targetBranch}`)
    }
  }

  if (report.ciCompareSummary) {
    lines.push(`- CI compare: ${report.ciCompareSummary.status}`)
  }

  if (report.publishTargets?.length) {
    lines.push('', '## Publish Targets')
    for (const target of report.publishTargets) {
      const detail = target.gitCategory ? ` (${target.gitCategory})` : ''
      lines.push(`- [${target.status}] ${target.path}${detail}`)
    }
  }

  if (report.stageCommand) {
    lines.push('', '## Recommended Stage Command')
    lines.push(`- ${report.stageCommand}`)
  }

  if (report.blockers.length > 0) {
    lines.push('', '## Blockers')
    for (const blocker of report.blockers) {
      lines.push(`- ${blocker}`)
    }
  }

  if (report.nextSteps.length > 0) {
    lines.push('', '## Next Steps')
    for (const step of report.nextSteps) {
      lines.push(`- ${step}`)
    }
  }

  if (report.gitSummary?.changedEntries?.length) {
    lines.push('', '## Change Inventory')
    for (const entry of report.gitSummary.changedEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  lines.push('', '## Evidence')
  lines.push(`- ${readinessPath}`)
  if (existsSync(ciStatusPath)) {
    lines.push(`- ${ciStatusPath}`)
  }
  if (existsSync(ciComparePath)) {
    lines.push(`- ${ciComparePath}`)
  }
  if (existsSync(commitHandoffPath)) {
    lines.push(`- ${commitHandoffPath}`)
  }
  if (existsSync(commitDryRunPath)) {
    lines.push(`- ${commitDryRunPath}`)
  }
  if (existsSync(publishStatusPath)) {
    lines.push(`- ${publishStatusPath}`)
  }
  if (existsSync(simulatePublishPath)) {
    lines.push(`- ${simulatePublishPath}`)
  }
  if (existsSync(stageScopePath)) {
    lines.push(`- ${stageScopePath}`)
  }
  if (existsSync(pushScriptPath)) {
    lines.push(`- ${pushScriptPath}`)
  }
  if (existsSync(pushScriptWhatIfPath)) {
    lines.push(`- ${pushScriptWhatIfPath}`)
  }
  if (existsSync(evidenceManifestPath)) {
    lines.push(`- ${evidenceManifestPath}`)
  }
  if (existsSync(bundleEvidencePath)) {
    lines.push(`- ${bundleEvidencePath}`)
  }
  if (existsSync(bundleVerifyPath)) {
    lines.push(`- ${bundleVerifyPath}`)
  }
  if (existsSync(publishReadinessPath)) {
    lines.push(`- ${publishReadinessPath}`)
  }

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })

const report = {
  generatedAt: new Date().toISOString(),
  status: 'unknown',
  localReadinessPassed: false,
  remoteConfirmationReady: false,
  readyForPhase1: false,
  readinessSummary: null,
  gitSummary: getGitSummary(),
  gitIdentitySummary: getGitIdentitySummary(),
  publishTargets: [],
  stageCommand: null,
  ciStatusSummary: null,
  ciCompareSummary: null,
  blockers: [],
  nextSteps: [],
}

if (!existsSync(readinessPath)) {
  report.status = 'missing-local-readiness'
  report.blockers.push('Run `npm run verify:strict` or `npm run phase0:readiness` to generate local readiness evidence.')
} else {
  const readiness = readJson(readinessPath)
  report.localReadinessPassed = Boolean(readiness.passed)
  report.readinessSummary = {
    passedChecks: readiness.passedChecks ?? 0,
    totalChecks: readiness.totalChecks ?? 0,
  }

  if (!report.localReadinessPassed) {
    report.status = 'local-readiness-failed'
    report.blockers.push('Local Phase 0 readiness is failing.')
  }
}

if (report.gitSummary) {
  if (report.gitSummary.dirty) {
    report.blockers.push('Local worktree is dirty; commit or stash changes before remote Phase 0 confirmation.')
  }

  if (!report.gitSummary.hasUpstream) {
    report.blockers.push(`Current branch ${report.gitSummary.branchName} does not have an upstream remote branch.`)
    report.nextSteps.push(`Push the current branch with upstream tracking before running remote Phase 0 observation.`)
  } else if (report.gitSummary.ahead > 0) {
    report.nextSteps.push(`Push branch ${report.gitSummary.branchName} to origin so remote CI can observe the current Phase 0 changes.`)
  }
}

report.publishTargets = getCriticalPublishTargetSummary(report.gitSummary)
report.stageCommand = getPublishTargetStageCommand(report.publishTargets)

const untrackedPublishTargets = report.publishTargets.filter((target) => target.status === 'untracked')
if (untrackedPublishTargets.length > 0) {
  report.blockers.push('Critical Phase 0 publish targets are still untracked.')
  report.nextSteps.push(`Stage the untracked publish targets before push: ${untrackedPublishTargets.map((target) => target.path).join(', ')}`)
}

const missingPublishTargets = report.publishTargets.filter((target) => target.status === 'missing')
if (missingPublishTargets.length > 0) {
  report.blockers.push('Critical Phase 0 publish targets are missing from the worktree.')
  report.nextSteps.push(`Restore or recreate the missing publish targets before push: ${missingPublishTargets.map((target) => target.path).join(', ')}`)
}

if (report.gitIdentitySummary) {
  if (!report.gitIdentitySummary.userName || !report.gitIdentitySummary.userEmail) {
    report.blockers.push('Git user.name or user.email is not configured for this repository.')
    report.nextSteps.push('Configure git user.name and user.email for this repository before pushing the Phase 0 closeout branch.')
  }

  if (report.gitIdentitySummary.remoteMatchesExpectation === false) {
    report.blockers.push(
      `Origin remote points to ${report.gitIdentitySummary.parsedRemote.owner}/${report.gitIdentitySummary.parsedRemote.repo}, expected ${expectedRemoteOwner}/${expectedRemoteRepo}.`,
    )
    report.nextSteps.push(`Update origin to ${expectedRemoteOwner}/${expectedRemoteRepo} before running the final Phase 0 push and CI observation.`)
  }
}

if (existsSync(ciStatusPath)) {
  const ciStatus = readJson(ciStatusPath)
  report.ciStatusSummary = {
    status: ciStatus.status,
    ready: Boolean(ciStatus.ready),
    targetBranch: ciStatus.targetBranch ?? null,
  }

  if (ciStatus.ready) {
    report.remoteConfirmationReady = true
  } else if (ciStatus.status === 'remote-workflow-missing') {
    report.blockers.push('Remote repository does not yet contain .github/workflows/pro-quality.yml.')
    report.nextSteps.push('Push the current branch so the remote repository contains the new workflow and Phase 0 scripts.')
  } else if (ciStatus.status === 'no-remote-runs-for-branch' || ciStatus.status === 'observation-pending') {
    report.blockers.push(`Remote Phase 0 observation is still pending for the current branch (${ciStatus.targetBranch ?? report.gitSummary?.branchName ?? 'unknown'}).`)
    report.nextSteps.push(`Run \`npm run phase0:ci-observe -- --ref ${ciStatus.targetBranch ?? report.gitSummary?.branchName ?? 'main'}\` after pushing the branch.`)
  } else if (!ciStatus.ready) {
    report.blockers.push(`Remote CI status is ${ciStatus.status}.`)
  }
} else {
  report.blockers.push('Remote CI status evidence is missing.')
  report.nextSteps.push('Run `npm run phase0:ci-status` to inspect remote workflow availability.')
}

if (existsSync(ciComparePath)) {
  const ciCompare = readJson(ciComparePath)
  report.ciCompareSummary = {
    status: ciCompare.passed ? 'pass' : 'fail',
    passedChecks: ciCompare.passedChecks ?? 0,
    totalChecks: ciCompare.totalChecks ?? 0,
  }

  if (report.remoteConfirmationReady && !ciCompare.passed) {
    report.blockers.push('Downloaded remote artifacts do not yet match the local Phase 0 evidence bundle.')
  }
} else {
  report.nextSteps.push('Run `npm run phase0:ci-compare` after remote artifacts have been downloaded.')
}

if (!report.remoteConfirmationReady && report.ciCompareSummary?.status === 'fail') {
  report.ciCompareSummary.status = 'pending'
}

const hasBlockingIssues = report.blockers.length > 0

if (report.localReadinessPassed && report.remoteConfirmationReady) {
  const ciComparePassed = report.ciCompareSummary?.status === 'pass'
  if (ciComparePassed && !hasBlockingIssues) {
    report.readyForPhase1 = true
    report.status = 'phase0-complete'
  } else if (ciComparePassed) {
    report.status = 'phase0-complete-with-local-blockers'
    report.nextSteps.push('Resolve the remaining local blockers before treating Phase 0 as fully closed.')
  } else {
    report.status = 'phase0-remote-confirmed-compare-pending'
    report.nextSteps.push('Re-run `npm run phase0:ci-observe` or `npm run phase0:ci-compare` to confirm local/remote evidence parity.')
  }
} else if (report.localReadinessPassed) {
  report.status = 'phase0-local-complete-remote-pending'
  report.nextSteps.push('Complete one successful remote `pro-quality` workflow run and artifact download before declaring Phase 0 fully closed.')
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(`Phase 0 closeout status: ${report.status} -> ${markdownOutputPath}`)
