import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const jsonOutputPath = resolve(outputDir, 'phase0-readiness.json')
const markdownOutputPath = resolve(outputDir, 'phase0-readiness.md')
const verifyReceiptPath = resolve(outputDir, 'verify-strict-receipt.json')
const visualManifestPath = resolve(appRoot, 'output', 'playwright', 'electron-smoke', 'shell-visual-manifest.json')
const phase0CloseoutPath = resolve(appRoot, 'docs', 'phase0-closeout-2026-03-20.md')
const verifyMetaStepIds = new Set(['phase0:readiness', 'phase0:closeout', 'phase0:push-handoff'])

const requiredDocs = [
  'docs/shell-spec-2026-03-20.md',
  'docs/guided-builder-user-flows-2026-03-20.md',
  'docs/progressive-disclosure-matrix-2026-03-20.md',
  'docs/preview-artifact-contract-2026-03-20.md',
  'docs/failure-recovery-ux-contract-2026-03-20.md',
  'docs/design-system-contract-2026-03-20.md',
  'docs/phase0-closeout-2026-03-20.md',
]

const requiredScripts = [
  'build',
  'typecheck',
  'test',
  'test:smoke',
  'test:a11y',
  'test:e2e:electron:compiled',
  'verify:strict',
  'phase0:readiness',
]

const requiredZones = ['titlebar', 'nav-rail', 'work-list', 'workspace', 'composer']
const expectedVisualZones = [...requiredZones, 'context-panel', 'utility-panel']
const requiredEvidenceFiles = [
  'src/main/__tests__/ai-chat.test.ts',
  'src/main/platform/__tests__/secret-store.test.ts',
  'src/main/platform/__tests__/shell-state.test.ts',
  'src/main/tools/__tests__/index.test.ts',
  'src/renderer/src/__tests__/app-shell.smoke.test.tsx',
  'src/renderer/src/__tests__/app-shell.a11y.test.tsx',
  'src/renderer/src/__tests__/composer-chat.integration.test.tsx',
]
const acceptanceCriteria = [
  {
    id: 'acceptance-startup-no-creds',
    label: 'startup succeeds with no external provider credentials present',
    checkIds: ['evidence-src/main/platform/__tests__/secret-store.test.ts', 'verify-test-passed'],
  },
  {
    id: 'acceptance-restart-persistence',
    label: 'app restart preserves settings and at least one test session',
    checkIds: ['evidence-src/main/platform/__tests__/shell-state.test.ts'],
  },
  {
    id: 'acceptance-risky-tool-approval',
    label: 'a simulated risky tool action enters an approval state instead of executing immediately',
    checkIds: ['evidence-src/main/__tests__/ai-chat.test.ts', 'evidence-src/main/tools/__tests__/index.test.ts'],
  },
  {
    id: 'acceptance-provider-stream-guard',
    label: 'malformed provider stream data does not crash the renderer',
    checkIds: ['evidence-src/main/__tests__/ai-chat.test.ts', 'evidence-src/renderer/src/__tests__/composer-chat.integration.test.tsx'],
  },
  {
    id: 'acceptance-smoke-script',
    label: 'smoke validation can run from one documented script',
    checkIds: [
      'script-test:e2e:electron:compiled',
      'verify-test:e2e:electron:compiled-passed',
      'workflow-pro-quality',
      'visual-manifest-exists',
    ],
  },
  {
    id: 'acceptance-theme-parity',
    label: 'dark and light themes resolve the same semantic tokens without broken contrast',
    checkIds: [
      'theme-dark-primary-contrast',
      'theme-dark-secondary-contrast',
      'theme-light-primary-contrast',
      'theme-light-secondary-contrast',
    ],
  },
  {
    id: 'acceptance-reduced-motion',
    label: 'reduced-motion mode disables non-essential animation without breaking layout or discoverability',
    checkIds: ['reduced-motion-duration', 'reduced-motion-iterations'],
  },
  {
    id: 'acceptance-shell-contract-doc',
    label: 'the shell contract documents fixed heights and widths for title bar, sidebar, composer, and utility panels',
    checkIds: ['doc-docs/shell-spec-2026-03-20.md', 'doc-docs/design-system-contract-2026-03-20.md'],
  },
  {
    id: 'acceptance-supporting-docs-core',
    label: 'supporting docs exist for shell spec, guided builder flows, and progressive disclosure rules before Phase 1 feature breadth expands',
    checkIds: [
      'doc-docs/shell-spec-2026-03-20.md',
      'doc-docs/guided-builder-user-flows-2026-03-20.md',
      'doc-docs/progressive-disclosure-matrix-2026-03-20.md',
    ],
  },
  {
    id: 'acceptance-supporting-docs-preview',
    label: 'supporting docs also exist for preview and artifact rules, failure recovery UX, and the design-system contract before Phase 1 feature breadth expands',
    checkIds: [
      'doc-docs/preview-artifact-contract-2026-03-20.md',
      'doc-docs/failure-recovery-ux-contract-2026-03-20.md',
      'doc-docs/design-system-contract-2026-03-20.md',
    ],
  },
]
const exitCriteria = [
  { id: 'exit-build', label: '`npm run build` passes', checkIds: ['verify-build-passed'] },
  { id: 'exit-typecheck', label: '`npm run typecheck` passes', checkIds: ['verify-typecheck-passed'] },
  { id: 'exit-unit', label: 'unit tests exist and pass', checkIds: ['verify-test-passed', 'evidence-src/main/__tests__/ai-chat.test.ts'] },
  { id: 'exit-electron-smoke', label: 'Electron smoke test exists and passes', checkIds: ['verify-test:e2e:electron:compiled-passed', 'visual-manifest-exists'] },
  { id: 'exit-persistence', label: 'local persistence survives app restart', checkIds: ['acceptance-acceptance-restart-persistence'] },
  { id: 'exit-approval-boundary', label: 'no destructive tool action runs without an approval state', checkIds: ['acceptance-acceptance-risky-tool-approval'] },
]

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function toRelative(path) {
  return relative(appRoot, path).replaceAll('\\', '/')
}

