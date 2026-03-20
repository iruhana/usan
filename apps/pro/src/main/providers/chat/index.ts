import type { AIModelProvider } from '@shared/types'
import { anthropicChatProvider } from './anthropic-provider'
import { googleChatProvider } from './google-provider'
import { openAiChatProvider } from './openai-provider'
import type { ChatProviderAdapter } from './types'

const CHAT_PROVIDER_REGISTRY: Record<AIModelProvider, ChatProviderAdapter> = {
  anthropic: anthropicChatProvider,
  openai: openAiChatProvider,
  google: googleChatProvider,
}

export function getChatProviderAdapter(provider: AIModelProvider): ChatProviderAdapter {
  return CHAT_PROVIDER_REGISTRY[provider]
}

export type {
  ApprovalResolution,
  ChatProviderContext,
  ChatRuntime,
  ProviderToolRuntime,
  RecordToolResultOptions,
} from './types'
