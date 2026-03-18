import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { _electron: electron } = require('playwright-core')
const electronBinary = require('electron')

const enabled = process.argv.includes('--run') || process.env['USAN_E2E_ELECTRON'] === '1'
const appEntry = resolve(process.cwd(), 'out', 'main', 'index.js')
const rendererEntry = resolve(process.cwd(), 'out', 'renderer', 'index.html')
const axePath = resolve(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js')
const axeRuntimeDir = resolve(process.cwd(), 'out', 'renderer', '__a11y__')
const axeRuntimePath = resolve(axeRuntimeDir, 'axe.min.js')
const ignoredElectronArgs = Array.from(new Set([
  '--inspect=0',
  '--inspect-brk=0',
  ...process.execArgv.filter((arg) => arg.startsWith('--inspect')),
]))

const mainAppTargets = [
  { id: 'home' },
  { id: 'tools' },
  { id: 'tasks' },
  { id: 'files' },
  {
    id: 'settings-general',
    skipNavigation: true,
    prepare: async (page) => {
      await openSettingsSection(page, 'general')
    },
  },
  {
    id: 'settings-account',
    skipNavigation: true,
    prepare: async (page) => {
      await openSettingsSection(page, 'account')
    },
  },
  {
    id: 'settings-connectors',
    skipNavigation: true,
    prepare: async (page) => {
      await openSettingsSection(page, 'connectors')
    },
  },
  {
    id: 'settings-security',
    skipNavigation: true,
    prepare: async (page) => {
      await openSettingsSection(page, 'security')
    },
  },
  {
    id: 'settings-models',
    skipNavigation: true,
    prepare: async (page) => {
      await openSettingsSection(page, 'models')
    },
  },
  {
    id: 'settings-about',
    skipNavigation: true,
    prepare: async (page) => {
      await openSettingsSection(page, 'about')
    },
  },
  {
    id: 'safety-confirmation-modal',
    skipNavigation: true,
    prepare: async (page) => {
      await navigateToPage(page, 'tools')
      await page.locator('[data-action="open-safety-confirmation"]').click()
      await page.locator('[data-dialog-id="safety-confirmation"]').waitFor({ state: 'visible' })
      await page.waitForTimeout(300)
    },
    cleanup: async (page) => {
      await page.locator('[data-action="safety-cancel"]').click()
      await page.locator('[data-dialog-id="safety-confirmation"]').waitFor({ state: 'hidden' })
    },
  },
]

const onboardingTargets = [
  {
    id: 'onboarding',
    skipNavigation: true,
    prepare: async (page) => {
      await page.locator('[data-view="onboarding"]').waitFor({ state: 'visible' })
      await page.waitForTimeout(300)
    },
  },
]

const recoveryTargets = [
  {
    id: 'error-boundary',
    skipNavigation: true,
    prepare: async (page) => {
      await page.locator('[data-view="error-boundary"]').waitFor({ state: 'visible' })
      await page.waitForTimeout(300)
    },
  },
]

const skillRunnerTargets = [
  {
    id: 'skill-runner',
    skipNavigation: true,
    prepare: async (page) => {
      await page.locator('[data-view="skill-runner"]').waitFor({ state: 'visible' })
      await page.waitForTimeout(300)
    },
  },
]

const voiceOverlayTargets = [
  {
    id: 'voice-overlay',
    skipNavigation: true,
    prepare: async (page) => {
      await page.locator('[data-view="voice-overlay"]').waitFor({ state: 'visible' })
      await page.waitForTimeout(300)
    },
  },
]

if (!enabled) {
  console.log('Electron a11y e2e skipped (pass --run or set USAN_E2E_ELECTRON=1 to enable).')
  process.exit(0)
}

if (!existsSync(appEntry) || !existsSync(rendererEntry)) {
  console.error('Electron a11y e2e requires build output. Run "npm run build" first.')
  process.exit(1)
}

if (!existsSync(electronBinary)) {
  console.error(`Electron executable not found: ${electronBinary}`)
  process.exit(1)
}

if (!existsSync(axePath)) {
  console.error(`axe-core script not found: ${axePath}`)
  process.exit(1)
}

mkdirSync(axeRuntimeDir, { recursive: true })
copyFileSync(axePath, axeRuntimePath)

async function launchElectronApp(extraEnv = {}) {
  return electron.launch({
    executablePath: electronBinary,
    args: [appEntry],
    ignoreDefaultArgs: ignoredElectronArgs,
    env: (() => {
      const env = {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        ...extraEnv,
      }
      delete env.ELECTRON_RUN_AS_NODE
      return env
    })(),
  })
}

async function navigateToPage(page, pageId) {
  if (pageId === 'home') {
    return
  }

  await page.locator(`[data-page-id="${pageId}"]`).click()
  await page.waitForTimeout(500)
}

async function openSettingsSection(page, sectionId) {
  await navigateToPage(page, 'settings')
  const tab = page.locator(`[data-settings-tab="${sectionId}"]`)
  await tab.waitFor({ state: 'visible' })
  await tab.click()
  await page.locator(`[data-settings-panel="${sectionId}"]`).waitFor({ state: 'visible' })
  await page.waitForTimeout(200)
}

async function collectViolations(page, pageId, violationsByPage) {
  const axeUrl = new URL('./__a11y__/axe.min.js', page.url()).href
  const hasAxe = await page.evaluate(() => Boolean(window.axe))
  if (!hasAxe) {
    await page.addScriptTag({ url: axeUrl })
  }

  const result = await page.evaluate(async () => {
    const axe = window.axe
    if (!axe) return { violations: [] }
    return axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: {
        'color-contrast': { enabled: false },
      },
    })
  })

  const serious = (result.violations ?? []).filter((violation) =>
    violation.impact === 'serious' || violation.impact === 'critical',
  )

  if (serious.length > 0) {
    violationsByPage.push({
      pageId,
      violations: serious.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: (violation.nodes ?? []).map((node) => node.target).slice(0, 5),
      })),
    })
  }
}

