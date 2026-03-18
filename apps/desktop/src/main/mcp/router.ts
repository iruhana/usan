import {
  detectAutomationTarget,
  listAutomationTargets,
  type AppDetectionResult,
  type AutomationProvider,
} from './app-detector'
import { getAutomationProviderStatus } from './providers'
import type { AutomationProviderStatus } from './providers/base'

export interface AutomationRoute {
  target: AppDetectionResult
  provider: AutomationProvider
  transport: 'internal' | 'mcp'
  status: AutomationProviderStatus
}

function transportForProvider(provider: AutomationProvider): 'internal' | 'mcp' {
  if (provider === 'qt-bridge' || provider === 'playwright') {
    return 'internal'
  }
  return 'mcp'
}

export async function routeForTarget(target: AppDetectionResult): Promise<AutomationRoute> {
  const status = await getAutomationProviderStatus(target.provider)
  return {
    target,
    provider: target.provider,
    transport: transportForProvider(target.provider),
    status,
  }
}

export async function listAutomationRoutes(options: { limit?: number } = {}): Promise<AutomationRoute[]> {
  const targets = await listAutomationTargets(options)
  return Promise.all(targets.map((target) => routeForTarget(target)))
}

export async function resolveAutomationRoute(query: { pid?: number; target?: string }): Promise<AutomationRoute | null> {
  const target = await detectAutomationTarget(query)
  if (!target) return null
  return routeForTarget(target)
}
