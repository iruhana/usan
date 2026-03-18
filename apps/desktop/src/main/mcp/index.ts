import { detectAutomationTarget, type AutomationProvider } from './app-detector'
import {
  callAutomationProviderTool,
  listAutomationProviderStatuses,
  listAutomationProviderTools,
} from './providers'
import type { AutomationToolDescriptor } from './providers/base'
import { resolveAutomationRoute, type AutomationRoute } from './router'

export interface RoutedAutomationToolResult {
  provider: AutomationProvider
  route: AutomationRoute | null
  result: unknown
}

export async function listAutomationProviders() {
  return listAutomationProviderStatuses()
}

export async function listToolsForAutomationProvider(input: {
  provider?: AutomationProvider
  pid?: number
  target?: string
}): Promise<{ provider: AutomationProvider; route: AutomationRoute | null; tools: AutomationToolDescriptor[] }> {
  let provider = input.provider
  let route: AutomationRoute | null = null

  if (!provider) {
    route = await resolveAutomationRoute({ pid: input.pid, target: input.target })
    if (!route) {
      throw new Error('Unable to resolve an automation route for the requested target.')
    }
    provider = route.provider
  } else if (input.pid != null || input.target) {
    route = await resolveAutomationRoute({ pid: input.pid, target: input.target })
  }

  const tools = await listAutomationProviderTools(provider)
  return { provider, route, tools }
}

export async function callRoutedAutomationTool(input: {
  provider?: AutomationProvider
  pid?: number
  target?: string
  toolName: string
  args?: Record<string, unknown>
}): Promise<RoutedAutomationToolResult> {
  let provider = input.provider
  let route: AutomationRoute | null = null
  const detectedTarget =
    input.pid != null || input.target
      ? await detectAutomationTarget({ pid: input.pid, target: input.target })
      : null

  if (!provider) {
    route = await resolveAutomationRoute({ pid: input.pid, target: input.target })
    if (!route) {
      throw new Error('Unable to resolve an automation route for the requested target.')
    }
    provider = route.provider
  } else if (detectedTarget) {
    route = await resolveAutomationRoute({ pid: detectedTarget.pid, target: input.target })
  }

  const result = await callAutomationProviderTool(
    provider,
    input.toolName,
    input.args ?? {},
    {
      target: route?.target ?? detectedTarget ?? undefined,
      pid: input.pid,
      targetName: input.target,
    },
  )

  return {
    provider,
    route,
    result,
  }
}
