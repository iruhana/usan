/**
 * AI Tab Manager
 * Manages WebContentsView instances for web-embedded AI providers.
 * Each provider gets its own persistent WebContentsView, shown/hidden on switch.
 */

import { WebContentsView, BrowserWindow, session } from 'electron'
import { AI_PROVIDERS } from '@shared/types'

interface TabEntry {
  providerId: string
  view: WebContentsView
  loaded: boolean
}

export class AITabManager {
  private tabs = new Map<string, TabEntry>()
  private activeId: string | null = null
  private win: BrowserWindow
  private contentBounds: Electron.Rectangle

  constructor(win: BrowserWindow, contentBounds: Electron.Rectangle) {
    this.win = win
    this.contentBounds = contentBounds
  }

  updateBounds(bounds: Electron.Rectangle): void {
    this.contentBounds = bounds
    if (this.activeId) {
      const entry = this.tabs.get(this.activeId)
      if (entry) entry.view.setBounds(bounds)
    }
  }

  async switchTo(providerId: string): Promise<void> {
    const provider = AI_PROVIDERS.find((p) => p.id === providerId)
    if (!provider || provider.type !== 'web') {
      // Hide all web views for API providers
      this.hideAll()
      this.activeId = providerId
      return
    }

    // Hide currently active
    if (this.activeId && this.activeId !== providerId) {
      const prev = this.tabs.get(this.activeId)
      if (prev) prev.view.setVisible(false)
    }

    // Create if doesn't exist
    if (!this.tabs.has(providerId)) {
      await this.createTab(provider)
    }

    const entry = this.tabs.get(providerId)!
    entry.view.setBounds(this.contentBounds)
    entry.view.setVisible(true)
    this.activeId = providerId
  }

  hideAll(): void {
    for (const entry of Array.from(this.tabs.values())) {
      entry.view.setVisible(false)
    }
  }

  private async createTab(provider: { id: string; url?: string }): Promise<void> {
    const partitionId = `persist:ai-${provider.id}`
    const ses = session.fromPartition(partitionId)

    // Allow all content (needed for embedded AI apps)
    ses.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders }
      // Remove X-Frame-Options to allow embedding
      delete headers['x-frame-options']
      delete headers['X-Frame-Options']
      // Relax CSP frame-ancestors
      if (headers['content-security-policy']) {
        headers['content-security-policy'] = (headers['content-security-policy'] as string[]).map(
          (csp) => csp.replace(/frame-ancestors[^;]*(;|$)/gi, '')
        )
      }
      callback({ responseHeaders: headers })
    })

    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    })

    this.win.contentView.addChildView(view)
    view.setBounds(this.contentBounds)
    view.setVisible(false)

    if (provider.url) {
      await view.webContents.loadURL(provider.url)
    }

    this.tabs.set(provider.id, { providerId: provider.id, view, loaded: true })
  }

  destroy(): void {
    for (const entry of Array.from(this.tabs.values())) {
      this.win.contentView.removeChildView(entry.view)
    }
    this.tabs.clear()
  }
}
