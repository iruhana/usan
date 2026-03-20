/* global window, document, getComputedStyle, KeyboardEvent */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { _electron: electron } = require('playwright-core')
const electronBinary = require('electron')

const appEntry = resolve(process.cwd(), 'out', 'main', 'index.js')
const rendererEntry = resolve(process.cwd(), 'out', 'renderer', 'index.html')
const outputDir = resolve(process.cwd(), 'output', 'playwright', 'electron-smoke')
const darkScreenshot = resolve(outputDir, 'shell-dark.png')
const lightScreenshot = resolve(outputDir, 'shell-light.png')
const failureScreenshot = resolve(outputDir, 'shell-failure.png')
const visualManifestPath = resolve(outputDir, 'shell-visual-manifest.json')
const timeoutMs = Number.parseInt(process.env['USAN_SMOKE_SELFTEST_TIMEOUT_MS'] ?? '45000', 10)
const ignoredElectronArgs = Array.from(new Set([
  '--inspect=0',
  '--inspect-brk=0',
  ...process.execArgv.filter((arg) => arg.startsWith('--inspect')),
]))
const requiredZones = [
  { key: 'titlebar', selector: '[data-shell-zone="titlebar"]' },
  { key: 'nav-rail', selector: '[data-shell-zone="nav-rail"]' },
  { key: 'work-list', selector: '[data-shell-zone="work-list"]' },
  { key: 'workspace', selector: '[data-shell-zone="workspace"]' },
  { key: 'composer', selector: '[data-shell-zone="composer"]' },
]
const optionalZones = [
  { key: 'context-panel', selector: '[data-shell-zone="context-panel"]' },
  { key: 'utility-panel', selector: '[data-shell-zone="utility-panel"]' },
]

if (!existsSync(appEntry) || !existsSync(rendererEntry)) {
  console.error('Electron smoke requires build output. Run "npm run build" first.')
  process.exit(1)
}

if (!existsSync(electronBinary)) {
  console.error(`Electron executable not found: ${electronBinary}`)
  process.exit(1)
}

mkdirSync(outputDir, { recursive: true })

async function waitForVisible(page, selector, label) {
  await page.locator(selector).first().waitFor({
    state: 'visible',
    timeout: timeoutMs,
  })
  console.log(`Verified ${label}: ${selector}`)
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function normalizeTheme(themeAttr) {
  return themeAttr === 'light' ? 'light' : 'dark'
}

function parseCssColor(value) {
  const trimmed = value.trim().toLowerCase()

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1)
    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0] + hex[0], 16),
        g: Number.parseInt(hex[1] + hex[1], 16),
        b: Number.parseInt(hex[2] + hex[2], 16),
      }
    }

    if (hex.length === 6) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
      }
    }
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/)
  if (rgbMatch) {
    const channels = rgbMatch[1].split(',').map((part) => Number.parseFloat(part.trim()))
    return {
      r: channels[0] ?? 0,
      g: channels[1] ?? 0,
      b: channels[2] ?? 0,
    }
  }

  throw new Error(`Unsupported CSS color format: ${value}`)
}

function toLinearChannel(channel) {
  const normalized = channel / 255
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function getLuminance(color) {
  return (
    (0.2126 * toLinearChannel(color.r))
    + (0.7152 * toLinearChannel(color.g))
    + (0.0722 * toLinearChannel(color.b))
  )
}

function getContrastRatio(foreground, background) {
  const foregroundLum = getLuminance(parseCssColor(foreground))
  const backgroundLum = getLuminance(parseCssColor(background))
  const lighter = Math.max(foregroundLum, backgroundLum)
  const darker = Math.min(foregroundLum, backgroundLum)
  return (lighter + 0.05) / (darker + 0.05)
}

function assertContrast(label, foreground, background, minRatio) {
  const ratio = getContrastRatio(foreground, background)
  assert(
    ratio >= minRatio,
    `${label} contrast ${ratio.toFixed(2)} is below ${minRatio.toFixed(2)}. foreground=${foreground}, background=${background}`,
  )
  console.log(`Verified ${label} contrast: ${ratio.toFixed(2)}`)
  return ratio
}

async function getThemeSnapshot(page) {
  return page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement)
    return {
      themeAttr: document.documentElement.getAttribute('data-theme'),
      tokens: {
        bgBase: styles.getPropertyValue('--bg-base').trim(),
        bgSurface: styles.getPropertyValue('--bg-surface').trim(),
        textPrimary: styles.getPropertyValue('--text-primary').trim(),
        textSecondary: styles.getPropertyValue('--text-secondary').trim(),
        accent: styles.getPropertyValue('--accent').trim(),
      },
    }
  })
}

