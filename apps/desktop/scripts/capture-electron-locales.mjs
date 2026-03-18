import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { _electron: electron } = require('playwright-core')
const electronBinary = require('electron')

const appEntry = resolve(process.cwd(), 'out', 'main', 'index.js')
const rendererEntry = resolve(process.cwd(), 'out', 'renderer', 'index.html')
const outputDir = resolve(process.cwd(), 'output', 'playwright', 'locale-audit')
const runtimeDir = resolve(outputDir, '.runtime', `profile-${Date.now()}`)

const ignoredElectronArgs = Array.from(new Set([
  '--inspect=0',
  '--inspect-brk=0',
  ...process.execArgv.filter((arg) => arg.startsWith('--inspect')),
]))

const pageShortcuts = {
  home: '1',
  tools: '2',
  notes: '3',
  files: '4',
  settings: '5',
  account: '6',
  workflows: '7',
  knowledge: '8',
  dashboard: '9',
  marketplace: '0',
}

const targets = [
  { id: 'home' },
  { id: 'tools' },
  { id: 'notes' },
  { id: 'account' },
  { id: 'dashboard', beforeNavigate: ensureFullNavigation },
  { id: 'marketplace', beforeNavigate: ensureFullNavigation },
  { id: 'knowledge', beforeNavigate: ensureFullNavigation },
  { id: 'workflows', beforeNavigate: ensureFullNavigation },
  { id: 'settings-display', pageId: 'settings' },
  {
    id: 'settings-advanced',
    pageId: 'settings',
    beforeNavigate: ensureFullNavigation,
    prepare: async (page) => {
      await page.locator('[data-settings-tab="advanced"]').click()
      await page.locator('[data-settings-panel="advanced"]').waitFor({ state: 'visible' })
      await page.waitForTimeout(250)
    },
  },
]

const locales = ['ko', 'ja']
const allowedEnglishTokens = new Set([
  'AI',
  'KO',
  'EN',
  'JA',
  'CPU',
  'RAM',
  'OCR',
  'JSON',
  'MCP',
  'USB',
  'URL',
  'CSV',
  'API',
  'UI',
  'IP',
  'GPU',
  'SSD',
  'HDD',
  'B/s',
  'KB/s',
  'PDF',
  'PNG',
  'JPG',
  'JPEG',
  'WebP',
  'Usan',
  'OpenRouter',
  'Ctrl+K',
  'Ctrl/Cmd+K',
  'Shift+Enter',
  'Enter',
  'Esc',
  'Chrome',
  'Edge',
  'csv',
])

if (!existsSync(appEntry) || !existsSync(rendererEntry)) {
  console.error('Build output is missing. Run "npm run build" first.')
  process.exit(1)
}

if (!existsSync(electronBinary)) {
  console.error(`Electron executable not found: ${electronBinary}`)
  process.exit(1)
}

mkdirSync(outputDir, { recursive: true })
mkdirSync(resolve(runtimeDir, 'appdata'), { recursive: true })
mkdirSync(resolve(runtimeDir, 'localappdata'), { recursive: true })
mkdirSync(resolve(runtimeDir, 'temp'), { recursive: true })

async function launchElectronApp() {
  return electron.launch({
    executablePath: electronBinary,
    args: [appEntry],
    ignoreDefaultArgs: ignoredElectronArgs,
    env: (() => {
      const env = {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
        APPDATA: resolve(runtimeDir, 'appdata'),
        LOCALAPPDATA: resolve(runtimeDir, 'localappdata'),
        TEMP: resolve(runtimeDir, 'temp'),
        TMP: resolve(runtimeDir, 'temp'),
      }
      delete env.ELECTRON_RUN_AS_NODE
      return env
    })(),
  })
}

async function navigateToPage(page, pageId) {
  if (pageId === 'home') return
  const button = page.locator(`[data-page-id="${pageId}"]`)
  if (await button.count()) {
    await button.click()
    await page.waitForTimeout(400)
    return
  }

  const shortcut = pageShortcuts[pageId]
  if (!shortcut) {
    throw new Error(`Unknown page id: ${pageId}`)
  }

  await page.keyboard.press(process.platform === 'darwin' ? `Meta+${shortcut}` : `Control+${shortcut}`)
  await page.waitForTimeout(400)
}

