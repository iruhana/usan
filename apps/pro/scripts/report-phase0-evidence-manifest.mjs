import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const visualDir = resolve(appRoot, 'output', 'playwright', 'electron-smoke')
const jsonOutputPath = resolve(outputDir, 'phase0-evidence-manifest.json')
const markdownOutputPath = resolve(outputDir, 'phase0-evidence-manifest.md')
const closeoutPath = resolve(outputDir, 'phase0-closeout.json')
const ciStatusPath = resolve(outputDir, 'phase0-ci-status.json')
const localEvidenceFiles = [
  'phase0-readiness.json',
  'phase0-readiness.md',
  'verify-strict-receipt.json',
  'verify-strict-receipt.md',
  'phase0-closeout.json',
  'phase0-closeout.md',
  'phase0-commit-handoff.json',
  'phase0-commit-handoff.md',
  'phase0-commit-message.txt',
  'phase0-commit-dry-run.json',
  'phase0-commit-dry-run.md',
  'phase0-publish-status.json',
  'phase0-publish-status.md',
  'phase0-simulate-publish.json',
  'phase0-simulate-publish.md',
  'phase0-push-handoff.json',
  'phase0-push-handoff.md',
  'phase0-push-script.json',
  'phase0-push-script.md',
  'phase0-push-sequence.ps1',
  'phase0-push-script-whatif.json',
  'phase0-push-script-whatif.md',
  'phase0-push-script-whatif.log',
]
const optionalLocalEvidenceFiles = [
  'phase0-stage-scope.json',
  'phase0-stage-scope.md',
  'phase0-publish-readiness.json',
  'phase0-publish-readiness.md',
]
const remoteObservationEvidenceFiles = [
  'phase0-ci-status.json',
  'phase0-ci-status.md',
  'phase0-ci-compare.json',
  'phase0-ci-compare.md',
  'phase0-ci-observed-run.json',
]

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function listFilesRecursively(rootPath) {
  const entries = readdirSync(rootPath, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const absolutePath = resolve(rootPath, entry.name)
    if (entry.isDirectory()) {
      return listFilesRecursively(absolutePath)
    }

    return [absolutePath]
  })
}

function buildRecord(absolutePath, scope) {
  const stats = statSync(absolutePath)
  return {
    scope,
    relativePath: relative(appRoot, absolutePath).replace(/\\/g, '/'),
    size: stats.size,
    sha256: hashFile(absolutePath),
  }
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 Evidence Manifest',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo root: ${report.repoRoot}`,
    `- App root: ${report.appRoot}`,
    `- Status: ${report.status}`,
    `- Evidence files: ${report.evidenceFiles.length}`,
    `- Visual files: ${report.visualFiles.length}`,
    `- Missing required files: ${report.missingRequiredFiles.length}`,
    `- Pending files: ${report.pendingFiles.length}`,
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

  if (report.pendingFiles.length > 0) {
    lines.push('', '## Pending Files')
    for (const relativePath of report.pendingFiles) {
      lines.push(`- ${relativePath}`)
    }
  }

  if (report.evidenceFiles.length > 0) {
    lines.push('', '## Evidence Files')
    for (const record of report.evidenceFiles) {
      lines.push(`- ${record.relativePath} (${record.size} bytes, ${record.sha256})`)
    }
  }

  if (report.visualFiles.length > 0) {
    lines.push('', '## Visual Files')
    for (const record of report.visualFiles) {
      lines.push(`- ${record.relativePath} (${record.size} bytes, ${record.sha256})`)
    }
  }

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })

const closeout = existsSync(closeoutPath) ? readJson(closeoutPath) : null
const ciStatus = existsSync(ciStatusPath) ? readJson(ciStatusPath) : null
const remoteObservationPending = closeout?.status === 'phase0-local-complete-remote-pending'
  || closeout?.remoteConfirmationReady === false
  || !existsSync(ciStatusPath)
  || ciStatus?.ready === false

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  appRoot,
  status: 'phase0-evidence-manifest-ready',
  evidenceFiles: [],
  visualFiles: [],
  missingRequiredFiles: [],
  pendingFiles: [],
  blockers: [],
  nextSteps: [],
}

for (const relativePath of localEvidenceFiles) {
  const absolutePath = resolve(outputDir, relativePath)
  if (!existsSync(absolutePath)) {
    report.missingRequiredFiles.push(relativePath)
    continue
  }

  report.evidenceFiles.push(buildRecord(absolutePath, 'phase0-readiness'))
}

for (const relativePath of optionalLocalEvidenceFiles) {
  const absolutePath = resolve(outputDir, relativePath)
  if (!existsSync(absolutePath)) {
    continue
  }

  report.evidenceFiles.push(buildRecord(absolutePath, 'phase0-readiness'))
}

for (const relativePath of remoteObservationEvidenceFiles) {
  const absolutePath = resolve(outputDir, relativePath)
  if (!existsSync(absolutePath)) {
    if (remoteObservationPending) {
      report.pendingFiles.push(relativePath)
      continue
    }

    report.missingRequiredFiles.push(relativePath)
    continue
  }

  report.evidenceFiles.push(buildRecord(absolutePath, 'phase0-readiness'))
}

if (!existsSync(visualDir)) {
  report.status = 'phase0-evidence-manifest-incomplete'
  report.blockers.push('Electron smoke output directory is missing.')
  report.nextSteps.push('Run `npm run test:e2e:electron:compiled` or `npm run verify:strict` to regenerate the visual evidence.')
} else {
  for (const absolutePath of listFilesRecursively(visualDir)) {
    report.visualFiles.push(buildRecord(absolutePath, 'electron-smoke'))
  }
}

if (report.missingRequiredFiles.length > 0) {
  report.status = 'phase0-evidence-manifest-incomplete'
  report.blockers.push('Some required Phase 0 evidence files are missing.')
  report.nextSteps.push('Run `npm run verify:strict` to regenerate the missing evidence files before packaging or comparing artifacts.')
}

if (report.missingRequiredFiles.length === 0 && report.pendingFiles.length > 0) {
  report.status = 'phase0-evidence-manifest-local-ready-remote-pending'
  report.nextSteps.push('Complete one successful remote Phase 0 observation run to populate the pending remote evidence file.')
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(`Phase 0 evidence manifest written to ${markdownOutputPath}`)