async function captureZoneScreenshots(page, theme) {
  const captures = []

  for (const zone of requiredZones) {
    const locator = page.locator(zone.selector).first()
    await locator.waitFor({ state: 'visible', timeout: timeoutMs })
    const filePath = resolve(outputDir, `${theme}-${zone.key}.png`)
    await locator.screenshot({ path: filePath })
    const box = await locator.boundingBox()
    captures.push({
      zone: zone.key,
      selector: zone.selector,
      path: filePath,
      required: true,
      width: box?.width ?? null,
      height: box?.height ?? null,
    })
    console.log(`Captured ${theme} zone screenshot: ${zone.key} -> ${filePath}`)
  }

  for (const zone of optionalZones) {
    const locator = page.locator(zone.selector).first()
    const count = await locator.count()
    if (count < 1) {
      continue
    }
    const isVisible = await locator.isVisible()
    if (!isVisible) {
      continue
    }
    const filePath = resolve(outputDir, `${theme}-${zone.key}.png`)
    await locator.screenshot({ path: filePath })
    const box = await locator.boundingBox()
    captures.push({
      zone: zone.key,
      selector: zone.selector,
      path: filePath,
      required: false,
      width: box?.width ?? null,
      height: box?.height ?? null,
    })
    console.log(`Captured ${theme} zone screenshot: ${zone.key} -> ${filePath}`)
  }

  return captures
}

async function dispatchShortcut(page, eventInit) {
  await page.evaluate((payload) => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ...payload,
    }))
  }, eventInit)
}

async function ensureOptionalZonesOpen(page) {
  const contextPanel = page.locator('[data-shell-zone="context-panel"]').first()
  if (await contextPanel.count() < 1 || !await contextPanel.isVisible()) {
    await dispatchShortcut(page, { key: '.', ctrlKey: true })
    await contextPanel.waitFor({ state: 'visible', timeout: timeoutMs })
    console.log('Opened optional zone: context-panel')
  }

  const utilityPanel = page.locator('[data-shell-zone="utility-panel"]').first()
  if (await utilityPanel.count() < 1 || !await utilityPanel.isVisible()) {
    await dispatchShortcut(page, { key: '`', ctrlKey: true })
    await utilityPanel.waitFor({ state: 'visible', timeout: timeoutMs })
    console.log('Opened optional zone: utility-panel')
  }
}

async function setTheme(page, theme) {
  await page.evaluate((nextTheme) => {
    document.documentElement.setAttribute('data-theme', nextTheme === 'dark' ? '' : nextTheme)
  }, theme)

  await page.waitForFunction((nextTheme) => {
    const attr = document.documentElement.getAttribute('data-theme')
    return nextTheme === 'light'
      ? attr === 'light'
      : attr === '' || attr === null
  }, theme, { timeout: timeoutMs })
}

async function verifyTheme(page, theme, screenshotPath) {
  await setTheme(page, theme)
  await ensureOptionalZonesOpen(page)
  const snapshot = await getThemeSnapshot(page)
  const normalizedTheme = normalizeTheme(snapshot.themeAttr)
  assert(normalizedTheme === theme, `Expected theme ${theme}, received ${normalizedTheme}.`)
  await page.screenshot({ path: screenshotPath })
  console.log(`Captured ${theme} shell screenshot: ${screenshotPath}`)
  const zones = await captureZoneScreenshots(page, theme)
  return {
    ...snapshot,
    screenshotPath,
    zones,
  }
}

async function verifyReducedMotion(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const probe = await page.evaluate(() => {
    const node = document.createElement('div')
    node.className = 'anim-pulse'
    document.body.appendChild(node)
    const styles = getComputedStyle(node)
    const result = {
      animationDuration: styles.animationDuration,
      animationIterationCount: styles.animationIterationCount,
    }
    node.remove()
    return result
  })

  const animationDurationMs = probe.animationDuration.endsWith('ms')
    ? Number.parseFloat(probe.animationDuration)
    : Number.parseFloat(probe.animationDuration) * 1000

  assert(
    Number.isFinite(animationDurationMs) && animationDurationMs <= 1,
    `Expected reduced motion animation duration <= 1ms, received ${probe.animationDuration}.`,
  )
  assert(
    probe.animationIterationCount === '1',
    `Expected reduced motion animation iteration count to be 1, received ${probe.animationIterationCount}.`,
  )
  console.log(`Verified reduced motion probe: ${probe.animationDuration}, iterations=${probe.animationIterationCount}`)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  return probe
}

