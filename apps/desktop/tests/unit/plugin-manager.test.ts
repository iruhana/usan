import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { rm, stat } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const electronState = vi.hoisted(() => ({
  appPath: '',
  tempPath: '',
  userDataPath: '',
}))

const mcpRegistryState = vi.hoisted(() => ({
  configs: [] as Array<{
    id: string
    name: string
    transport: 'stdio' | 'sse'
    command?: string
    args?: string[]
    url?: string
    env?: Record<string, string>
  }>,
}))

const mcpRegistryMock = vi.hoisted(() => ({
  addServer: vi.fn(async (config) => {
    mcpRegistryState.configs.push(config)
  }),
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(() => {}),
  getAllConfigs: vi.fn(() => [...mcpRegistryState.configs]),
  removeServer: vi.fn(async (id: string) => {
    mcpRegistryState.configs = mcpRegistryState.configs.filter((config) => config.id !== id)
  }),
}))

const eventBusMock = vi.hoisted(() => ({
  emit: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    getAppPath: () => electronState.appPath,
    getPath: (name: string) => {
      if (name === 'userData') return electronState.userDataPath
      if (name === 'temp') return electronState.tempPath
      return electronState.userDataPath
    },
    isPackaged: false,
  },
}))

vi.mock('../../src/main/mcp/mcp-registry', () => ({
  mcpRegistry: mcpRegistryMock,
}))

vi.mock('../../src/main/infrastructure/event-bus', () => ({
  eventBus: eventBusMock,
}))

import { PluginManager } from '../../src/main/infrastructure/plugin-manager'

describe('plugin-manager managed MCP lifecycle', () => {
  let workspaceRoot: string
  let pluginSourceDir: string

  beforeEach(async () => {
    vi.clearAllMocks()
    mcpRegistryState.configs = []

    workspaceRoot = mkdtempSync(join(tmpdir(), 'usan-plugin-manager-'))
    electronState.userDataPath = join(workspaceRoot, 'user-data')
    electronState.appPath = join(workspaceRoot, 'app')
    electronState.tempPath = join(workspaceRoot, 'temp')

    mkdirSync(electronState.userDataPath, { recursive: true })
    mkdirSync(electronState.appPath, { recursive: true })
    mkdirSync(electronState.tempPath, { recursive: true })

    pluginSourceDir = join(workspaceRoot, 'source-plugin')
    mkdirSync(join(pluginSourceDir, 'servers'), { recursive: true })
    writeFileSync(
      join(pluginSourceDir, 'manifest.json'),
      JSON.stringify({
        id: 'bundle-plugin',
        name: 'Bundle Plugin',
        version: '1.0.0',
        description: 'Ships a managed MCP bridge.',
        author: 'Usan',
        skills: ['browser', 'automation'],
        mcpServers: [
          {
            id: 'browser-bridge',
            name: 'Browser Bridge',
            transport: 'stdio',
            command: 'servers/browser-bridge.exe',
            args: ['--mcp'],
            autoConnect: true,
          },
        ],
      }, null, 2),
      'utf8',
    )
    writeFileSync(join(pluginSourceDir, 'servers', 'browser-bridge.exe'), 'stub', 'utf8')
  })

  it('registers, disconnects, reconnects, and removes managed MCP servers with the plugin lifecycle', async () => {
    const manager = new PluginManager()
    await manager.init()

    const installed = await manager.install(pluginSourceDir)

    expect(installed.managedMcpServerIds).toEqual(['bundle-plugin--browser-bridge'])
    expect(mcpRegistryMock.addServer).toHaveBeenCalledWith(expect.objectContaining({
      id: 'bundle-plugin--browser-bridge',
      name: 'Browser Bridge',
      command: join(electronState.userDataPath, 'plugins', 'bundle-plugin', 'servers', 'browser-bridge.exe'),
      args: ['--mcp'],
    }))
    expect(mcpRegistryMock.connect).toHaveBeenCalledWith('bundle-plugin--browser-bridge')

    await manager.disable('bundle-plugin')
    expect(mcpRegistryMock.disconnect).toHaveBeenCalledWith('bundle-plugin--browser-bridge')

    mcpRegistryMock.connect.mockClear()
    await manager.enable('bundle-plugin')
    expect(mcpRegistryMock.connect).toHaveBeenCalledWith('bundle-plugin--browser-bridge')

    await manager.uninstall('bundle-plugin')
    expect(mcpRegistryMock.removeServer).toHaveBeenCalledWith('bundle-plugin--browser-bridge')
    await expect(stat(join(electronState.userDataPath, 'plugins', 'bundle-plugin'))).rejects.toThrow()

    await rm(workspaceRoot, { recursive: true, force: true })
  })
})