async function ensureFullNavigation(page) {
  await navigateToPage(page, 'settings')
  const systemTab = page.locator('[data-settings-tab="system"]')
  await systemTab.waitFor({ state: 'visible', timeout: 10000 })
  await systemTab.click()
  await page.waitForTimeout(150)

  const advancedMenusToggle = page.locator('[data-action="toggle-advanced-menus"]')
  const checked = await advancedMenusToggle.getAttribute('aria-checked')
  if (checked !== 'true') {
    await advancedMenusToggle.click()
    await page.waitForTimeout(300)
  }
}

async function setLocale(page, locale) {
  await page.evaluate(async (nextLocale) => {
    await window.usan?.settings.set({
      locale: nextLocale,
      localeConfigured: true,
      beginnerMode: false,
      sidebarCollapsed: false,
    })
  }, locale)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(700)
  await page.locator('[data-page-id="home"]').waitFor({ state: 'visible' })
}

async function collectPageDiagnostics(page, locale, targetId) {
  return page.evaluate(({ locale, targetId, allowedEnglishTokens }) => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false
      const style = window.getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }

    const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim()
    const rawTokens = text.match(/\b[A-Za-z][A-Za-z0-9+./-]{2,}\b/g) ?? []
    const suspiciousEnglish = Array.from(new Set(rawTokens.filter((token) => !allowedEnglishTokens.includes(token))))
      .slice(0, 30)

    const questionMarks = (text.match(/\?{2,}|�/g) ?? []).slice(0, 10)

    const overflowSelectors = []
    const overflowNodes = document.querySelectorAll('button, [role="tab"], [role="switch"], h1, h2, h3, label, .truncate')
    for (const node of overflowNodes) {
      if (!(node instanceof HTMLElement) || !isVisible(node)) continue
      const overflowsWidth = node.scrollWidth > node.clientWidth + 2
      const overflowsHeight = node.scrollHeight > node.clientHeight + 2
      if (!overflowsWidth && !overflowsHeight) continue
      const nodeText = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim()
      if (!nodeText) continue
      overflowSelectors.push({
        text: nodeText.slice(0, 120),
        width: { client: node.clientWidth, scroll: node.scrollWidth },
        height: { client: node.clientHeight, scroll: node.scrollHeight },
      })
      if (overflowSelectors.length >= 12) break
    }

    return {
      locale,
      targetId,
      documentLang: document.documentElement.lang,
      suspiciousEnglish,
      questionMarks,
      overflowSelectors,
      textPreview: text.slice(0, 2500),
    }
  }, { locale, targetId, allowedEnglishTokens: Array.from(allowedEnglishTokens) })
}

async function run() {
  const app = await launchElectronApp()
  const report = []

  try {
    const page = await app.firstWindow()
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(700)
    await page.locator('[data-page-id="home"]').waitFor({ state: 'visible' })

    for (const locale of locales) {
      const localeDir = resolve(outputDir, locale)
      mkdirSync(localeDir, { recursive: true })

      await setLocale(page, locale)
      await ensureFullNavigation(page)
      await navigateToPage(page, 'home')

      for (const target of targets) {
        if (target.beforeNavigate) {
          await target.beforeNavigate(page)
        }

        const pageId = target.pageId ?? target.id
        if (pageId !== 'home') {
          await navigateToPage(page, pageId)
        }

        if (target.prepare) {
          await target.prepare(page)
        }

        await page.waitForTimeout(300)

        const diagnostics = await collectPageDiagnostics(page, locale, target.id)
        const screenshotPath = resolve(localeDir, `${target.id}.png`)
        const textPath = resolve(localeDir, `${target.id}.txt`)
        await page.screenshot({ path: screenshotPath, fullPage: true })
        writeFileSync(textPath, diagnostics.textPreview, 'utf-8')
        report.push({ ...diagnostics, screenshotPath, textPath })
      }
    }
  } finally {
    await app.close()
  }

  const reportPath = resolve(outputDir, 'report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')

  const summary = report.map((item) => ({
    locale: item.locale,
    targetId: item.targetId,
    documentLang: item.documentLang,
    suspiciousEnglishCount: item.suspiciousEnglish.length,
    overflowCount: item.overflowSelectors.length,
    questionMarkCount: item.questionMarks.length,
    screenshotPath: item.screenshotPath,
  }))
  console.table(summary)
  console.log(`Saved locale audit screenshots to ${outputDir}`)
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  console.error(`Locale capture failed: ${message}`)
  process.exit(1)
})
