/**
 * Model Router — OpenRouter-only model selection
 */

import type { AIProvider } from './providers/base'
import type { ModelInfo } from '@shared/types/ipc'
import type { AppSettings } from '@shared/types/ipc'
import { OpenRouterProvider } from './providers/openrouter'
import { CLOUD_MODELS } from '@shared/constants/models'

export class ModelRouter {
  private provider: OpenRouterProvider | null = null

  /** Update provider based on user settings */
  updateSettings(settings: AppSettings): void {
    if (settings.cloudApiKey) {
      this.provider = new OpenRouterProvider(settings.cloudApiKey)
    }
  }

  /** Get the provider for a model ID */
  getProvider(_modelId: string): AIProvider | null {
    return this.provider ?? null
  }

  /** Auto-select the best available model */
  async autoSelect(): Promise<{ provider: AIProvider; modelId: string } | null> {
    if (this.provider && (await this.provider.isAvailable())) {
      return { provider: this.provider, modelId: 'google/gemini-2.5-flash' }
    }
    return null
  }

  /** List all available models */
  async listModels(): Promise<ModelInfo[]> {
    if (this.provider && (await this.provider.isAvailable())) {
      return CLOUD_MODELS.map((m) => ({ ...m }))
    }
    return []
  }
}
