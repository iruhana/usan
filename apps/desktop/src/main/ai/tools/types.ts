/**
 * Shared types for tool modules.
 * Each module exports definitions[] + handlers{} using these types.
 */
import type { ProviderTool } from '../providers/base'

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>

export interface ToolModule {
  definitions: ProviderTool[]
  handlers: Record<string, ToolHandler>
}