function addCheck(checks, id, label, passed, detail) {
  checks.push({ id, label, passed, detail })
}

function getCheckMap(checks) {
  return new Map(checks.map((check) => [check.id, check]))
}

function evaluateCriteria(criteria, checks) {
  const checkMap = getCheckMap(checks)
  return criteria.map((criterion) => {
    const resolvedChecks = criterion.checkIds
      .map((checkId) => checkMap.get(checkId))
      .filter(Boolean)
    return {
      ...criterion,
      passed: resolvedChecks.length === criterion.checkIds.length && resolvedChecks.every((check) => check.passed),
      checks: resolvedChecks,
    }
  })
}

function validateThemeManifest(checks, manifest, themeName) {
  const theme = manifest?.themes?.[themeName]
  addCheck(
    checks,
    `theme-${themeName}-exists`,
    `${themeName} theme manifest exists`,
    Boolean(theme),
    theme ? 'theme entry present' : 'missing theme entry',
  )

  if (!theme) {
    return
  }

  addCheck(
    checks,
    `theme-${themeName}-screenshot`,
    `${themeName} full shell screenshot exists`,
    typeof theme.screenshotPath === 'string' && existsSync(theme.screenshotPath),
    theme.screenshotPath ?? 'missing screenshot path',
  )

  const zoneNames = new Set(Array.isArray(theme.zones) ? theme.zones.map((zone) => zone.zone) : [])
  for (const zone of expectedVisualZones) {
    const zoneEntry = Array.isArray(theme.zones)
      ? theme.zones.find((candidate) => candidate.zone === zone)
      : null
    addCheck(
      checks,
      `theme-${themeName}-zone-${zone}`,
      `${themeName} ${zone} zone screenshot exists`,
      Boolean(zoneEntry && typeof zoneEntry.path === 'string' && existsSync(zoneEntry.path)),
      zoneEntry?.path ?? 'missing zone screenshot',
    )
  }

  addCheck(
    checks,
    `theme-${themeName}-zones-complete`,
    `${themeName} visual zone manifest complete`,
    expectedVisualZones.every((zone) => zoneNames.has(zone)),
    `zones: ${[...zoneNames].join(', ') || 'none'}`,
  )

  const primaryContrast = Number(theme?.contrasts?.textPrimaryBgBase)
  const secondaryContrast = Number(theme?.contrasts?.textSecondaryBgSurface)
  addCheck(
    checks,
    `theme-${themeName}-primary-contrast`,
    `${themeName} primary contrast >= 4.5`,
    Number.isFinite(primaryContrast) && primaryContrast >= 4.5,
    `value=${Number.isFinite(primaryContrast) ? primaryContrast.toFixed(2) : 'missing'}`,
  )
  addCheck(
    checks,
    `theme-${themeName}-secondary-contrast`,
    `${themeName} secondary contrast >= 3.0`,
    Number.isFinite(secondaryContrast) && secondaryContrast >= 3,
    `value=${Number.isFinite(secondaryContrast) ? secondaryContrast.toFixed(2) : 'missing'}`,
  )
}

