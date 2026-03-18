import {
  browserClick,
  browserDisconnect,
  browserOpen,
  browserRead,
  browserScreenshot,
  browserType,
} from '../../browser/browser-manager'
import type { AutomationCallContext, AutomationProviderAdapter, AutomationProviderStatus, AutomationToolDescriptor } from './base'

const PLAYWRIGHT_TOOLS: AutomationToolDescriptor[] = [
  { name: 'open', description: 'Open a URL in the isolated browser session.' },
  { name: 'click', description: 'Click a DOM selector in the current page.' },
  { name: 'type', description: 'Type into the current page, optionally with a selector.' },
  { name: 'read', description: 'Read the current page title, URL, and text content.' },
  { name: 'screenshot', description: 'Capture the current browser viewport.' },
  { name: 'disconnect', description: 'Disconnect the browser automation session.' },
]

class PlaywrightAutomationProvider implements AutomationProviderAdapter {
  readonly provider = 'playwright' as const
  readonly transport = 'internal' as const

  async getStatus(): Promise<AutomationProviderStatus> {
    return {
      provider: this.provider,
      transport: this.transport,
      available: true,
      configured: true,
      connected: false,
      toolCount: PLAYWRIGHT_TOOLS.length,
      reason: 'Built-in browser automation provider.',
    }
  }

  async listTools(): Promise<AutomationToolDescriptor[]> {
    return PLAYWRIGHT_TOOLS
  }

  async callTool(toolName: string, args: Record<string, unknown>, _context?: AutomationCallContext): Promise<unknown> {
    switch (toolName) {
      case 'open':
        return browserOpen(String(args.url ?? ''))
      case 'click':
        return browserClick(String(args.selector ?? ''))
      case 'type':
        return browserType(String(args.text ?? ''), typeof args.selector === 'string' ? args.selector : undefined)
      case 'read':
        return browserRead()
      case 'screenshot':
        return browserScreenshot()
      case 'disconnect':
        await browserDisconnect()
        return { success: true }
      default:
        throw new Error(`Unsupported playwright tool: ${toolName}`)
    }
  }
}

export const playwrightAutomationProvider = new PlaywrightAutomationProvider()
