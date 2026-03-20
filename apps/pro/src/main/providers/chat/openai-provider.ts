import { getProviderSecret } from '../../platform/secret-store'
import { normalizeProviderMessages, type NormalizedProviderMessage } from './message-content'
import { type ChatProviderAdapter } from './types'

type OpenAiChatMessage = {
  role: string
  content: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >
}

type OpenAiResponsesMessage = {
  role: 'user' | 'assistant'
  content: Array<
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: string }
    | { type: 'input_file'; filename: string; file_data: string }
  > | string
}

type OpenAiResponsesContentPart = Exclude<OpenAiResponsesMessage['content'], string>[number]

function hasNativeDocuments(messages: NormalizedProviderMessage[]): boolean {
  return messages.some((message) => message.documentAttachments.length > 0)
}

function toChatCompletionsMessages(messages: NormalizedProviderMessage[]): OpenAiChatMessage[] {
  return messages.map((message) => {
    if (message.imageAttachments.length === 0) {
      return { role: message.role, content: message.text }
    }

    const contentParts: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = []

    if (message.text.trim()) {
      contentParts.push({ type: 'text', text: message.text })
    }

    for (const attachment of message.imageAttachments) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: attachment.dataUrl },
      })
    }

    return {
      role: message.role,
      content: contentParts,
    }
  })
}

function toResponsesInput(messages: NormalizedProviderMessage[]): OpenAiResponsesMessage[] {
  return messages.map((message) => {
    if (message.role === 'assistant') {
      return {
        role: 'assistant',
        content: message.text,
      }
    }

    const content: OpenAiResponsesContentPart[] = []

    if (message.text.trim()) {
      content.push({
        type: 'input_text',
        text: message.text,
      })
    }

    for (const attachment of message.imageAttachments) {
      content.push({
        type: 'input_image',
        image_url: attachment.dataUrl,
      })
    }

    for (const attachment of message.documentAttachments) {
      content.push({
        type: 'input_file',
        filename: attachment.name,
        file_data: attachment.dataUrl,
      })
    }

    return {
      role: 'user',
      content,
    }
  })
}

async function runChatCompletions(
  apiKey: string,
  model: string,
  messages: NormalizedProviderMessage[],
  abort: AbortController,
  appendText: (text: string) => void,
  systemPrompt?: string,
): Promise<void> {
  const openaiMessages = toChatCompletionsMessages(messages)
  if (systemPrompt) {
    openaiMessages.unshift({ role: 'system', content: systemPrompt })
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: openaiMessages, stream: true }),
    signal: abort.signal,
  })

  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('OpenAI response body is empty')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done || abort.signal.aborted) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') {
        continue
      }

      try {
        const json = JSON.parse(line.slice(6))
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          appendText(delta)
        }
      } catch {
        // Ignore malformed SSE frames.
      }
    }
  }
}

async function runResponsesApi(
  apiKey: string,
  model: string,
  messages: NormalizedProviderMessage[],
  abort: AbortController,
  appendText: (text: string) => void,
  systemPrompt?: string,
): Promise<void> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: toResponsesInput(messages),
      instructions: systemPrompt,
      stream: true,
    }),
    signal: abort.signal,
  })

  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('OpenAI response body is empty')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done || abort.signal.aborted) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) {
        continue
      }

      try {
        const json = JSON.parse(line.slice(6))
        if (json.type === 'response.output_text.delta' && typeof json.delta === 'string') {
          appendText(json.delta)
        }
        if (json.type === 'error') {
          const message = json.error?.message
          if (typeof message === 'string' && message.trim()) {
            throw new Error(message)
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        // Ignore malformed SSE frames.
      }
    }
  }
}

export const openAiChatProvider: ChatProviderAdapter = {
  async run({ payload, abort, tools }) {
    const { model, systemPrompt } = payload
    const apiKey = getProviderSecret('openai')
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    const normalizedMessages = normalizeProviderMessages(payload, {
      nativeFileMode: 'all',
    })

    if (hasNativeDocuments(normalizedMessages)) {
      await runResponsesApi(apiKey, model, normalizedMessages, abort, tools.appendText, systemPrompt)
      return
    }

    await runChatCompletions(apiKey, model, normalizedMessages, abort, tools.appendText, systemPrompt)
  },
}
