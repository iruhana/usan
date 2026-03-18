import { beforeEach, describe, expect, it, vi } from 'vitest'

const callToolMock = vi.fn()
const getAllConfigsMock = vi.fn()
const getClientMock = vi.fn()

vi.mock('../../src/main/mcp/mcp-registry', () => ({
  mcpRegistry: {
    getAllConfigs: () => getAllConfigsMock(),
    getClient: (id: string) => getClientMock(id),
    callTool: (...args: unknown[]) => callToolMock(...args),
  },
}))

describe('automation providers', () => {
  beforeEach(() => {
    callToolMock.mockReset()
    getAllConfigsMock.mockReset()
    getClientMock.mockReset()
  })

  it('reports chrome-devtools availability from a connected MCP server', async () => {
    getAllConfigsMock.mockReturnValue([
      { id: 'chrome-devtools', name: 'Chrome DevTools', transport: 'stdio' },
    ])
    getClientMock.mockReturnValue({
      isConnected: true,
      getTools: () => [{ name: 'new_page', description: 'Open a page', inputSchema: {} }],
    })

    const { chromeDevtoolsProvider } = await import('../../src/main/mcp/providers/cdp')
    const status = await chromeDevtoolsProvider.getStatus()
    const tools = await chromeDevtoolsProvider.listTools()

    expect(status.available).toBe(true)
    expect(status.serverId).toBe('chrome-devtools')
    expect(tools[0]?.name).toBe('new_page')
  })

  it('reports windows-mcp as unavailable when no server is configured', async () => {
    getAllConfigsMock.mockReturnValue([])
    getClientMock.mockReturnValue(undefined)

    const { windowsMcpProvider } = await import('../../src/main/mcp/providers/windows')
    const status = await windowsMcpProvider.getStatus()

    expect(status.available).toBe(false)
    expect(status.configured).toBe(false)
  })

  it('lists built-in playwright tools', async () => {
    const { playwrightAutomationProvider } = await import('../../src/main/mcp/providers/playwright')
    const tools = await playwrightAutomationProvider.listTools()

    expect(tools.some((tool) => tool.name === 'open')).toBe(true)
    expect(tools.some((tool) => tool.name === 'screenshot')).toBe(true)
  })
})
