import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const closeoutPath = resolve(outputDir, 'phase0-closeout.json')
const jsonOutputPath = resolve(outputDir, 'phase0-commit-handoff.json')
const markdownOutputPath = resolve(outputDir, 'phase0-commit-handoff.md')
const commitMessagePath = resolve(outputDir, 'phase0-commit-message.txt')
const publishScopeRoots = ['ISSUES.md', '.github/workflows/pro-quality.yml', 'apps/pro']
const recommendedCommitTitle = 'feat(pro): close out phase 0 hardening'
const recommendedCommitBodyLines = [
  '- harden shell, approval, storage, and restart-safe session flows',
  '- expand attachment routing, provider delivery, and session inspection surfaces',
  '- add phase0 readiness, closeout, CI observation, and Electron smoke reporting',
]

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function normalizePath(path) {
  return path.replace(/\\/g, '/')
}

function isWithinPublishScope(path) {
  const normalizedPath = normalizePath(path)
  return publishScopeRoots.some((scopeRoot) => {
    const normalizedScopeRoot = normalizePath(scopeRoot)
    return normalizedPath === normalizedScopeRoot || normalizedPath.startsWith(`${normalizedScopeRoot}/`)
  })
}

function quote(value) {
  return `"${value}"`
}

function buildCommitMessage(title, bodyLines) {
  return `${title}\n\n${bodyLines.join('\n')}\n`
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 Commit Handoff',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo root: ${report.repoRoot}`,
    `- App root: ${report.appRoot}`,
    `- Branch: ${report.branchName}`,
    `- Status: ${report.status}`,
    `- Scoped entries: ${report.scopedEntries.length}`,
    `- Outside-scope entries: ${report.outsideScopeEntries.length}`,
    '',
    '## Review Commands',
    `- Status: ${report.reviewCommands.status}`,
    `- Diff stat: ${report.reviewCommands.diffStat}`,
    `- Full diff: ${report.reviewCommands.diff}`,
  ]

  if (report.stageCommand) {
    lines.push('', '## Stage Command', `- ${report.stageCommand}`)
  }

  if (report.commitCommand) {
    lines.push('', '## Commit Command', `- ${report.commitCommand}`)
  }

  if (report.commitMessagePath) {
    lines.push('', '## Commit Message File', `- ${report.commitMessagePath}`)
  }

  if (report.pushCommand) {
    lines.push('', '## Push Command', `- ${report.pushCommand}`)
  }

  if (report.observeCommand) {
    lines.push('', '## Observe Command', `- ${report.observeCommand}`)
  }

  lines.push('', '## Commit Message')
  lines.push(`- Title: ${report.commitTitle}`)
  for (const line of report.commitBodyLines) {
    lines.push(`- ${line}`)
  }

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

  if (report.scopedEntries.length > 0) {
    lines.push('', '## Scoped Change Inventory')
    for (const entry of report.scopedEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  if (report.outsideScopeEntries.length > 0) {
    lines.push('', '## Outside Scope Inventory')
    for (const entry of report.outsideScopeEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })

if (!existsSync(closeoutPath)) {
  throw new Error('Missing phase0-closeout.json. Run `npm run phase0:closeout` first.')
}

const closeout = readJson(closeoutPath)
const changedEntries = closeout.gitSummary?.changedEntries ?? []
const scopedEntries = changedEntries.filter((entry) => isWithinPublishScope(entry.path))
const outsideScopeEntries = changedEntries.filter((entry) => !isWithinPublishScope(entry.path))
const stageTargets = publishScopeRoots.filter((scopeRoot) =>
  scopedEntries.some((entry) => isWithinPublishScope(scopeRoot) && isWithinPublishScope(entry.path) && (
    normalizePath(entry.path) === normalizePath(scopeRoot)
    || normalizePath(entry.path).startsWith(`${normalizePath(scopeRoot)}/`)
  )),
)
const branchName = closeout.gitSummary?.branchName ?? 'main'
const stageCommand = stageTargets.length > 0
  ? `git -C ${quote(repoRoot)} add -- ${stageTargets.map(quote).join(' ')}`
  : null
const commitCommand = stageCommand
  ? `git -C ${quote(repoRoot)} commit -F ${quote(commitMessagePath)}`
  : null
const pushCommand = `git -C ${quote(repoRoot)} push origin ${branchName}`
const observeCommand = `npm run phase0:ci-observe -- --ref ${branchName}`
const commitMessage = buildCommitMessage(recommendedCommitTitle, recommendedCommitBodyLines)

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  appRoot,
  branchName,
  status: 'phase0-commit-ready',
  publishScopeRoots,
  scopedEntries,
  outsideScopeEntries,
  reviewCommands: {
    status: `git -C ${quote(repoRoot)} status --short --branch`,
    diffStat: `git -C ${quote(repoRoot)} diff --stat -- ${publishScopeRoots.map(quote).join(' ')}`,
    diff: `git -C ${quote(repoRoot)} diff -- ${publishScopeRoots.map(quote).join(' ')}`,
  },
  stageCommand,
  commitCommand,
  commitMessagePath,
  pushCommand,
  observeCommand,
  commitTitle: recommendedCommitTitle,
  commitBodyLines: recommendedCommitBodyLines,
  blockers: [],
  nextSteps: [],
}

if (scopedEntries.length === 0) {
  report.status = 'phase0-commit-blocked'
  report.blockers.push('No changed Phase 0 publish-scope entries were found.')
  report.nextSteps.push('Confirm the intended changes are still present under ISSUES.md, .github/workflows/pro-quality.yml, or apps/pro.')
}

if (outsideScopeEntries.length > 0) {
  report.status = 'phase0-commit-blocked'
  report.blockers.push('Dirty entries exist outside the standard Phase 0 publish scope.')
  report.nextSteps.push(`Review or isolate the outside-scope entries before using the recommended stage command: ${outsideScopeEntries.map((entry) => entry.path).join(', ')}`)
}

if ((closeout.publishTargets ?? []).some((target) => target.status === 'missing')) {
  report.status = 'phase0-commit-blocked'
  report.blockers.push('At least one critical publish target is missing from the worktree.')
}

if (!closeout.gitIdentitySummary?.remoteMatchesExpectation) {
  report.status = 'phase0-commit-blocked'
  report.blockers.push('Origin remote does not match the expected iruhana/usan repository.')
}

if (!closeout.gitIdentitySummary?.userName || !closeout.gitIdentitySummary?.userEmail) {
  report.status = 'phase0-commit-blocked'
  report.blockers.push('Git identity is incomplete for the Phase 0 publish flow.')
}

if (closeout.status === 'missing-local-readiness' || closeout.status === 'local-readiness-failed') {
  report.status = 'phase0-commit-blocked'
  report.blockers.push('Local Phase 0 readiness evidence is missing or failing.')
}

if (report.status === 'phase0-commit-ready') {
  report.nextSteps.push('Review the scoped diff, stage the Phase 0 scope, commit, push, then run the CI observe command.')
}

writeFileSync(commitMessagePath, commitMessage)
writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(`Phase 0 commit handoff written to ${markdownOutputPath}`)
