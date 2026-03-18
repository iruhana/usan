import type { AutomationProvider } from '../app-detector'
import { qtBridgeProvider } from './qt-bridge'
import { chromeDevtoolsProvider } from './cdp'
import { windowsMcpProvider } from './windows'
import { playwrightAutomationProvider } from './playwright'
import type { AutomationCallContext, AutomationProviderAdapter, AutomationProviderStatus, AutomationToolDescriptor } from './base'

const QT_TOOLS: AutomationToolDescriptor[] = [
  { name: 'connect', description: 'Inject and connect the Qt bridge.' },
  { name: 'getObjectTree', description: 'Read the Qt object tree.' },
  { name: 'findObject', description: 'Search Qt objects by name or class.' },
  { name: 'getProperty', description: 'Read a Qt property.' },
  { name: 'setProperty', description: 'Write a Qt property.' },
  { name: 'invokeMethod', description: 'Invoke a Qt slot or method.' },
  { name: 'screenshot', description: 'Capture a Qt widget or window screenshot.' },
]

class QtAutomationProvider implements AutomationProviderAdapter {
  readonly provider = 'qt-bridge' as const
  readonly transport = 'internal' as const

  async getStatus(): Promise<AutomationProviderStatus> {
    const connections = qtBridgeProvider.getConnectionStatus()
    const availability = await qtBridgeProvider.getAvailability()

    return {
      provider: this.provider,
      transport: this.transport,
      available: availability.available,
      configured: availability.available,
      connected: connections.length > 0,
      toolCount: QT_TOOLS.length,
      serverId: availability.helperPath,
      serverName: availability.helperPath ? 'qt-injector.exe' : undefined,
      reason: availability.reason,
    }
  }

  async listTools(): Promise<AutomationToolDescriptor[]> {
    return QT_TOOLS
  }

  async callTool(toolName: string, args: Record<string, unknown>, context?: AutomationCallContext): Promise<unknown> {
    const pid = context?.target?.pid ?? context?.pid
    if (!pid) {
      throw new Error('Qt provider requires a target PID.')
    }

    switch (toolName) {
      case 'connect':
        await qtBridgeProvider.inject(pid)
        return { success: true, pid, connections: qtBridgeProvider.getConnectionStatus() }
      case 'getObjectTree':
        return qtBridgeProvider.getObjectTree(pid, typeof args.maxDepth === 'number' ? args.maxDepth : 4)
      case 'findObject':
        return qtBridgeProvider.findObject(pid, String(args.query ?? ''))
      case 'getProperty':
        return qtBridgeProvider.getProperty(pid, String(args.objectPath ?? ''), String(args.property ?? ''))
      case 'setProperty':
        await qtBridgeProvider.setProperty(pid, String(args.objectPath ?? ''), String(args.property ?? ''), args.value)
        return { success: true, pid }
      case 'invokeMethod':
        return qtBridgeProvider.invokeMethod(
          pid,
          String(args.objectPath ?? ''),
          String(args.method ?? ''),
          Array.isArray(args.args) ? args.args : undefined,
        )
      case 'screenshot':
        return qtBridgeProvider.screenshot(
          pid,
          typeof args.objectPath === 'string' && args.objectPath.trim() ? args.objectPath.trim() : undefined,
        )
      default:
        throw new Error(`Unsupported qt-bridge tool: ${toolName}`)
    }
  }
}

const qtAutomationProvider = new QtAutomationProvider()

const PROVIDERS: Record<AutomationProvider, AutomationProviderAdapter> = {
  'qt-bridge': qtAutomationProvider,
  playwright: playwrightAutomationProvider,
  'chrome-devtools': chromeDevtoolsProvider,
  'windows-mcp': windowsMcpProvider,
}

export function getAutomationProviderAdapter(provider: AutomationProvider): AutomationProviderAdapter {
  return PROVIDERS[provider]
}

export async function getAutomationProviderStatus(provider: AutomationProvider): Promise<AutomationProviderStatus> {
  return PROVIDERS[provider].getStatus()
}

export async function listAutomationProviderStatuses(): Promise<AutomationProviderStatus[]> {
  return Promise.all([
    PROVIDERS['playwright'].getStatus(),
    PROVIDERS['chrome-devtools'].getStatus(),
    PROVIDERS['windows-mcp'].getStatus(),
    PROVIDERS['qt-bridge'].getStatus(),
  ])
}

export async function listAutomationProviderTools(provider: AutomationProvider): Promise<AutomationToolDescriptor[]> {
  return PROVIDERS[provider].listTools()
}

export async function callAutomationProviderTool(
  provider: AutomationProvider,
  toolName: string,
  args: Record<string, unknown>,
  context?: AutomationCallContext,
): Promise<unknown> {
  return PROVIDERS[provider].callTool(toolName, args, context)
}
