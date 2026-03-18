import type { AIProvider, ProviderOptions, StreamChunk } from './base'
import { NodeLlamaRuntime } from '../local/node-llama-runtime'

export class NodeLlamaCppProvider implements AIProvider {
  readonly name = 'node-llama-cpp'
  readonly isLocal = true

  constructor(private readonly runtime = new NodeLlamaRuntime()) {}

  async isAvailable(): Promise<boolean> {
    return this.runtime.isAvailable()
  }

  async listModels(): Promise<Array<{ id: string; name: string; size?: number }>> {
    const models = await this.runtime.listModels()
    return models.map(({ id, name, size }) => ({ id, name, size }))
  }

  async chatStream(
    options: ProviderOptions,
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    await this.runtime.generateText(
      options.model,
      options.messages,
      options.signal,
      (text) => {
        onChunk({ type: 'text', text })
      },
    )
  }
}