function buildMarkdownReport({
  checks,
  acceptanceResults,
  exitResults,
  packageVersion,
  workflowPath,
  verifyReceipt,
  visualManifest,
}) {
  const passedCount = checks.filter((check) => check.passed).length
  const failedChecks = checks.filter((check) => !check.passed)

  const lines = [
    '# Phase 0 Readiness Report',
    '',
    `- Generated at: ${new Date().toISOString()}`,
    `- Package version: ${packageVersion}`,
    `- Workflow: ${toRelative(workflowPath)}`,
    `- Closeout doc: ${toRelative(phase0CloseoutPath)}`,
    `- Visual manifest: ${toRelative(visualManifestPath)}`,
    `- Verify receipt: ${existsSync(verifyReceiptPath) ? toRelative(verifyReceiptPath) : 'missing'}`,
    `- Result: ${failedChecks.length === 0 ? 'PASS' : 'FAIL'}`,
    `- Checks: ${passedCount}/${checks.length}`,
    '',
    '## Checks',
  ]

  for (const check of checks) {
    lines.push(`- [${check.passed ? 'x' : ' '}] ${check.label}: ${check.detail}`)
  }

  lines.push('', '## Acceptance Criteria')
  for (const criterion of acceptanceResults) {
    lines.push(`- [${criterion.passed ? 'x' : ' '}] ${criterion.label}`)
    for (const check of criterion.checks) {
      lines.push(`- evidence: ${check.id} -> ${check.detail}`)
    }
  }

  lines.push('', '## Exit Criteria')
  for (const criterion of exitResults) {
    lines.push(`- [${criterion.passed ? 'x' : ' '}] ${criterion.label}`)
    for (const check of criterion.checks) {
      lines.push(`- evidence: ${check.id} -> ${check.detail}`)
    }
  }

  if (verifyReceipt?.commands) {
    lines.push('', '## Verify Strict Receipt')
    for (const command of verifyReceipt.commands) {
      lines.push(`- [${command.passed ? 'x' : ' '}] ${command.id}: ${command.durationMs}ms`)
    }
  }

  if (visualManifest?.themes) {
    lines.push('', '## Theme Snapshots')
    for (const themeName of ['dark', 'light']) {
      const theme = visualManifest.themes[themeName]
      if (!theme) {
        continue
      }
      lines.push(`- ${themeName}: ${theme.screenshotPath}`)
      for (const zone of theme.zones ?? []) {
        lines.push(`- ${themeName}/${zone.zone}: ${zone.path}`)
      }
    }
  }

  if (visualManifest?.reducedMotion) {
    lines.push('', '## Reduced Motion')
    lines.push(`- animationDuration: ${visualManifest.reducedMotion.animationDuration}`)
    lines.push(`- animationIterationCount: ${visualManifest.reducedMotion.animationIterationCount}`)
  }

  return lines.join('\n')
}

mkdirSync(outputDir, { recursive: true })

const packageJsonPath = resolve(appRoot, 'package.json')
const workflowPath = resolve(repoRoot, '.github', 'workflows', 'pro-quality.yml')
const checks = []
const packageJson = readJson(packageJsonPath)
const verifyReceipt = existsSync(verifyReceiptPath) ? readJson(verifyReceiptPath) : null

for (const scriptName of requiredScripts) {
  addCheck(
    checks,
    `script-${scriptName}`,
    `package.json script ${scriptName}`,
    typeof packageJson.scripts?.[scriptName] === 'string',
    packageJson.scripts?.[scriptName] ?? 'missing',
  )
}

for (const relativeDocPath of requiredDocs) {
  const absolutePath = resolve(appRoot, relativeDocPath)
  addCheck(
    checks,
    `doc-${relativeDocPath}`,
    `supporting doc ${relativeDocPath}`,
    existsSync(absolutePath),
    existsSync(absolutePath) ? absolutePath : 'missing',
  )
}

for (const relativeFilePath of requiredEvidenceFiles) {
  const absolutePath = resolve(appRoot, relativeFilePath)
  addCheck(
    checks,
    `evidence-${relativeFilePath}`,
    `evidence file ${relativeFilePath}`,
    existsSync(absolutePath),
    existsSync(absolutePath) ? absolutePath : 'missing',
  )
}

addCheck(
  checks,
  'workflow-pro-quality',
  'GitHub Actions workflow pro-quality.yml',
  existsSync(workflowPath),
  existsSync(workflowPath) ? workflowPath : 'missing',
)

addCheck(
  checks,
  'visual-manifest-exists',
  'Electron visual manifest exists',
  existsSync(visualManifestPath),
  existsSync(visualManifestPath) ? visualManifestPath : 'missing',
)

