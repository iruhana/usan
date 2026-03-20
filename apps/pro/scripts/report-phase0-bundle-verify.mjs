import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const evidenceManifestPath = resolve(outputDir, 'phase0-evidence-manifest.json')
const bundleEvidencePath = resolve(outputDir, 'phase0-bundle-evidence.json')
const bundleManifestPath = resolve(outputDir, 'phase0-closeout-bundle', 'bundle-manifest.json')
const bundleRoot = resolve(outputDir, 'phase0-closeout-bundle')
const bundlePayloadRoot = resolve(bundleRoot, 'payload')
const jsonOutputPath = resolve(outputDir, 'phase0-bundle-verify.json')
const markdownOutputPath = resolve(outputDir, 'phase0-bundle-verify.md')
const evidencePrefix = 'output/phase0-readiness/'
const visualPrefix = 'output/playwright/electron-smoke/'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function mapSourceToBundleRelativePath(sourceRelativePath) {
  if (sourceRelativePath.startsWith(visualPrefix)) {
    return `playwright/electron-smoke/${sourceRelativePath.slice(visualPrefix.length)}`
  }

  return null
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 Bundle Verify',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo root: ${report.repoRoot}`,
    `- App root: ${report.appRoot}`,
    `- Bundle root: ${report.bundleRoot}`,
    `- Payload root: ${report.bundlePayloadRoot}`,
    `- Status: ${report.status}`,
    `- Verified files: ${report.verifiedFiles.length}`,
    `- Missing bundle files: ${report.missingBundleFiles.length}`,
    `- Mismatched files: ${report.mismatchedFiles.length}`,
    `- Pending remote files: ${report.pendingFiles.length}`,
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

  lines.push('', '## Manifest Checks')
  for (const check of report.manifestChecks) {
    lines.push(`- [${check.passed ? 'PASS' : 'FAIL'}] ${check.label}: ${check.detail}`)
  }

  if (report.pendingFiles.length > 0) {
    lines.push('', '## Pending Remote Files')
    for (const relativePath of report.pendingFiles) {
      lines.push(`- ${relativePath}`)
    }
  }

  if (report.verifiedFiles.length > 0) {
    lines.push('', '## Verified Files')
    for (const file of report.verifiedFiles) {
      lines.push(`- ${file.sourceRelativePath} -> ${file.bundleRelativePath} (${file.sha256})`)
    }
  }

  if (report.missingBundleFiles.length > 0) {
    lines.push('', '## Missing Bundle Files')
    for (const file of report.missingBundleFiles) {
      lines.push(`- ${file.sourceRelativePath} -> ${file.bundleRelativePath}`)
    }
  }

  if (report.mismatchedFiles.length > 0) {
    lines.push('', '## Mismatched Files')
    for (const file of report.mismatchedFiles) {
      lines.push(`- ${file.sourceRelativePath} -> ${file.bundleRelativePath} (expected ${file.expectedSha256}, got ${file.actualSha256 ?? 'missing'})`)
    }
  }

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  appRoot,
  bundleRoot,
  bundlePayloadRoot,
  status: 'phase0-bundle-verify-ready',
  verifiedFiles: [],
  missingBundleFiles: [],
  mismatchedFiles: [],
  pendingFiles: [],
  manifestChecks: [],
  blockers: [],
  nextSteps: [],
}

