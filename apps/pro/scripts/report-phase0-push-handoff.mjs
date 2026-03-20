import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const closeoutPath = resolve(outputDir, 'phase0-closeout.json')
const commitHandoffPath = resolve(outputDir, 'phase0-commit-handoff.json')
const jsonOutputPath = resolve(outputDir, 'phase0-push-handoff.json')
const markdownOutputPath = resolve(outputDir, 'phase0-push-handoff.md')
const defaultStageCommand = `git -C "${repoRoot}" add -- "ISSUES.md" ".github/workflows/pro-quality.yml" "apps/pro"`
const defaultCommitMessagePath = resolve(outputDir, 'phase0-commit-message.txt')
const defaultCommitCommand = `git -C "${repoRoot}" commit -F "${defaultCommitMessagePath}"`

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 Push Handoff',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo root: ${report.repoRoot}`,
    `- App root: ${report.appRoot}`,
    `- Branch: ${report.branchName}`,
    `- Git user.name: ${report.gitUserName ?? 'unknown'}`,
    `- Git user.email: ${report.gitUserEmail ?? 'unknown'}`,
    `- Origin remote: ${report.originRemoteUrl ?? 'unknown'}`,
    '',
    '## Step 1',
    '- Environment:',
    `  ${report.repoRoot}`,
    '- Command:',
    `  git -C "${report.repoRoot}" status --short --branch`,
    '- Expected result:',
    '  Review the dirty worktree and confirm the Phase 0 files you intend to publish are the current ones.',
    '- Logs to check on failure:',
    `  ${report.closeoutMarkdownPath}`,
    '',
    '- Recommended review command:',
    `  git -C "${report.repoRoot}" diff --stat -- .github/workflows/pro-quality.yml apps/pro ISSUES.md`,
    '',
    '- Recommended identity check:',
    `  git -C "${report.repoRoot}" config user.name && git -C "${report.repoRoot}" config user.email && git -C "${report.repoRoot}" remote get-url origin`,
    '',
    '## Step 2',
    '- Environment:',
    `  ${report.appRoot}`,
    '- Command:',
    '  npm run phase0:simulate-publish',
    '- Expected result:',
    '  A temporary-index simulation confirms the standard Phase 0 scope can be staged and committed without mutating the real index.',
    '- Logs to check on failure:',
    `  ${report.simulatePublishMarkdownPath}`,
    '',
    '## Step 3',
    '- Environment:',
    `  ${report.appRoot}`,
    '- Command:',
    '  npm run phase0:stage-scope -- --apply',
    '- Expected result:',
    '  The standard Phase 0 scope is staged and phase0-publish-status is refreshed in one step.',
    '- Logs to check on failure:',
    `  ${report.stageScopeMarkdownPath}`,
    '',
    '## Step 4',
    '- Environment:',
    `  ${report.appRoot}`,
    '- Command:',
    '  npm run phase0:publish-status',
    '- Expected result:',
    '  The staged tree is confirmed to contain only the intended Phase 0 publish scope, with no remaining unstaged scoped drift.',
    '- Logs to check on failure:',
    `  ${report.publishStatusMarkdownPath}`,
    '',
    '## Step 5',
    '- Environment:',
    `  ${report.appRoot}`,
    '- Command:',
    '  npm run phase0:commit-dry-run',
    '- Expected result:',
    '  git commit --dry-run succeeds for the staged Phase 0 scope and commit message file.',
    '- Logs to check on failure:',
    `  ${report.commitDryRunMarkdownPath}`,
    '',
    '## Step 6',
    '- Environment:',
    `  ${report.repoRoot}`,
    '- Command:',
    `  ${report.commitCommand ?? defaultCommitCommand}`,
    '- Expected result:',
    '  A single Phase 0 closeout commit is created with the reviewed publish scope.',
    '- Logs to check on failure:',
    `  ${report.commitHandoffMarkdownPath}`,
    '',
    '## Step 7',
    '- Environment:',
    `  ${report.repoRoot}`,
    '- Command:',
    `  git -C "${report.repoRoot}" push origin ${report.branchName}`,
    '- Expected result:',
    '  The current branch is published so the remote repository contains the Pro Quality workflow and Phase 0 scripts.',
    '- Logs to check on failure:',
    `  ${report.closeoutMarkdownPath}`,
    '',
    '## Step 8',
    '- Environment:',
    `  ${report.appRoot}`,
    '- Command:',
    `  npm run phase0:ci-observe -- --ref ${report.branchName}`,
    '- Expected result:',
    '  The Pro Quality workflow dispatches, completes successfully, downloads both expected artifacts, and refreshes CI status plus compare reports.',
    '- Logs to check on failure:',
    `  ${report.ciStatusMarkdownPath}`,
    `  ${report.ciCompareMarkdownPath}`,
    `  ${report.observedRunJsonPath}`,
    '',
    '- Alternate command:',
    '  npm run phase0:ci-observe -- --run-id <existing-run-id>',
    '- Expected result:',
    '  Reuses an already-started manual or remote run for the current branch, then downloads artifacts and refreshes status/compare reports.',
    '- Logs to check on failure:',
    `  ${report.ciStatusMarkdownPath}`,
    '',
    '## Step 9',
    '- Environment:',
    `  ${report.appRoot}`,
    '- Command:',
    '  npm run phase0:closeout',
    '- Expected result:',
    '  The closeout report advances from local-complete / remote-pending to phase0-complete.',
    '- Logs to check on failure:',
    `  ${report.closeoutMarkdownPath}`,
    '',
    '## Optional Step 10',
    '- Environment:',
    `  ${report.appRoot}`,
    '- Command:',
    '  npm run phase0:push-script',
    '- Expected result:',
    '  A reusable Windows PowerShell runbook is generated for the standard Phase 0 push / observe flow.',
    '- Logs to check on failure:',
    `  ${report.pushScriptMarkdownPath}`,
    `  ${report.pushSequenceScriptPath}`,
    '',
    '## Optional Step 11',
    '- Environment:',
    `  ${report.appRoot}`,
    '- Command:',
    '  npm run phase0:push-script-whatif',
    '- Expected result:',
    '  The generated PowerShell runbook completes in WhatIf mode and leaves a first-class dry-run evidence report plus log.',
    '- Logs to check on failure:',
    `  ${report.pushScriptWhatIfMarkdownPath}`,
    `  ${report.pushScriptWhatIfLogPath}`,
    '',
    '## Optional Step 12',
    '- Environment:',
    `  ${report.appRoot}`,
    '- Command:',
    '  npm run phase0:bundle-evidence',
    '- Expected result:',
    '  The latest Phase 0 reports, runbook, and visual artifacts are copied into one closeout bundle directory for review or handoff.',
    '- Logs to check on failure:',
    `  ${report.bundleEvidenceMarkdownPath}`,
    `  ${report.bundleEvidenceDirectoryPath}`,
    '',
    '## Optional Step 13',
    '- Environment:',
    `  ${report.appRoot}`,
    '- Command:',
    '  npm run phase0:bundle-verify',
    '- Expected result:',
    '  The copied Phase 0 closeout bundle payload is hash-verified against the current local evidence manifest before publish or handoff.',
    '- Logs to check on failure:',
    `  ${report.bundleVerifyMarkdownPath}`,
    '',
    '## Optional Step 14',
    '- Environment:',
    `  ${report.appRoot}`,
    '- Command:',
    '  npm run phase0:publish-readiness',
    '- Expected result:',
    '  A single markdown/json summary reports whether local publish, commit, bundle, and remote-observe preconditions are currently satisfied.',
    '- Logs to check on failure:',
    `  ${report.publishReadinessMarkdownPath}`,
  ]

  if (report.blockers.length > 0) {
    lines.push('', '## Current Blockers')
    for (const blocker of report.blockers) {
      lines.push(`- ${blocker}`)
    }
  }

  if (report.publishTargets.length > 0) {
    lines.push('', '## Priority Publish Targets')
    for (const target of report.publishTargets) {
      lines.push(`- [${target.status}] ${target.path}`)
    }
  }

  if (report.stageCommand) {
    lines.push('', '## Recommended Stage Command')
    lines.push(`- ${report.stageCommand}`)
  }

  if (report.changedEntries.length > 0) {
    lines.push('', '## Review Targets')
    for (const entry of report.changedEntries) {
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
const commitHandoff = existsSync(commitHandoffPath) ? readJson(commitHandoffPath) : null
const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  appRoot,
  branchName: closeout.gitSummary?.branchName ?? 'main',
  gitUserName: closeout.gitIdentitySummary?.userName ?? null,
  gitUserEmail: closeout.gitIdentitySummary?.userEmail ?? null,
  originRemoteUrl: closeout.gitIdentitySummary?.remoteUrl ?? null,
  blockers: closeout.blockers ?? [],
  changedEntries: closeout.gitSummary?.changedEntries ?? [],
  publishTargets: (closeout.publishTargets ?? []).filter((target) => target.status !== 'tracked-clean'),
  stageCommand: commitHandoff?.stageCommand ?? defaultStageCommand,
  commitCommand: commitHandoff?.commitCommand ?? defaultCommitCommand,
  closeoutMarkdownPath: resolve(outputDir, 'phase0-closeout.md'),
  commitHandoffMarkdownPath: resolve(outputDir, 'phase0-commit-handoff.md'),
  commitDryRunMarkdownPath: resolve(outputDir, 'phase0-commit-dry-run.md'),
  simulatePublishMarkdownPath: resolve(outputDir, 'phase0-simulate-publish.md'),
  stageScopeMarkdownPath: resolve(outputDir, 'phase0-stage-scope.md'),
  publishStatusMarkdownPath: resolve(outputDir, 'phase0-publish-status.md'),
  ciStatusMarkdownPath: resolve(outputDir, 'phase0-ci-status.md'),
  ciCompareMarkdownPath: resolve(outputDir, 'phase0-ci-compare.md'),
  observedRunJsonPath: resolve(outputDir, 'phase0-ci-observed-run.json'),
  pushScriptMarkdownPath: resolve(outputDir, 'phase0-push-script.md'),
  pushSequenceScriptPath: resolve(outputDir, 'phase0-push-sequence.ps1'),
  bundleEvidenceMarkdownPath: resolve(outputDir, 'phase0-bundle-evidence.md'),
  bundleEvidenceDirectoryPath: resolve(outputDir, 'phase0-closeout-bundle'),
  bundleVerifyMarkdownPath: resolve(outputDir, 'phase0-bundle-verify.md'),
  publishReadinessMarkdownPath: resolve(outputDir, 'phase0-publish-readiness.md'),
  pushScriptWhatIfMarkdownPath: resolve(outputDir, 'phase0-push-script-whatif.md'),
  pushScriptWhatIfLogPath: resolve(outputDir, 'phase0-push-script-whatif.log'),
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(`Phase 0 push handoff written to ${markdownOutputPath}`)