async function main() {
  const electronApp = await electron.launch({
    executablePath: electronBinary,
    args: [appEntry],
    ignoreDefaultArgs: ignoredElectronArgs,
    env: (() => {
      const env = {
        ...process.env,
        CI: process.env['CI'] ?? '1',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      }
      delete env.ELECTRON_RUN_AS_NODE
      return env
    })(),
  })

  let page
  let originalTheme = 'dark'

  try {
    page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    await waitForVisible(page, '[data-shell-app="pro"]', 'shell root')
    await waitForVisible(page, '[data-shell-zone="titlebar"]', 'title bar')
    await waitForVisible(page, '[data-shell-zone="nav-rail"]', 'navigation rail')
    await waitForVisible(page, '[data-shell-zone="work-list"]', 'work list')
    await waitForVisible(page, '[data-shell-session-row]', 'session row')
    await waitForVisible(page, '[data-shell-zone="workspace"]', 'workspace')
    await waitForVisible(page, '[data-shell-zone="composer"]', 'composer')

    const sessionRowCount = await page.locator('[data-shell-session-row]').count()
    if (sessionRowCount < 1) {
      throw new Error(`Expected at least one visible session row, found ${sessionRowCount}.`)
    }

    originalTheme = await page.evaluate(() => {
      const attr = document.documentElement.getAttribute('data-theme')
      return attr === 'light' ? 'light' : 'dark'
    })

    const darkThemeSnapshot = await verifyTheme(page, 'dark', darkScreenshot)
    const lightThemeSnapshot = await verifyTheme(page, 'light', lightScreenshot)

    assert(
      darkThemeSnapshot.tokens.bgBase !== lightThemeSnapshot.tokens.bgBase,
      'Expected dark and light theme bg-base tokens to differ.',
    )
    assert(
      darkThemeSnapshot.tokens.textPrimary !== lightThemeSnapshot.tokens.textPrimary,
      'Expected dark and light theme text-primary tokens to differ.',
    )
    assert(
      darkThemeSnapshot.tokens.accent !== '' && lightThemeSnapshot.tokens.accent !== '',
      'Expected accent tokens to be present in both themes.',
    )

    const darkPrimaryContrast = assertContrast(
      'dark theme text-primary/bg-base',
      darkThemeSnapshot.tokens.textPrimary,
      darkThemeSnapshot.tokens.bgBase,
      4.5,
    )
    const darkSecondaryContrast = assertContrast(
      'dark theme text-secondary/bg-surface',
      darkThemeSnapshot.tokens.textSecondary,
      darkThemeSnapshot.tokens.bgSurface,
      3,
    )
    const lightPrimaryContrast = assertContrast(
      'light theme text-primary/bg-base',
      lightThemeSnapshot.tokens.textPrimary,
      lightThemeSnapshot.tokens.bgBase,
      4.5,
    )
    const lightSecondaryContrast = assertContrast(
      'light theme text-secondary/bg-surface',
      lightThemeSnapshot.tokens.textSecondary,
      lightThemeSnapshot.tokens.bgSurface,
      3,
    )

    const reducedMotionProbe = await verifyReducedMotion(page)
    await setTheme(page, originalTheme)

    writeFileSync(visualManifestPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      shell: {
        root: '[data-shell-app="pro"]',
        outputDir,
      },
      themes: {
        dark: {
          screenshotPath: darkThemeSnapshot.screenshotPath,
          tokens: darkThemeSnapshot.tokens,
          zones: darkThemeSnapshot.zones,
          contrasts: {
            textPrimaryBgBase: Number(darkPrimaryContrast.toFixed(2)),
            textSecondaryBgSurface: Number(darkSecondaryContrast.toFixed(2)),
          },
        },
        light: {
          screenshotPath: lightThemeSnapshot.screenshotPath,
          tokens: lightThemeSnapshot.tokens,
          zones: lightThemeSnapshot.zones,
          contrasts: {
            textPrimaryBgBase: Number(lightPrimaryContrast.toFixed(2)),
            textSecondaryBgSurface: Number(lightSecondaryContrast.toFixed(2)),
          },
        },
      },
      reducedMotion: reducedMotionProbe,
    }, null, 2))
    console.log(`Wrote visual manifest: ${visualManifestPath}`)

    console.log(`Electron smoke passed. Screenshots saved to ${darkScreenshot} and ${lightScreenshot}`)
  } catch (error) {
    if (page) {
      try {
        await page.screenshot({ path: failureScreenshot })
        console.error(`Failure screenshot saved to ${failureScreenshot}`)
      } catch {
        // Ignore screenshot failures and preserve the original error.
      }
    }

    throw error
  } finally {
    if (page) {
      try {
        await setTheme(page, originalTheme)
      } catch {
        // Ignore theme reset failures during shutdown.
      }
    }
    await electronApp.close()
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  console.error(`Electron smoke failed: ${message}`)
  process.exit(1)
})