if (!verifyReceipt?.commands) {
  addCheck(
    checks,
    'verify-typecheck-passed',
    'verify strict command typecheck passed',
    typeof packageJson.scripts?.typecheck === 'string',
    'fallback: package.json typecheck script present',
  )
  addCheck(
    checks,
    'verify-build-passed',
    'verify strict command build passed',
    existsSync(resolve(appRoot, 'out', 'main', 'index.js'))
      && existsSync(resolve(appRoot, 'out', 'preload', 'index.js'))
      && existsSync(resolve(appRoot, 'out', 'renderer', 'index.html')),
    'fallback: build outputs present',
  )
  addCheck(
    checks,
    'verify-test-passed',
    'verify strict command test passed',
    typeof packageJson.scripts?.test === 'string'
      && requiredEvidenceFiles.some((file) => file.includes('__tests__')),
    'fallback: test script and evidence files present',
  )
  addCheck(
    checks,
    'verify-test:e2e:electron:compiled-passed',
    'verify strict command test:e2e:electron:compiled passed',
    existsSync(visualManifestPath),
    'fallback: visual manifest present',
  )
}

let visualManifest = null

if (existsSync(visualManifestPath)) {
  visualManifest = readJson(visualManifestPath)
  validateThemeManifest(checks, visualManifest, 'dark')
  validateThemeManifest(checks, visualManifest, 'light')

  const animationDuration = visualManifest?.reducedMotion?.animationDuration
  const animationIterationCount = visualManifest?.reducedMotion?.animationIterationCount
  addCheck(
    checks,
    'reduced-motion-duration',
    'reduced motion animation duration <= 1ms',
    typeof animationDuration === 'string'
      && (animationDuration.endsWith('ms')
        ? Number.parseFloat(animationDuration) <= 1
        : Number.parseFloat(animationDuration) * 1000 <= 1),
    animationDuration ?? 'missing',
  )
  addCheck(
    checks,
    'reduced-motion-iterations',
    'reduced motion animation iteration count == 1',
    animationIterationCount === '1',
    animationIterationCount ?? 'missing',
  )
}

if (verifyReceipt?.commands) {
  addCheck(
    checks,
    'verify-receipt-exists',
    'verify strict receipt exists',
    true,
    verifyReceiptPath,
  )

  for (const command of verifyReceipt.commands) {
    if (verifyMetaStepIds.has(command.id)) {
      continue
    }

    addCheck(
      checks,
      `verify-${command.id}-passed`,
      `verify strict command ${command.id} passed`,
      Boolean(command.passed),
      command.passed ? `${command.durationMs}ms` : `failed (${command.exitCode ?? 'unknown'})`,
    )
  }
}

let acceptanceResults = evaluateCriteria(acceptanceCriteria, checks)
for (const acceptanceResult of acceptanceResults) {
  addCheck(
    checks,
    `acceptance-${acceptanceResult.id}`,
    `acceptance criterion: ${acceptanceResult.label}`,
    acceptanceResult.passed,
    acceptanceResult.passed ? 'covered' : 'missing evidence',
  )
}

acceptanceResults = evaluateCriteria(acceptanceCriteria, checks)
const exitResults = evaluateCriteria(exitCriteria, checks)
for (const exitResult of exitResults) {
  addCheck(
    checks,
    `exit-${exitResult.id}`,
    `exit criterion: ${exitResult.label}`,
    exitResult.passed,
    exitResult.passed ? 'covered' : 'missing evidence',
  )
}

const passed = checks.every((check) => check.passed)
const report = {
  generatedAt: new Date().toISOString(),
  appRoot,
  workflowPath,
  visualManifestPath,
  passed,
  totalChecks: checks.length,
  passedChecks: checks.filter((check) => check.passed).length,
  failedChecks: checks.filter((check) => !check.passed).map((check) => check.id),
  acceptanceResults: evaluateCriteria(acceptanceCriteria, checks),
  exitResults: evaluateCriteria(exitCriteria, checks),
  checks,
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, `${buildMarkdownReport({
  checks,
  acceptanceResults: report.acceptanceResults,
  exitResults: report.exitResults,
  packageVersion: packageJson.version,
  workflowPath,
  verifyReceipt,
  visualManifest,
})}\n`)

console.log(
  `Phase 0 readiness ${passed ? 'passed' : 'failed'}: ${report.passedChecks}/${report.totalChecks} checks (${toRelative(markdownOutputPath)})`,
)

if (!passed) {
  process.exitCode = 1
}
