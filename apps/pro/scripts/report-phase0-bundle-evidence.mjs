import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const jsonOutputPath = resolve(outputDir, 'phase0-bundle-evidence.json')
const markdownOutputPath = resolve(outputDir, 'phase0-bundle-evidence.md')
const bundleRoot = resolve(outputDir, 'phase0-closeout-bundle')
const bundlePayloadRoot = resolve(bundleRoot, 'payload')
const closeoutPath = resolve(outputDir, 'phase0-closeout.json')
const ciStatusPath = resolve(outputDir, 'phase0-ci-status.json')
const localEvidenceEntries = [
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
  'phase0-stage-scope.json',
  'phase0-stage-scope.md',
  'phase0-push-handoff.json',
  'phase0-push-handoff.md',
  'phase0-push-script.json',
  'phase0-push-script.md',
  'phase0-push-sequence.ps1',
  'phase0-push-script-whatif.json',
  'phase0-push-script-whatif.md',
  'phase0-push-script-whatif.log',
  'phase0-publish-readiness.json',
  'phase0-publish-readiness.md',
  'phase0-evidence-manifest.json',
  'phase0-evidence-manifest.md',
]
const remoteObservationEvidenceEntries = [
  'phase0-ci-status.json',
  'phase0-ci-status.md',
  'phase0-ci-compare.json',
  'phase0-ci-compare.md',
  'phase0-ci-observed-run.json',
]
const directoryEntries = [
  {
    source: resolve(appRoot, 'output', 'playwright', 'electron-smoke'),
    destination: resolve(bundlePayloadRoot, 'playwright', 'electron-smoke'),
    id: 'electron-smoke',
  },
]

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function copyEntry(sourcePath, destinationPath) {
  ensureDirectory(dirname(destinationPath))
  copyFileSync(sourcePath, destinationPath)
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 Evidence Bundle',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo root: ${report.repoRoot}`,
    `- App root: ${report.appRoot}`,
    `- Bundle root: ${report.bundleRoot}`,
    `- Payload root: ${report.bundlePayloadRoot}`,
    `- Status: ${report.status}`,
    `- Included files: ${report.includedFiles.length}`,
    `- Missing files: ${report.missingFiles.length}`,
    `- Pending files: ${report.pendingFiles.length}`,
    `- Included directories: ${report.includedDirectories.length}`,
    `- Missing directories: ${report.missingDirectories.length}`,
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

  if (report.includedFiles.length > 0) {
    lines.push('', '## Included Files')
    for (const entry of report.includedFiles) {
      lines.push(`- ${entry.relativePath} -> ${entry.bundlePath}`)
    }
  }

  if (report.includedDirectories.length > 0) {
    lines.push('', '## Included Directories')
    for (const entry of report.includedDirectories) {
      lines.push(`- ${entry.id}: ${entry.relativePath} -> ${entry.bundlePath}`)
    }
  }

  if (report.missingFiles.length > 0) {
    lines.push('', '## Missing Files')
    for (const relativePath of report.missingFiles) {
      lines.push(`- ${relativePath}`)
    }
  }

  if (report.pendingFiles.length > 0) {
    lines.push('', '## Pending Files')
    for (const relativePath of report.pendingFiles) {
      lines.push(`- ${relativePath}`)
    }
  }

  if (report.missingDirectories.length > 0) {
    lines.push('', '## Missing Directories')
    for (const entry of report.missingDirectories) {
      lines.push(`- ${entry.id}: ${entry.relativePath}`)
    }
  }

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })
rmSync(bundleRoot, { recursive: true, force: true })
ensureDirectory(bundlePayloadRoot)

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
  bundleRoot,
  bundlePayloadRoot,
  status: 'phase0-bundle-ready',
  includedFiles: [],
  missingFiles: [],
  pendingFiles: [],
  includedDirectories: [],
  missingDirectories: [],
  blockers: [],
  nextSteps: [],
}

for (const relativePath of localEvidenceEntries) {
  const sourcePath = resolve(outputDir, relativePath)
  if (!existsSync(sourcePath)) {
    report.missingFiles.push(relativePath)
    continue
  }

  const destinationPath = resolve(bundlePayloadRoot, relativePath)
  copyEntry(sourcePath, destinationPath)
  report.includedFiles.push({
    relativePath,
    bundlePath: destinationPath,
  })
}

for (const relativePath of remoteObservationEvidenceEntries) {
  const sourcePath = resolve(outputDir, relativePath)
  if (!existsSync(sourcePath)) {
    if (remoteObservationPending) {
      report.pendingFiles.push(relativePath)
      continue
    }

    report.missingFiles.push(relativePath)
    continue
  }

  const destinationPath = resolve(bundlePayloadRoot, relativePath)
  copyEntry(sourcePath, destinationPath)
  report.includedFiles.push({
    relativePath,
    bundlePath: destinationPath,
  })
}

for (const entry of directoryEntries) {
  if (!existsSync(entry.source)) {
    report.missingDirectories.push({
      id: entry.id,
      relativePath: relative(outputDir, entry.source).replace(/\\/g, '/'),
    })
    continue
  }

  ensureDirectory(dirname(entry.destination))
  cpSync(entry.source, entry.destination, { recursive: true })
  report.includedDirectories.push({
    id: entry.id,
    relativePath: relative(outputDir, entry.source).replace(/\\/g, '/'),
    bundlePath: entry.destination,
  })
}

if (report.missingFiles.length > 0) {
  report.status = 'phase0-bundle-incomplete'
  report.blockers.push('Some expected Phase 0 evidence files are missing from output/phase0-readiness.')
  report.nextSteps.push('Run `npm run verify:strict` to regenerate the full evidence set before sharing the bundle.')
}

if (report.missingFiles.length === 0 && report.pendingFiles.length > 0) {
  report.status = 'phase0-bundle-local-ready-remote-pending'
  report.nextSteps.push('Complete one successful remote Phase 0 observation run to populate the pending remote evidence files.')
}

if (report.missingDirectories.length > 0) {
  report.status = 'phase0-bundle-incomplete'
  report.blockers.push('Some expected evidence directories are missing from the local output tree.')
  report.nextSteps.push('Run `npm run test:e2e:electron:compiled` or `npm run verify:strict` to restore the visual evidence bundle.')
}

const manifest = {
  generatedAt: report.generatedAt,
  repoRoot,
  appRoot,
  bundleRoot,
  bundlePayloadRoot,
  status: report.status,
  fileCount: report.includedFiles.length,
  pendingFileCount: report.pendingFiles.length,
  directoryCount: report.includedDirectories.length,
}

writeFileSync(resolve(bundleRoot, 'bundle-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(`Phase 0 evidence bundle written to ${bundleRoot}`)