if (!existsSync(evidenceManifestPath) || !existsSync(bundleEvidencePath) || !existsSync(bundleManifestPath)) {
  report.status = 'phase0-bundle-verify-incomplete'
  report.blockers.push('Bundle verification prerequisites are missing.')
  report.nextSteps.push('Run `npm run verify:strict` to regenerate the evidence manifest, bundle report, and bundle manifest before verifying the payload.')
} else {
  const evidenceManifest = readJson(evidenceManifestPath)
  const bundleEvidence = readJson(bundleEvidencePath)
  const bundleManifest = readJson(bundleManifestPath)
  const remoteObservationPending = bundleEvidence.status === 'phase0-bundle-local-ready-remote-pending'
    || (bundleEvidence.pendingFiles?.length ?? 0) > 0

  report.pendingFiles = bundleEvidence.pendingFiles ?? []

  report.manifestChecks.push(
    {
      id: 'bundle-manifest-file-count',
      label: 'Bundle manifest file count parity',
      passed: bundleManifest.fileCount === (bundleEvidence.includedFiles?.length ?? 0),
      detail: `manifest=${bundleManifest.fileCount} included=${bundleEvidence.includedFiles?.length ?? 0}`,
    },
    {
      id: 'bundle-manifest-directory-count',
      label: 'Bundle manifest directory count parity',
      passed: bundleManifest.directoryCount === (bundleEvidence.includedDirectories?.length ?? 0),
      detail: `manifest=${bundleManifest.directoryCount} included=${bundleEvidence.includedDirectories?.length ?? 0}`,
    },
    {
      id: 'bundle-manifest-pending-count',
      label: 'Bundle manifest pending count parity',
      passed: bundleManifest.pendingFileCount === (bundleEvidence.pendingFiles?.length ?? 0),
      detail: `manifest=${bundleManifest.pendingFileCount} pending=${bundleEvidence.pendingFiles?.length ?? 0}`,
    },
  )

  for (const entry of bundleEvidence.includedFiles ?? []) {
    const sourcePath = resolve(outputDir, entry.relativePath)
    if (!existsSync(sourcePath)) {
      report.missingBundleFiles.push({
        sourceRelativePath: `${evidencePrefix}${entry.relativePath}`,
        bundleRelativePath: entry.relativePath,
      })
      continue
    }

    const bundlePath = entry.bundlePath
    if (!existsSync(bundlePath)) {
      report.missingBundleFiles.push({
        sourceRelativePath: `${evidencePrefix}${entry.relativePath}`,
        bundleRelativePath: entry.relativePath,
      })
      continue
    }

    const sourceStats = statSync(sourcePath)
    const sourceSha256 = hashFile(sourcePath)
    const actualStats = statSync(bundlePath)
    const actualSha256 = hashFile(bundlePath)
    if (actualSha256 !== sourceSha256 || actualStats.size !== sourceStats.size) {
      report.mismatchedFiles.push({
        sourceRelativePath: `${evidencePrefix}${entry.relativePath}`,
        bundleRelativePath: entry.relativePath,
        expectedSha256: sourceSha256,
        actualSha256,
        expectedSize: sourceStats.size,
        actualSize: actualStats.size,
      })
      continue
    }

    report.verifiedFiles.push({
      sourceRelativePath: `${evidencePrefix}${entry.relativePath}`,
      bundleRelativePath: entry.relativePath,
      sha256: actualSha256,
      size: actualStats.size,
    })
  }

  for (const record of evidenceManifest.visualFiles ?? []) {
    const bundleRelativePath = mapSourceToBundleRelativePath(record.relativePath)
    if (!bundleRelativePath) {
      report.missingBundleFiles.push({
        sourceRelativePath: record.relativePath,
        bundleRelativePath: 'unmapped',
      })
      continue
    }

    const bundlePath = resolve(bundlePayloadRoot, ...bundleRelativePath.split('/'))
    if (!existsSync(bundlePath)) {
      report.missingBundleFiles.push({
        sourceRelativePath: record.relativePath,
        bundleRelativePath,
      })
      continue
    }

    const actualStats = statSync(bundlePath)
    const actualSha256 = hashFile(bundlePath)
    if (actualSha256 !== record.sha256 || actualStats.size !== record.size) {
      report.mismatchedFiles.push({
        sourceRelativePath: record.relativePath,
        bundleRelativePath,
        expectedSha256: record.sha256,
        actualSha256,
        expectedSize: record.size,
        actualSize: actualStats.size,
      })
      continue
    }

    report.verifiedFiles.push({
      sourceRelativePath: record.relativePath,
      bundleRelativePath,
      sha256: actualSha256,
      size: actualStats.size,
    })
  }

  const failedManifestChecks = report.manifestChecks.filter((check) => !check.passed)
  if (failedManifestChecks.length > 0 || report.missingBundleFiles.length > 0 || report.mismatchedFiles.length > 0) {
    report.status = 'phase0-bundle-verify-incomplete'
    if (failedManifestChecks.length > 0) {
      report.blockers.push('Bundle manifest counts do not match the bundle report.')
    }
    if (report.missingBundleFiles.length > 0) {
      report.blockers.push('Some expected bundle payload files are missing.')
    }
    if (report.mismatchedFiles.length > 0) {
      report.blockers.push('Some copied bundle payload files do not match the local evidence hashes.')
    }
    report.nextSteps.push('Run `npm run phase0:bundle-evidence` or `npm run verify:strict` to regenerate the local bundle payload before publishing it.')
  } else if (remoteObservationPending) {
    report.status = 'phase0-bundle-verify-local-ready-remote-pending'
    report.nextSteps.push('Complete one successful remote Phase 0 observation run to replace the pending remote bundle evidence.')
  }
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(`Phase 0 bundle verify written to ${markdownOutputPath}`)
