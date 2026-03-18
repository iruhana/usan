import { launchApp, type LaunchArgs } from './app-launcher'

export interface RegisteredApp {
  id: string
  label: string
  command: string
  defaultArgs?: LaunchArgs
}

const DEFAULT_APPS: RegisteredApp[] = [
  { id: 'browser', label: 'Browser', command: 'chrome' },
  { id: 'terminal', label: 'Terminal', command: 'wt' },
  { id: 'explorer', label: 'Explorer', command: 'explorer' },
  { id: 'vscode', label: 'VS Code', command: 'code' },
]

const registry = new Map<string, RegisteredApp>(DEFAULT_APPS.map((item) => [item.id, item]))

export function listRegisteredApps(): RegisteredApp[] {
  return Array.from(registry.values())
}

export function registerApp(definition: RegisteredApp): void {
  const id = definition.id.trim()
  if (!id) throw new Error('App id is required')
  if (!definition.command.trim()) throw new Error('App command is required')
  registry.set(id, {
    id,
    label: definition.label.trim() || id,
    command: definition.command.trim(),
    defaultArgs:
      Array.isArray(definition.defaultArgs)
        ? definition.defaultArgs.map((item) => String(item).trim()).filter(Boolean)
        : definition.defaultArgs?.trim() || undefined,
  })
}

export function unregisterApp(id: string): boolean {
  return registry.delete(id.trim())
}

export function getRegisteredApp(id: string): RegisteredApp | null {
  return registry.get(id.trim()) ?? null
}

export async function launchRegisteredApp(id: string, args?: LaunchArgs): Promise<{ pid: number }> {
  const appDef = getRegisteredApp(id)
  if (!appDef) {
    throw new Error(`Unknown app id: ${id}`)
  }

  const mergedArgs = [appDef.defaultArgs, args].flatMap((item) => {
    if (item == null) return []
    return Array.isArray(item) ? item : [item]
  })
  const normalizedArgs = mergedArgs
    .map((item) => String(item).trim())
    .filter(Boolean)

  return launchApp(appDef.command, normalizedArgs.length > 0 ? normalizedArgs : undefined)
}
