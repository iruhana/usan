import { beforeEach, describe, expect, it, vi } from 'vitest'

const listAutomationProvidersMock = vi.fn()
const listToolsForAutomationProviderMock = vi.fn()
const callRoutedAutomationToolMock = vi.fn()

vi.mock('../../src/main/mcp', () => ({
  listAutomationProviders: () => listAutomationProvidersMock(),
  listToolsForAutomationProvider: (...args: unknown[]) => listToolsForAutomationProviderMock(...args),
  callRoutedAutomationTool: (...args: unknown[]) => callRoutedAutomationToolMock(...args),
}))

describe('mcp-routing-tools', () => {
  beforeEach(() => {
    listAutomationProvidersMock.mockReset()
    listToolsForAutomationProviderMock.mockReset()
    callRoutedAutomationToolMock.mockReset()
  })

  it('lists provider status entries', async () => {
    listAutomationProvidersMock.mockResolvedValue([
      { provider: 'playwright', available: true },
      { provider: 'windows-mcp', available: false },
    ])

    const { handlers } = await import('../../src/main/ai/tools/mcp-routing-tools')
    const result = await handlers.app_list_providers({})

    expect((result as { count: number }).count).toBe(2)
  })

  it('lists provider tools for a detected route', async () => {
    listToolsForAutomationProviderMock.mockResolvedValue({
      provider: 'chrome-devtools',
      route: { provider: 'chrome-devtools' },
      tools: [{ name: 'new_page', description: 'Open a page' }],
    })

    const { handlers } = await import('../../src/main/ai/tools/mcp-routing-tools')
    const result = await handlers.app_list_provider_tools({ target: 'Qwen' })

    expect((result as { provider: string }).provider).toBe('chrome-devtools')
    expect(listToolsForAutomationProviderMock).toHaveBeenCalledTimes(1)
  })

  it('calls the resolved provider tool with generic arguments', async () => {
    callRoutedAutomationToolMock.mockResolvedValue({
      provider: 'windows-mcp',
      route: { provider: 'windows-mcp' },
      result: { ok: true },
    })

    const { handlers } = await import('../../src/main/ai/tools/mcp-routing-tools')
    const result = await handlers.app_call_provider_tool({
      provider: 'windows-mcp',
      toolName: 'Snapshot',
      args: { use_dom: 'true' },
    })

    expect((result as { provider: string }).provider).toBe('windows-mcp')
    expect(callRoutedAutomationToolMock).toHaveBeenCalledTimes(1)
  })
})