async function runScan(extraEnv, targets, waitSelector, violationsByPage) {
  const app = await launchElectronApp(extraEnv)

  try {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(600)

    if (waitSelector) {
      await page.locator(waitSelector).waitFor({ state: 'visible' })
    }

    for (const target of targets) {
      if (target.beforeNavigate) {
        await target.beforeNavigate(page)
      }

      if (target.id !== 'home' && !target.skipNavigation) {
        await navigateToPage(page, target.id)
      }

      if (target.prepare) {
        await target.prepare(page)
      }

      await collectViolations(page, target.id, violationsByPage)

      if (target.cleanup) {
        await target.cleanup(page)
      }
    }
  } finally {
    await app.close()
  }
}

const violationsByPage = []

try {
  await runScan({}, mainAppTargets, '[data-page-id="home"]', violationsByPage)
  await runScan({ USAN_E2E_FORCE_ONBOARDING: '1' }, onboardingTargets, '[data-view="onboarding"]', violationsByPage)
  await runScan({ USAN_E2E_FORCE_RENDER_ERROR: '1' }, recoveryTargets, '[data-view="error-boundary"]', violationsByPage)
  await runScan({ USAN_E2E_FORCE_SKILL_RUNNER: '1' }, skillRunnerTargets, '[data-page-id="home"]', violationsByPage)
  await runScan({ USAN_E2E_FORCE_VOICE_OVERLAY: '1' }, voiceOverlayTargets, '[data-page-id="home"]', violationsByPage)

  if (violationsByPage.length > 0) {
    console.error('Electron a11y e2e failed. Serious/critical violations found:')
    for (const item of violationsByPage) {
      console.error(`- page: ${item.pageId}`)
      for (const violation of item.violations) {
        console.error(`  - [${violation.impact}] ${violation.id}: ${violation.help}`)
        if (violation.nodes.length > 0) {
          console.error(`    selectors: ${JSON.stringify(violation.nodes)}`)
        }
      }
    }
    process.exit(1)
  }

  const scannedTargets = [
    ...mainAppTargets,
    ...onboardingTargets,
    ...recoveryTargets,
    ...skillRunnerTargets,
    ...voiceOverlayTargets,
  ].map((target) => target.id).join(', ')
  console.log(`Electron a11y e2e passed (${scannedTargets}).`)
  process.exit(0)
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  console.error(`Electron a11y e2e failed to run: ${message}`)
  process.exit(1)
}
