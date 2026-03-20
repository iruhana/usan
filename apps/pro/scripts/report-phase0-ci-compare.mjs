import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const appRoot = process.cwd()
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const latestDownloadPath = resolve(outputDir, 'ci-artifacts', 'latest-download.json')
const observedRunPath = resolve(outputDir, 'phase0-ci-observed-run.json')
const jsonOutputPath = resolve(outputDir, 'phase0-ci-compare.json')
const markdownOutputPath = resolve(outputDir, 'phase0-ci-compare.md')
const localReadinessPath = resolve(outputDir, 'phase0-readiness.json')
const localReceiptPath = resolve(outputDir, 'verify-strict-receipt.json')
const localVisualManifestPath = resolve(appRoot, 'output', 'playwright', 'electron-smoke', 'shell-visual-manifest.json')
const localSmokeDir = resolve(appRoot, 'output', 'playwright', 'electron-smoke')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function hashContent(value) {
  return createHash('sha256').update(value).digest('hex')
}

function hashFile(path) {
  return hashContent(readFileSync(path))
}

function normalizeForHash(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForHash(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, normalizeForHash(nestedValue)]),
    )
  }

  return value
}

function normalizeVisualManifest(manifest) {
  const normalizedThemes = Object.fromEntries(
    Object.entries(manifest.themes ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([themeName, theme]) => [
        themeName,
        {
          screenshotFile: theme?.screenshotPath ? basename(theme.screenshotPath) : null,
          tokens: normalizeForHash(theme?.tokens ?? {}),
          contrasts: normalizeForHash(theme?.contrasts ?? {}),
          zones: (theme?.zones ?? []).map((zone) => ({
            zone: zone.zone,
            selector: zone.selector ?? null,
            file: zone.path ? basename(zone.path) : null,
            required: zone.required ?? null,
            width: zone.width ?? null,
            height: zone.height ?? null,
          })),
        },
      ]),
  )

  return normalizeForHash({
    shell: {
      root: manifest.shell?.root ?? null,
    },
    themes: normalizedThemes,
    reducedMotion: manifest.reducedMotion ?? null,
  })
}

function addCheck(checks, id, label, passed, detail) {
  checks.push({ id, label, passed, detail })
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 CI Compare',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Result: ${report.passed ? 'PASS' : 'FAIL'}`,
    `- Checks: ${report.passedChecks}/${report.totalChecks}`,
  ]

  if (report.download) {
    lines.push(`- Downloaded run: ${report.download.runId}`)
    lines.push(`- Artifact directory: ${report.download.artifactDir}`)
  }

  if (report.observedRun) {
    lines.push(`- Observed run: ${report.observedRun.runId}`)
    lines.push(`- Observed branch: ${report.observedRun.branchName}`)
    lines.push(`- Observed artifact directory: ${report.observedRun.artifactDir}`)
  }

  lines.push('', '## Checks')
  for (const check of report.checks) {
    lines.push(`- [${check.passed ? 'x' : ' '}] ${check.label}: ${check.detail}`)
  }

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })

const checks = []
const report = {
  generatedAt: new Date().toISOString(),
  passed: false,
  passedChecks: 0,
  totalChecks: 0,
  checks,
  download: null,
  observedRun: null,
}

