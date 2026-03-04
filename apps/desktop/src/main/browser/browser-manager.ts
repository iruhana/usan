/**
 * Browser Manager — high-level browser automation via Playwright CDP
 * Connects to user's actual browser (Chrome/Edge) for visible automation
 */

import { chromium, type Browser, type Page } from 'playwright-core'
import { ensureCdpBrowser } from './cdp-launcher'
import { isUrlSafe } from '../security'

let browser: Browser | null = null
let activePage: Page | null = null
let connectingPromise: Promise<Browser> | null = null

const MAX_SELECTOR_LENGTH = 500

async function ensureConnected(): Promise<Browser> {
  if (browser?.isConnected()) return browser

  if (!connectingPromise) {
    connectingPromise = (async () => {
      const endpoint = await ensureCdpBrowser()
      if (!endpoint) {
        throw new Error('브라우저를 찾을 수 없습니다. Chrome 또는 Edge를 설치해주세요.')
      }
      browser = await chromium.connectOverCDP(endpoint)
      return browser
    })().finally(() => { connectingPromise = null })
  }
  return connectingPromise
}

/** Get or create the active page */
async function getPage(): Promise<Page> {
  if (activePage && !activePage.isClosed()) return activePage
  activePage = null

  const b = await ensureConnected()
  const contexts = b.contexts()
  if (contexts.length > 0) {
    const pages = contexts[0].pages()
    activePage = pages[pages.length - 1] || await contexts[0].newPage()
  } else {
    const ctx = await b.newContext()
    activePage = await ctx.newPage()
  }
  return activePage
}

// ─── Public API ─────────────────────────────────────

/** Navigate to a URL */
export async function browserOpen(url: string): Promise<{ title: string; url: string }> {
  if (!isUrlSafe(url)) {
    throw new Error('안전하지 않은 주소입니다. http:// 또는 https:// 주소만 열 수 있습니다.')
  }
  const page = await getPage()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
  return { title: await page.title(), url: page.url() }
}

function validateSelector(selector: string): void {
  if (!selector || selector.length > MAX_SELECTOR_LENGTH) {
    throw new Error(`셀렉터가 너무 깁니다 (최대 ${MAX_SELECTOR_LENGTH}자)`)
  }
}

export async function browserClick(selector: string): Promise<{ success: boolean }> {
  validateSelector(selector)
  const page = await getPage()
  await page.click(selector, { timeout: 5000 })
  return { success: true }
}

export async function browserType(text: string, selector?: string): Promise<{ success: boolean }> {
  if (selector) validateSelector(selector)
  const page = await getPage()
  if (selector) {
    await page.fill(selector, text, { timeout: 5000 })
  } else {
    await page.keyboard.type(text)
  }
  return { success: true }
}

/** Read page content (text extraction) */
export async function browserRead(): Promise<{ title: string; url: string; text: string }> {
  const page = await getPage()
  const title = await page.title()
  const url = page.url()
  // page.evaluate runs in browser context where `document` exists
  const text = await page.evaluate('(() => { const el = document.querySelector("main") || document.querySelector("article") || document.body; return el?.innerText?.slice(0, 20000) ?? ""; })()') as string
  return { title, url, text }
}

/** Take a screenshot of the current page */
export async function browserScreenshot(): Promise<{ image: string; width: number; height: number }> {
  const page = await getPage()
  const buf = await page.screenshot({ type: 'png', fullPage: false })
  const viewport = page.viewportSize() || { width: 1280, height: 720 }
  return {
    image: buf.toString('base64'),
    width: viewport.width,
    height: viewport.height,
  }
}

/** Disconnect and cleanup */
export async function browserDisconnect(): Promise<void> {
  activePage = null
  if (browser?.isConnected()) {
    await browser.close().catch(() => {})
  }
  browser = null
}
