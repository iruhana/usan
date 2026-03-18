import type { AIProvider, ProviderOptions, StreamChunk } from './base'
import { OllamaClient } from '../local/ollama-client'

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama'
  readonly isLocal = true

  constructor(private readonly client = new OllamaClient()) {}

  async isAvailable(): Promise<boolean> {
    return this.client.isReachable()
  }

  async listModels(): Promise<Array<{ id: string; name: string; size?: number }>> {
    const models = await this.client.listModels()
    return models.map(({ id, name, size }) => ({ id, name, size }))
  }

  async chatStream(
    options: ProviderOptions,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    await this.client.chatStream(options, onChunk)
  }
}
