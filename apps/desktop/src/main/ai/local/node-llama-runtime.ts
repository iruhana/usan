import { app } from 'electron'
import { existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { basename, join } from 'path'
import type { ModelInfo } from '@shared/types/ipc'
import type { ProviderMessage } from '../providers/base'

const MODEL_DISCOVERY_DIRECTORIES = [
  process.env['USAN_NODE_LLAMA_MODEL_DIR']?.trim(),
  process.env['USAN_LOCAL_MODEL_DIR']?.trim(),
].filter((value): value is string => typeof value === 'string' && value.length > 0)

const MODEL_DISCOVERY_PATHS = [
  process.env['USAN_NODE_LLAMA_MODEL_PATH']?.trim(),
  process.env['USAN_LOCAL_GGUF_PATH']?.trim(),
].filter((value): value is string => typeof value === 'string' && value.length > 0)

export function buildNodeLlamaModelId(modelName: string): string {
  return `node-llama-cpp/${modelName}`
}

export function parseNodeLlamaModelId(modelId: string): string {
  return modelId.startsWith('node-llama-cpp/') ? modelId.slice('node-llama-cpp/'.length) : modelId
}

export class NodeLlamaRuntime {
  private importedModule: Promise<any> | null = null
  private discoveredModel: Promise<ModelInfo | null> | null = null
  private loadedModel = new Map<string, Promise<any>>()

  async listModels(): Promise<ModelInfo[]> {
    const model = await this.discoverModel()
    return model ? [model] : []
  }

  async isAvailable(): Promise<boolean> {
    const models = await this.listModels()
    return models.length > 0
  }

  async generateText(
    modelId: string,
    messages: ProviderMessage[],
    signal: AbortSignal | undefined,
    onTextChunk: (text: string) => void,
  ): Promise<void> {
    const selectedModel = await this.discoverModel()
    if (!selectedModel) {
      throw new Error('node-llama-cpp is not ready. Install the package and place a GGUF model in the local model directory.')
    }

    const requestedModelName = parseNodeLlamaModelId(modelId)
    if (requestedModelName && requestedModelName !== parseNodeLlamaModelId(selectedModel.id)) {
      throw new Error(`Requested local model "${requestedModelName}" is not available.`)
    }

    const nodeLlama = await this.importNodeLlamaModule()
    const { getLlama, LlamaChatSession } = nodeLlama
    const modelPath = await this.resolveModelPath()
    if (!modelPath) {
      throw new Error('No GGUF model file was found for node-llama-cpp.')
    }

    const llama = await getLlama()
    const model = await this.getOrLoadModel(llama, modelPath)
    const context = await model.createContext()
    const sequence = typeof context.getSequence === 'function' ? context.getSequence() : context.sequence
    const systemPrompt = extractSystemPrompt(messages)
    const prompt = buildNodeLlamaPrompt(messages)
    const session = new LlamaChatSession({
      contextSequence: sequence,
      systemPrompt,
    })

    try {
      await session.prompt(prompt, {
        signal,
        onTextChunk,
      })
    } finally {
      context.dispose?.()
      sequence?.dispose?.()
    }
  }

  private async discoverModel(): Promise<ModelInfo | null> {
    if (!this.discoveredModel) {
      this.discoveredModel = this.resolveModelPath().then(async (modelPath) => {
        if (!modelPath) {
          return null
        }

        try {
          await this.importNodeLlamaModule()
        } catch {
          return null
        }

        const stats = await stat(modelPath)
        const modelName = basename(modelPath).replace(/\.gguf$/i, '')
        return {
          id: buildNodeLlamaModelId(modelName),
          name: `Local GGUF ${modelName}`,
          provider: 'node-llama-cpp',
          isLocal: true,
          size: stats.size,
        }
      })
    }

    return this.discoveredModel
  }

  private async resolveModelPath(): Promise<string | null> {
    for (const candidate of MODEL_DISCOVERY_PATHS) {
      if (existsSync(candidate)) {
        return candidate
      }
    }

    const candidateDirectories = [
      ...MODEL_DISCOVERY_DIRECTORIES,
      join(app.getPath('userData'), 'models', 'local-ai'),
      join(process.cwd(), 'models', 'local-ai'),
      join(process.resourcesPath, 'models', 'local-ai'),
    ]

    for (const directory of candidateDirectories) {
      if (!directory || !existsSync(directory)) {
        continue
      }

      const entries = await readdir(directory, { withFileTypes: true })
      const files = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.gguf'))
        .map((entry) => join(directory, entry.name))
        .sort((left, right) => left.localeCompare(right))

      if (files.length > 0) {
        return files[0]
      }
    }

    return null
  }

  private async importNodeLlamaModule(): Promise<any> {
    if (!this.importedModule) {
      const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>
      this.importedModule = dynamicImport('node-llama-cpp')
    }
    return this.importedModule
  }

  private async getOrLoadModel(llama: any, modelPath: string): Promise<any> {
    const existing = this.loadedModel.get(modelPath)
    if (existing) {
      return existing
    }

    const loadPromise = llama.loadModel({ modelPath })
    this.loadedModel.set(modelPath, loadPromise)
    return loadPromise
  }
}

function extractSystemPrompt(messages: ProviderMessage[]): string {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n')
}

function buildNodeLlamaPrompt(messages: ProviderMessage[]): string {
  const recentMessages = messages.filter((message) => message.role !== 'system').slice(-12)
  const transcript = recentMessages
    .map((message) => {
      const label = message.role === 'assistant'
        ? 'Assistant'
        : message.role === 'tool'
          ? 'Tool'
          : 'User'
      const body = [message.content]
      if (message.toolCalls?.length) {
        body.push(
          ...message.toolCalls.map((toolCall) => `Tool call: ${toolCall.name} ${toolCall.arguments}`),
        )
      }
      return `${label}: ${body.filter(Boolean).join('\n')}`
    })
    .join('\n\n')

  return [
    'Use the conversation transcript below and answer the latest user request.',
    'You are running in a local offline runtime, so be concise and practical.',
    '',
    transcript,
  ].join('\n')
}
