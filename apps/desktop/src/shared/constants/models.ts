import type { ModelInfo } from '../types/ipc'

/** Available cloud models via OpenRouter */
export const CLOUD_MODELS: ModelInfo[] = [
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'openrouter',
    isLocal: false,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    isLocal: false,
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'openrouter',
    isLocal: false,
  },
  {
    id: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (Free)',
    provider: 'openrouter',
    isLocal: false,
  },
]