if (!existsSync(latestDownloadPath)) {
  addCheck(checks, 'download-manifest', 'latest download manifest exists', false, 'missing')
} else {
  const download = readJson(latestDownloadPath)
  report.download = download
  if (existsSync(observedRunPath)) {
    report.observedRun = readJson(observedRunPath)
  }
  const readinessArtifactDir = resolve(download.artifactDir, 'pro-phase0-readiness')
  const smokeArtifactDir = resolve(download.artifactDir, 'pro-electron-smoke')
  const remoteReadinessPath = resolve(readinessArtifactDir, 'phase0-readiness.json')
  const remoteReceiptPath = resolve(readinessArtifactDir, 'verify-strict-receipt.json')
  const remoteVisualManifestPath = resolve(smokeArtifactDir, 'shell-visual-manifest.json')

  addCheck(checks, 'download-manifest', 'latest download manifest exists', true, latestDownloadPath)
  if (report.observedRun) {
    addCheck(
      checks,
      'observed-run-id-parity',
      'observed run id matches latest download manifest',
      report.observedRun.runId === download.runId,
      `observed=${report.observedRun.runId} download=${download.runId}`,
    )
    addCheck(
      checks,
      'observed-branch-parity',
      'observed run branch matches latest download branch',
      report.observedRun.branchName === download.branchName,
      `observed=${report.observedRun.branchName} download=${download.branchName}`,
    )
    addCheck(
      checks,
      'observed-artifact-dir-parity',
      'observed run artifact directory matches latest download artifact directory',
      report.observedRun.artifactDir === download.artifactDir,
      `observed=${report.observedRun.artifactDir} download=${download.artifactDir}`,
    )
  }
  addCheck(
    checks,
    'artifact-readiness-dir',
    'downloaded readiness artifact directory exists',
    existsSync(readinessArtifactDir),
    readinessArtifactDir,
  )
  addCheck(
    checks,
    'artifact-smoke-dir',
    'downloaded smoke artifact directory exists',
    existsSync(smokeArtifactDir),
    smokeArtifactDir,
  )
  addCheck(
    checks,
    'remote-readiness-json',
    'downloaded phase0-readiness.json exists',
    existsSync(remoteReadinessPath),
    remoteReadinessPath,
  )
  addCheck(
    checks,
    'remote-receipt-json',
    'downloaded verify-strict-receipt.json exists',
    existsSync(remoteReceiptPath),
    remoteReceiptPath,
  )
  addCheck(
    checks,
    'remote-visual-manifest',
    'downloaded shell-visual-manifest.json exists',
    existsSync(remoteVisualManifestPath),
    remoteVisualManifestPath,
  )

  if (
    existsSync(localReadinessPath)
    && existsSync(localReceiptPath)
    && existsSync(localVisualManifestPath)
    && existsSync(remoteReadinessPath)
    && existsSync(remoteReceiptPath)
    && existsSync(remoteVisualManifestPath)
  ) {
    const localReadiness = readJson(localReadinessPath)
    const localReceipt = readJson(localReceiptPath)
    const localVisualManifest = readJson(localVisualManifestPath)
    const remoteReadiness = readJson(remoteReadinessPath)
    const remoteReceipt = readJson(remoteReceiptPath)
    const remoteVisualManifest = readJson(remoteVisualManifestPath)

    addCheck(
      checks,
      'readiness-pass-parity',
      'local and remote readiness both pass',
      Boolean(localReadiness.passed && remoteReadiness.passed),
      `local=${localReadiness.passed} remote=${remoteReadiness.passed}`,
    )
    addCheck(
      checks,
      'readiness-total-checks-parity',
      'local and remote readiness totalChecks match',
      localReadiness.totalChecks === remoteReadiness.totalChecks,
      `local=${localReadiness.totalChecks} remote=${remoteReadiness.totalChecks}`,
    )
    addCheck(
      checks,
      'readiness-passed-checks-parity',
      'local and remote readiness passedChecks match',
      localReadiness.passedChecks === remoteReadiness.passedChecks,
      `local=${localReadiness.passedChecks} remote=${remoteReadiness.passedChecks}`,
    )
    addCheck(
      checks,
      'readiness-acceptance-count-parity',
      'local and remote acceptance result counts match',
      localReadiness.acceptanceResults.length === remoteReadiness.acceptanceResults.length,
      `local=${localReadiness.acceptanceResults.length} remote=${remoteReadiness.acceptanceResults.length}`,
    )
    addCheck(
      checks,
      'readiness-exit-count-parity',
      'local and remote exit result counts match',
      localReadiness.exitResults.length === remoteReadiness.exitResults.length,
      `local=${localReadiness.exitResults.length} remote=${remoteReadiness.exitResults.length}`,
    )

    const localAcceptanceIds = localReadiness.acceptanceResults.map((item) => item.id).join(',')
    const remoteAcceptanceIds = remoteReadiness.acceptanceResults.map((item) => item.id).join(',')
    addCheck(
      checks,
      'readiness-acceptance-ids-parity',
      'local and remote acceptance criterion ids match',
      localAcceptanceIds === remoteAcceptanceIds,
      `local=${localAcceptanceIds} remote=${remoteAcceptanceIds}`,
    )

    const localExitIds = localReadiness.exitResults.map((item) => item.id).join(',')
    const remoteExitIds = remoteReadiness.exitResults.map((item) => item.id).join(',')
    addCheck(
      checks,
      'readiness-exit-ids-parity',
      'local and remote exit criterion ids match',
      localExitIds === remoteExitIds,
      `local=${localExitIds} remote=${remoteExitIds}`,
    )

    addCheck(
      checks,
      'receipt-pass-parity',
      'local and remote verify receipts both pass',
      Boolean(localReceipt.passed && remoteReceipt.passed),
      `local=${localReceipt.passed} remote=${remoteReceipt.passed}`,
    )

    const localCommandIds = localReceipt.commands.map((command) => command.id).join(',')
    const remoteCommandIds = remoteReceipt.commands.map((command) => command.id).join(',')
    addCheck(
      checks,
      'receipt-command-ids-parity',
      'local and remote verify receipt command ids match',
      localCommandIds === remoteCommandIds,
      `local=${localCommandIds} remote=${remoteCommandIds}`,
    )

    const localZones = ['dark', 'light'].flatMap((themeName) =>
      (localVisualManifest.themes?.[themeName]?.zones ?? []).map((zone) => `${themeName}:${zone.zone}`),
    ).join(',')
    const remoteZones = ['dark', 'light'].flatMap((themeName) =>
      (remoteVisualManifest.themes?.[themeName]?.zones ?? []).map((zone) => `${themeName}:${zone.zone}`),
    ).join(',')
    addCheck(
      checks,
      'visual-zone-parity',
      'local and remote visual manifest zones match',
      localZones === remoteZones,
      `local=${localZones} remote=${remoteZones}`,
    )

    const localThemes = Object.keys(localVisualManifest.themes ?? {}).sort().join(',')
    const remoteThemes = Object.keys(remoteVisualManifest.themes ?? {}).sort().join(',')
    addCheck(
      checks,
      'visual-theme-parity',
      'local and remote visual manifest themes match',
      localThemes === remoteThemes,
      `local=${localThemes} remote=${remoteThemes}`,
    )

    addCheck(
      checks,
      'visual-reduced-motion-present',
      'remote visual manifest contains reduced-motion probe',
      Boolean(remoteVisualManifest.reducedMotion?.animationDuration && remoteVisualManifest.reducedMotion?.animationIterationCount),
      JSON.stringify(remoteVisualManifest.reducedMotion ?? {}),
    )

    const localVisualManifestHash = hashContent(JSON.stringify(normalizeVisualManifest(localVisualManifest)))
    const remoteVisualManifestHash = hashContent(JSON.stringify(normalizeVisualManifest(remoteVisualManifest)))
    addCheck(
      checks,
      'visual-manifest-hash-parity',
      'local and remote normalized visual manifest hashes match',
      localVisualManifestHash === remoteVisualManifestHash,
      `local=${localVisualManifestHash} remote=${remoteVisualManifestHash}`,
    )

    for (const themeName of ['dark', 'light']) {
      const localTheme = localVisualManifest.themes?.[themeName]
      const remoteTheme = remoteVisualManifest.themes?.[themeName]
      if (!localTheme || !remoteTheme) {
        continue
      }

      const localShellScreenshotPath = resolve(localSmokeDir, basename(localTheme.screenshotPath))
      const remoteShellScreenshotPath = resolve(smokeArtifactDir, basename(remoteTheme.screenshotPath))

      addCheck(
        checks,
        `visual-${themeName}-shell-screenshot-file`,
        `${themeName} shell screenshot file exists in downloaded artifact`,
        existsSync(remoteShellScreenshotPath),
        remoteShellScreenshotPath,
      )

      if (existsSync(localShellScreenshotPath) && existsSync(remoteShellScreenshotPath)) {
        const localHash = hashFile(localShellScreenshotPath)
        const remoteHash = hashFile(remoteShellScreenshotPath)
        addCheck(
          checks,
          `visual-${themeName}-shell-screenshot-hash-parity`,
          `${themeName} shell screenshot hashes match`,
          localHash === remoteHash,
          `local=${localHash} remote=${remoteHash}`,
        )
      }

      for (const zone of remoteTheme.zones ?? []) {
        const localZone = (localTheme.zones ?? []).find((candidate) => candidate.zone === zone.zone)
        const remoteZonePath = resolve(smokeArtifactDir, basename(zone.path))
        addCheck(
          checks,
          `visual-${themeName}-${zone.zone}-file`,
          `${themeName} ${zone.zone} screenshot file exists in downloaded artifact`,
          existsSync(remoteZonePath),
          remoteZonePath,
        )

        if (localZone) {
          const localZonePath = resolve(localSmokeDir, basename(localZone.path))
          if (existsSync(localZonePath) && existsSync(remoteZonePath)) {
            const localHash = hashFile(localZonePath)
            const remoteHash = hashFile(remoteZonePath)
            addCheck(
              checks,
              `visual-${themeName}-${zone.zone}-hash-parity`,
              `${themeName} ${zone.zone} screenshot hashes match`,
              localHash === remoteHash,
              `local=${localHash} remote=${remoteHash}`,
            )
          }
        }
      }
    }
  }
}

report.passedChecks = checks.filter((check) => check.passed).length
report.totalChecks = checks.length
report.passed = checks.length > 0 && checks.every((check) => check.passed)

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(
  `Phase 0 CI compare ${report.passed ? 'passed' : 'failed'}: ${report.passedChecks}/${report.totalChecks} checks -> ${markdownOutputPath}`,
)

if (!report.passed) {
  process.exitCode = 1
}
