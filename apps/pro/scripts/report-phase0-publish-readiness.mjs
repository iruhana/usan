import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const closeoutPath = resolve(outputDir, 'phase0-closeout.json')
const verifyStrictReceiptPath = resolve(outputDir, 'verify-strict-receipt.json')
const simulatePublishPath = resolve(outputDir, 'phase0-simulate-publish.json')
const publishStatusPath = resolve(outputDir, 'phase0-publish-status.json')
const commitDryRunPath = resolve(outputDir, 'phase0-commit-dry-run.json')
const pushScriptWhatIfPath = resolve(outputDir, 'phase0-push-script-whatif.json')
const evidenceManifestPath = resolve(outputDir, 'phase0-evidence-manifest.json')
const bundleEvidencePath = resolve(outputDir, 'phase0-bundle-evidence.json')
const bundleVerifyPath = resolve(outputDir, 'phase0-bundle-verify.json')
const jsonOutputPath = resolve(outputDir, 'phase0-publish-readiness.json')
const markdownOutputPath = resolve(outputDir, 'phase0-publish-readiness.md')
const requiredPreflightStrictReceiptSteps = ['phase0:simulate-publish', 'phase0:publish-status', 'phase0:commit-dry-run']
const requiredEvidenceStrictReceiptSteps = ['phase0:push-script-whatif', 'phase0:evidence-manifest', 'phase0:bundle-evidence', 'phase0:bundle-verify']

