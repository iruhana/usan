import { getProviderSecret } from '../../platform/secret-store'
import { normalizeProviderMessages } from './message-content'
import { type ChatProviderAdapter } from './types'

export const googleChatProvider: ChatProviderAdapter = {
  async run({ payload, abort, tools }) {
    const { model, systemPrompt } = payload
    const apiKey = getProviderSecret('google')
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured')
    }

    const contents: Array<{
      role: string
      parts: Array<
        | { text: string }
        | { inline_data: { mime_type: string; data: string } }
      >
    }> = []

    for (const message of normalizeProviderMessages(payload, { nativeFileMode: 'gemini_docs' })) {
      const parts: Array<
        | { text: string }
        | { inline_data: { mime_type: string; data: string } }
      > = []

      if (message.text.trim()) {
        parts.push({ text: message.text })
      }

      for (const attachment of message.imageAttachments) {
        parts.push({
          inline_data: {
            mime_type: attachment.mimeType,
            data: attachment.base64Data,
          },
        })
      }

      for (const attachment of message.documentAttachments) {
        parts.push({
          inline_data: {
            mime_type: attachment.mimeType,
            data: attachment.base64Data,
          },
        })
      }

      contents.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts,
      })
    }

    const body: Record<string, unknown> = { contents }
    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abort.signal,
      },
    )

    if (!response.ok) {
      throw new Error(`Gemini error ${response.status}: ${await response.text()}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Gemini response body is empty')
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
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            tools.appendText(text)
          }
        } catch {
          // Ignore malformed SSE frames.
        }
      }
    }
  },
}
