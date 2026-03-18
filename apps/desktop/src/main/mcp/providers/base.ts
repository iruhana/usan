import type { AppDetectionResult, AutomationProvider } from '../app-detector'

export interface AutomationToolDescriptor {
  name: string
  description: string
}

export interface AutomationProviderStatus {
  provider: AutomationProvider
  transport: 'internal' | 'mcp'
  available: boolean
  configured: boolean
  connected: boolean
  toolCount: number
  serverId?: string
  serverName?: string
  reason?: string
}

export interface AutomationCallContext {
  target?: AppDetectionResult
  pid?: number
  targetName?: string
}

export interface AutomationProviderAdapter {
  readonly provider: AutomationProvider
  readonly transport: 'internal' | 'mcp'
  getStatus(): Promise<AutomationProviderStatus>
  listTools(): Promise<AutomationToolDescriptor[]>
  callTool(toolName: string, args: Record<string, unknown>, context?: AutomationCallContext): Promise<unknown>
}
