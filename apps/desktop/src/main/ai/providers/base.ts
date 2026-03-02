/**
 * Base AI provider interface — all providers implement this
 * Adapted from OpenClaw's provider pattern for Usan
 */

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ProviderToolCall[]
  toolCallId?: string
}

export interface ProviderToolCall {
  id: string
  name: string
  arguments: string // JSON string
}

export interface ProviderTool {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'done' | 'error'
  text?: string
  toolCall?: ProviderToolCall
  error?: string
}

export interface ProviderOptions {
  model: string
  messages: ProviderMessage[]
  tools?: ProviderTool[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface AIProvider {
  readonly name: string
  readonly isLocal: boolean

  /** Check if provider is available */
  isAvailable(): Promise<boolean>

  /** List available models */
  listModels(): Promise<Array<{ id: string; name: string; size?: number }>>

  /** Stream a chat completion */
  chatStream(
    options: ProviderOptions,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>
}