function parseTimestamp(value) {
  if (typeof value !== 'string') {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function summarizeCheck(id, label, passed, status, detail, nextStep = null) {
  return { id, label, passed, status, detail, nextStep }
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 Publish Readiness',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo root: ${report.repoRoot}`,
    `- App root: ${report.appRoot}`,
    `- Branch: ${report.branchName}`,
    `- Status: ${report.status}`,
    `- Ready to stage now: ${report.readyToStage ? 'yes' : 'no'}`,
    `- Ready to commit now: ${report.readyToCommitNow ? 'yes' : 'no'}`,
    `- Ready for remote observe now: ${report.readyToObserveNow ? 'yes' : 'no'}`,
    `- Remote confirmation ready: ${report.remoteConfirmationReady ? 'yes' : 'no'}`,
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
    lines.push(`- [${check.passed ? 'PASS' : 'PENDING'}] ${check.label}: ${check.detail}`)
    if (check.nextStep) {
      lines.push(`  Next: ${check.nextStep}`)
    }
  }

  lines.push('', '## Evidence')
  for (const path of report.evidencePaths) {
    lines.push(`- ${path}`)
  }

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  appRoot,
  branchName: 'main',
  status: 'phase0-publish-readiness-incomplete',
  readyToStage: false,
  readyToCommitNow: false,
  readyToObserveNow: false,
  remoteConfirmationReady: false,
  checks: [],
  blockers: [],
  nextSteps: [],
  evidencePaths: [],
}

  if (
    !existsSync(closeoutPath)
    || !existsSync(verifyStrictReceiptPath)
    || !existsSync(simulatePublishPath)
    || !existsSync(publishStatusPath)
    || !existsSync(commitDryRunPath)
    || !existsSync(pushScriptWhatIfPath)
    || !existsSync(evidenceManifestPath)
    || !existsSync(bundleEvidencePath)
    || !existsSync(bundleVerifyPath)
) {
  report.blockers.push('One or more publish-readiness evidence files are missing.')
  report.nextSteps.push('Run `npm run verify:strict` to regenerate the full Phase 0 readiness evidence set.')
} else {
  const closeout = readJson(closeoutPath)
  const verifyStrictReceipt = readJson(verifyStrictReceiptPath)
  const simulatePublish = readJson(simulatePublishPath)
  const publishStatus = readJson(publishStatusPath)
  const commitDryRun = readJson(commitDryRunPath)
  const pushScriptWhatIf = readJson(pushScriptWhatIfPath)
  const evidenceManifest = readJson(evidenceManifestPath)
  const bundleEvidence = readJson(bundleEvidencePath)
  const bundleVerify = readJson(bundleVerifyPath)
  const receiptCommandIds = new Set((verifyStrictReceipt.commands ?? []).map((command) => command.id))
  const missingPreflightReceiptSteps = requiredPreflightStrictReceiptSteps.filter((id) => !receiptCommandIds.has(id))
  const missingEvidenceReceiptSteps = requiredEvidenceStrictReceiptSteps.filter((id) => !receiptCommandIds.has(id))
  const strictPreflightCoveragePassed = Boolean(verifyStrictReceipt.passed) && missingPreflightReceiptSteps.length === 0
  const strictEvidenceCoveragePassed = Boolean(verifyStrictReceipt.passed) && missingEvidenceReceiptSteps.length === 0
  const strictReceiptCommandMap = new Map((verifyStrictReceipt.commands ?? []).map((command) => [command.id, command]))
  const preflightFreshnessChecks = [
    { id: 'phase0:simulate-publish', label: 'phase0-simulate-publish.json', report: simulatePublish },
    { id: 'phase0:publish-status', label: 'phase0-publish-status.json', report: publishStatus },
    { id: 'phase0:commit-dry-run', label: 'phase0-commit-dry-run.json', report: commitDryRun },
  ].map((entry) => {
    const command = strictReceiptCommandMap.get(entry.id)
    const commandStartedAt = parseTimestamp(command?.startedAt)
    const reportGeneratedAt = parseTimestamp(entry.report?.generatedAt)

    if (commandStartedAt === null || reportGeneratedAt === null) {
      return {
        ...entry,
        passed: false,
        detail: `${entry.label} is missing a valid generatedAt or strict receipt startedAt timestamp.`,
      }
    }

    if (reportGeneratedAt < commandStartedAt) {
      return {
        ...entry,
        passed: false,
        detail: `${entry.label} predates ${entry.id} in verify-strict receipt.`,
      }
    }

    return {
      ...entry,
      passed: true,
      detail: `${entry.label} was regenerated after ${entry.id} started in verify:strict.`,
    }
  })
  const evidenceFreshnessChecks = [
    { id: 'phase0:push-script-whatif', label: 'phase0-push-script-whatif.json', report: pushScriptWhatIf },
    { id: 'phase0:evidence-manifest', label: 'phase0-evidence-manifest.json', report: evidenceManifest },
    { id: 'phase0:bundle-evidence', label: 'phase0-bundle-evidence.json', report: bundleEvidence },
    { id: 'phase0:bundle-verify', label: 'phase0-bundle-verify.json', report: bundleVerify },
  ].map((entry) => {
    const command = strictReceiptCommandMap.get(entry.id)
    const commandStartedAt = parseTimestamp(command?.startedAt)
    const reportGeneratedAt = parseTimestamp(entry.report?.generatedAt)

    if (commandStartedAt === null || reportGeneratedAt === null) {
      return {
        ...entry,
        passed: false,
        detail: `${entry.label} is missing a valid generatedAt or strict receipt startedAt timestamp.`,
      }
    }

    if (reportGeneratedAt < commandStartedAt) {
      return {
        ...entry,
        passed: false,
        detail: `${entry.label} predates ${entry.id} in verify-strict receipt.`,
      }
    }

    return {
      ...entry,
      passed: true,
      detail: `${entry.label} was regenerated after ${entry.id} started in verify:strict.`,
    }
  })
  const strictPreflightFreshnessPassed = strictPreflightCoveragePassed && preflightFreshnessChecks.every((check) => check.passed)
  const strictEvidenceFreshnessPassed = strictEvidenceCoveragePassed && evidenceFreshnessChecks.every((check) => check.passed)
  const failedPreflightFreshnessChecks = preflightFreshnessChecks.filter((check) => !check.passed)
  const failedEvidenceFreshnessChecks = evidenceFreshnessChecks.filter((check) => !check.passed)

  report.branchName = closeout.gitSummary?.branchName ?? 'main'
  report.remoteConfirmationReady = Boolean(closeout.remoteConfirmationReady)
  report.readyToStage = Boolean(simulatePublish.simulatedReady)
  report.readyToCommitNow = Boolean(publishStatus.readyToCommit && commitDryRun.readyToCommit)
  report.readyToObserveNow = report.readyToCommitNow && Boolean(closeout.gitSummary?.hasUpstream)

  report.checks.push(
    summarizeCheck(
      'local-readiness',
      'Local strict gate',
      Boolean(closeout.localReadinessPassed),
      closeout.localReadinessPassed ? 'pass' : 'fail',
      closeout.localReadinessPassed ? 'verify:strict is passing locally.' : 'Local strict gate is not currently passing.',
      closeout.localReadinessPassed ? null : 'Run `npm run verify:strict` and fix the failing checks.',
    ),
    summarizeCheck(
      'strict-receipt-coverage',
      'Strict receipt coverage',
      strictPreflightCoveragePassed,
      strictPreflightCoveragePassed ? 'pass' : 'fail',
      strictPreflightCoveragePassed
        ? `verify:strict receipt includes ${requiredPreflightStrictReceiptSteps.join(', ')}.`
        : `verify:strict receipt is missing ${missingPreflightReceiptSteps.join(', ')}.`,
      strictPreflightCoveragePassed ? null : 'Run `npm run verify:strict` so the receipt captures the full publish preflight sequence.',
    ),
    summarizeCheck(
      'strict-receipt-freshness',
      'Strict preflight freshness',
      strictPreflightFreshnessPassed,
      strictPreflightFreshnessPassed ? 'pass' : 'fail',
      strictPreflightFreshnessPassed
        ? 'Publish preflight evidence was regenerated during the latest verify:strict run.'
        : failedPreflightFreshnessChecks.map((check) => check.detail).join(' '),
      strictPreflightFreshnessPassed ? null : 'Run `npm run verify:strict` to regenerate publish preflight evidence from the current strict pipeline.',
    ),
    summarizeCheck(
      'strict-evidence-packaging-coverage',
      'Strict evidence packaging coverage',
      strictEvidenceCoveragePassed,
      strictEvidenceCoveragePassed ? 'pass' : 'fail',
      strictEvidenceCoveragePassed
        ? `verify:strict receipt includes ${requiredEvidenceStrictReceiptSteps.join(', ')}.`
        : `verify:strict receipt is missing ${missingEvidenceReceiptSteps.join(', ')}.`,
      strictEvidenceCoveragePassed ? null : 'Run `npm run verify:strict` so the receipt captures evidence manifest and bundle generation.',
    ),
    summarizeCheck(
      'strict-evidence-packaging-freshness',
      'Strict evidence packaging freshness',
      strictEvidenceFreshnessPassed,
      strictEvidenceFreshnessPassed ? 'pass' : 'fail',
      strictEvidenceFreshnessPassed
        ? 'Evidence manifest, bundle report, and bundle verify outputs were regenerated during the latest verify:strict run.'
        : failedEvidenceFreshnessChecks.map((check) => check.detail).join(' '),
      strictEvidenceFreshnessPassed ? null : 'Run `npm run verify:strict` to regenerate evidence packaging outputs from the current strict pipeline.',
    ),
    summarizeCheck(
      'push-script-whatif',
      'PowerShell runbook WhatIf',
      pushScriptWhatIf.status === 'phase0-push-script-whatif-ready',
      pushScriptWhatIf.status,
      pushScriptWhatIf.status === 'phase0-push-script-whatif-ready'
        ? 'Generated PowerShell runbook completed successfully in WhatIf mode.'
        : (pushScriptWhatIf.blockers?.[0] ?? 'Generated PowerShell runbook WhatIf validation is incomplete.'),
      pushScriptWhatIf.status === 'phase0-push-script-whatif-ready'
        ? null
        : (pushScriptWhatIf.nextSteps?.[0] ?? 'Run `npm run phase0:push-script-whatif` and review the generated log.'),
    ),
    summarizeCheck(
      'bundle-verify',
      'Bundle payload verify',
      bundleVerify.status === 'phase0-bundle-verify-ready' || bundleVerify.status === 'phase0-bundle-verify-local-ready-remote-pending',
      bundleVerify.status,
      bundleVerify.status === 'phase0-bundle-verify-ready'
        ? 'Bundle payload matches the local evidence manifest.'
        : bundleVerify.status === 'phase0-bundle-verify-local-ready-remote-pending'
          ? 'Bundle payload matches the local evidence manifest; remote observation evidence is still pending.'
          : (bundleVerify.blockers?.[0] ?? 'Bundle payload verification is incomplete.'),
      bundleVerify.status === 'phase0-bundle-verify-ready' || bundleVerify.status === 'phase0-bundle-verify-local-ready-remote-pending'
        ? null
        : (bundleVerify.nextSteps?.[0] ?? 'Regenerate and re-verify the Phase 0 bundle payload.'),
    ),
    summarizeCheck(
      'simulate-publish',
      'Simulated publish path',
      Boolean(simulatePublish.simulatedReady),
      simulatePublish.status,
      simulatePublish.status === 'phase0-simulate-publish-clean-tree'
        ? 'Temporary-index simulation confirms the committed tree is already clean for the standard Phase 0 publish scope.'
        : simulatePublish.simulatedReady
          ? `Temporary-index simulation is clean with ${simulatePublish.simulatedStagedEntries?.length ?? 0} staged entries.`
        : 'Temporary-index simulation is blocked.',
      simulatePublish.simulatedReady ? null : 'Inspect phase0-simulate-publish.md and clear the simulated publish blockers.',
    ),
    summarizeCheck(
      'real-stage',
      'Real staged tree',
      Boolean(publishStatus.readyToCommit),
      publishStatus.status,
      publishStatus.readyToCommit
        ? 'The real git index is already staged and ready for commit.'
        : `Real git index is not ready: ${publishStatus.stagedScopedEntries?.length ?? 0} staged scoped, ${publishStatus.unstagedScopedEntries?.length ?? 0} unstaged scoped, ${publishStatus.untrackedScopedEntries?.length ?? 0} untracked scoped.`,
      publishStatus.readyToCommit ? null : (publishStatus.stageCommand ?? 'Run the recommended stage command and regenerate publish-status.'),
    ),
    summarizeCheck(
      'commit-dry-run',
      'Commit dry run',
      Boolean(commitDryRun.readyToCommit),
      commitDryRun.status,
      commitDryRun.readyToCommit ? 'git commit --dry-run is ready to succeed.' : 'git commit --dry-run is not ready yet.',
      commitDryRun.readyToCommit ? null : (commitDryRun.nextSteps?.[0] ?? 'Stage the Phase 0 scope and rerun the commit dry run.'),
    ),
    summarizeCheck(
      'bundle-evidence',
      'Evidence bundle',
      bundleEvidence.status === 'phase0-bundle-ready' || bundleEvidence.status === 'phase0-bundle-local-ready-remote-pending',
      bundleEvidence.status,
      bundleEvidence.status === 'phase0-bundle-ready'
        ? 'Local and remote evidence are bundled.'
        : bundleEvidence.status === 'phase0-bundle-local-ready-remote-pending'
          ? 'Local evidence bundle is complete; remote observation evidence is still pending.'
          : 'Evidence bundle is incomplete.',
      bundleEvidence.status === 'phase0-bundle-ready' || bundleEvidence.status === 'phase0-bundle-local-ready-remote-pending'
        ? null
        : (bundleEvidence.nextSteps?.[0] ?? 'Regenerate the evidence bundle.'),
    ),
    summarizeCheck(
      'remote-confirmation',
      'Remote confirmation',
      Boolean(closeout.remoteConfirmationReady),
      closeout.status,
      closeout.remoteConfirmationReady
        ? 'Remote workflow observation is complete.'
        : 'Remote workflow observation is still pending.',
      closeout.remoteConfirmationReady ? null : 'Push the branch and run `npm run phase0:ci-observe -- --ref main`.',
    ),
  )

  report.evidencePaths = [
    closeoutPath,
    verifyStrictReceiptPath,
    simulatePublishPath,
    publishStatusPath,
    commitDryRunPath,
    pushScriptWhatIfPath,
    evidenceManifestPath,
    bundleEvidencePath,
    bundleVerifyPath,
  ]

  if (!closeout.localReadinessPassed) {
    report.blockers.push('Local Phase 0 strict gate is not passing.')
  }

  if (!strictPreflightCoveragePassed) {
    report.blockers.push('Strict receipt does not include the full publish preflight coverage yet.')
  }

  if (!strictPreflightFreshnessPassed) {
    report.blockers.push('Publish preflight evidence is stale relative to the latest strict receipt.')
  }

  if (!strictEvidenceCoveragePassed) {
    report.blockers.push('Strict receipt does not include evidence packaging coverage yet.')
  }

  if (!strictEvidenceFreshnessPassed) {
    report.blockers.push('Evidence packaging outputs are stale relative to the latest strict receipt.')
  }

  if (!simulatePublish.simulatedReady) {
    report.blockers.push('Simulated publish path is blocked.')
  }

  if (!publishStatus.readyToCommit) {
    report.blockers.push('Real git index is not staged for commit yet.')
  }

  if (!commitDryRun.readyToCommit) {
    report.blockers.push('Commit dry run is not ready yet.')
  }

  if (pushScriptWhatIf.status !== 'phase0-push-script-whatif-ready') {
    report.blockers.push('PowerShell runbook WhatIf validation is incomplete.')
  }

  if (!(bundleEvidence.status === 'phase0-bundle-ready' || bundleEvidence.status === 'phase0-bundle-local-ready-remote-pending')) {
    report.blockers.push('Evidence bundle is incomplete.')
  }

  if (!(bundleVerify.status === 'phase0-bundle-verify-ready' || bundleVerify.status === 'phase0-bundle-verify-local-ready-remote-pending')) {
    report.blockers.push('Evidence bundle verification is incomplete.')
  }

  if (!closeout.remoteConfirmationReady) {
    report.nextSteps.push('Push the Phase 0 scope, run `npm run phase0:ci-observe`, then rerun `npm run phase0:closeout`.')
  }

  if (!publishStatus.readyToCommit) {
    report.nextSteps.push(`Stage the standard Phase 0 scope with: ${publishStatus.stageCommand}`)
  }

  if (
    closeout.localReadinessPassed
    && strictPreflightCoveragePassed
    && strictPreflightFreshnessPassed
    && strictEvidenceCoveragePassed
    && strictEvidenceFreshnessPassed
    && simulatePublish.simulatedReady
    && pushScriptWhatIf.status === 'phase0-push-script-whatif-ready'
    && !publishStatus.readyToCommit
    && bundleEvidence.status === 'phase0-bundle-local-ready-remote-pending'
    && bundleVerify.status === 'phase0-bundle-verify-local-ready-remote-pending'
  ) {
    report.status = 'phase0-publish-prepared-local-only'
  } else if (
    closeout.localReadinessPassed
    && strictPreflightCoveragePassed
    && strictPreflightFreshnessPassed
    && strictEvidenceCoveragePassed
    && strictEvidenceFreshnessPassed
    && pushScriptWhatIf.status === 'phase0-push-script-whatif-ready'
    && publishStatus.readyToCommit
    && commitDryRun.readyToCommit
    && bundleVerify.status === 'phase0-bundle-verify-local-ready-remote-pending'
    && !closeout.remoteConfirmationReady
  ) {
    report.status = 'phase0-publish-ready-for-remote'
  } else if (
    closeout.localReadinessPassed
    && strictPreflightCoveragePassed
    && strictPreflightFreshnessPassed
    && strictEvidenceCoveragePassed
    && strictEvidenceFreshnessPassed
    && pushScriptWhatIf.status === 'phase0-push-script-whatif-ready'
    && bundleVerify.status === 'phase0-bundle-verify-ready'
    && closeout.remoteConfirmationReady
  ) {
    report.status = 'phase0-publish-complete'
  }
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(`Phase 0 publish readiness written to ${markdownOutputPath}`)
