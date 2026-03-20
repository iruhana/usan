import Anthropic from '@anthropic-ai/sdk'
import { getProviderSecret } from '../../platform/secret-store'
import { normalizeProviderMessages } from './message-content'
import { type ChatProviderAdapter } from './types'

export const anthropicChatProvider: ChatProviderAdapter = {
  async run({ payload, abort, tools }) {
    const { model, systemPrompt, useTools = false } = payload
    const apiKey = getProviderSecret('anthropic')
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured')
    }

    const client = new Anthropic({ apiKey })
    const history: Anthropic.Messages.MessageParam[] = normalizeProviderMessages(payload, {
      nativeFileMode: 'pdf_text',
    }).map((message) => {
      if (message.imageAttachments.length === 0 && message.documentAttachments.length === 0) {
        return {
          role: message.role,
          content: message.text,
        }
      }

      const content: Anthropic.Messages.ContentBlockParam[] = []
      if (message.text.trim()) {
        content.push({
          type: 'text',
          text: message.text,
        })
      }

      for (const attachment of message.imageAttachments) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: attachment.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: attachment.base64Data,
          },
        })
      }

      for (const attachment of message.documentAttachments) {
        content.push({
          type: 'document',
          source: {
            type: 'base64',
            // Anthropic's SDK type still narrows document media types to PDF, but the API
            // accepts plain text document blocks as well.
            media_type: attachment.mimeType as 'application/pdf',
            data: attachment.base64Data,
          },
        })
      }

      return {
        role: message.role,
        content,
      }
    })

    for (let iteration = 0; iteration < 8; iteration += 1) {
      if (tools.isAborted()) {
        return
      }

      const params: Anthropic.Messages.MessageCreateParamsStreaming = {
        model,
        max_tokens: 8096,
        messages: history,
        stream: true,
      }

      if (systemPrompt) {
        params.system = systemPrompt
      }
      if (useTools) {
        ;(params as Anthropic.Messages.MessageCreateParamsStreaming & { tools: Anthropic.Messages.ToolUnion[] }).tools =
          tools.toolDefs as Anthropic.Messages.ToolUnion[]
      }

      const stream = client.messages.stream(params)
      stream.on('text', (text) => {
        if (!tools.isAborted()) {
          tools.appendText(text)
        }
      })

      const finalMessage = await stream.finalMessage()
      if (abort.signal.aborted) {
        return
      }

      const toolUseBlocks = finalMessage.content.filter(
        (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use',
      )
      if (finalMessage.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
        break
      }

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
      for (const tool of toolUseBlocks) {
        if (abort.signal.aborted) {
          return
        }

        const toolInput = tool.input as Record<string, unknown>
        const stepId = tools.recordToolCall(tool.id, tool.name, toolInput)
        const executionPolicy = tools.getExecutionPolicy(tool.name)

        if (executionPolicy.requiresApproval) {
          const approvalDecision = await tools.requestApproval(
            tool.name,
            toolInput,
            stepId,
            executionPolicy,
          )
          if (abort.signal.aborted || approvalDecision === 'aborted') {
            return
          }

          tools.markSessionRunning()

          if (approvalDecision === 'denied') {
            const deniedResult = tools.createApprovalDeniedResult(tool.name, executionPolicy)
            tools.recordToolResult(tool.id, tool.name, deniedResult, {
              finalizeStep: false,
              logLevel: 'warn',
              stepStatus: 'skipped',
            })
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tool.id,
              content: deniedResult,
            })
            continue
          }
        }

        try {
          const result = await tools.executeTool(tool.name, toolInput)
          if (abort.signal.aborted) {
            return
          }

          tools.recordToolResult(tool.id, tool.name, result)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: result,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          tools.recordToolFailure(tool.id, tool.name, message)
          throw error
        }
      }

      history.push({ role: 'assistant', content: finalMessage.content })
      history.push({ role: 'user', content: toolResults })
    }
  },
}
