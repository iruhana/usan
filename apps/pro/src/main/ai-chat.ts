/**
 * AI Chat Engine — multi-provider (Anthropic, OpenAI, Google) with streaming + tool use.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { WebContents } from 'electron'
import type { ChatPayload, StreamChunk } from '@shared/types'
import { AI_MODELS } from '@shared/types'
import { TOOL_DEFS, executeTool } from './tools/index'

const activeStreams = new Map<string, AbortController>()

function send(sender: WebContents, chunk: StreamChunk) {
  if (!sender.isDestroyed()) sender.send('ai:chunk', chunk)
}

function getProvider(modelId: string) {
  return AI_MODELS.find((m) => m.id === modelId)?.provider ?? 'anthropic'
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

export async function handleChat(sender: WebContents, payload: ChatPayload): Promise<void> {
  const { requestId } = payload
  const abort = new AbortController()
  activeStreams.set(requestId, abort)

  try {
    const provider = getProvider(payload.model)
    switch (provider) {
      case 'anthropic':
        await handleAnthropic(sender, payload, abort)
        break
      case 'openai':
        await handleOpenAI(sender, payload, abort)
        break
      case 'google':
        await handleGoogle(sender, payload, abort)
        break
    }
  } catch (e: unknown) {
    const msg = (e as Error).message ?? String(e)
    if (!abort.signal.aborted) {
      try { send(sender, { requestId, error: msg, done: true }) } catch { /* sender gone */ }
    }
  } finally {
    activeStreams.delete(requestId)
    try { send(sender, { requestId, done: true }) } catch { /* sender gone */ }
  }
}

export function stopStream(requestId: string): void {
  activeStreams.get(requestId)?.abort()
  activeStreams.delete(requestId)
}

// ─── Anthropic (Claude) ───────────────────────────────────────────────────────

async function handleAnthropic(sender: WebContents, payload: ChatPayload, abort: AbortController) {
  const { requestId, messages, model, systemPrompt, useTools = false } = payload
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) { send(sender, { requestId, error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.', done: true }); return }

  const client = new Anthropic({ apiKey })
  const history: Anthropic.Messages.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }))

  // Agent loop (max 8 iterations for tool use)
  for (let iter = 0; iter < 8; iter++) {
    if (abort.signal.aborted) return

    const params: Anthropic.Messages.MessageCreateParamsStreaming = {
      model, max_tokens: 8096, messages: history, stream: true,
    }
    if (systemPrompt) params.system = systemPrompt
    if (useTools) (params as unknown as { tools: unknown }).tools = TOOL_DEFS

    const stream = client.messages.stream(params)
    stream.on('text', (text) => { if (!abort.signal.aborted) send(sender, { requestId, text, done: false }) })

    const finalMsg = await stream.finalMessage()
    if (abort.signal.aborted) return

    const toolUseBlocks = finalMsg.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
    )
    if (finalMsg.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) break

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
    for (const tool of toolUseBlocks) {
      send(sender, { requestId, toolCall: { name: tool.name, input: tool.input }, done: false })
      const result = await executeTool(tool.name, tool.input as Record<string, unknown>)
      send(sender, { requestId, toolResult: { id: tool.id, result }, done: false })
      toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: result })
    }

    history.push({ role: 'assistant', content: finalMsg.content })
    history.push({ role: 'user', content: toolResults })
  }
}

// ─── OpenAI (GPT / o-series) ─────────────────────────────────────────────────

async function handleOpenAI(sender: WebContents, payload: ChatPayload, abort: AbortController) {
  const { requestId, messages, model, systemPrompt } = payload
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) { send(sender, { requestId, error: 'OPENAI_API_KEY가 설정되지 않았습니다.', done: true }); return }

  const openaiMessages: Array<{ role: string; content: string }> = []
  if (systemPrompt) openaiMessages.push({ role: 'system', content: systemPrompt })
  for (const m of messages) openaiMessages.push({ role: m.role, content: m.content })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: openaiMessages, stream: true }),
    signal: abort.signal,
  })

  if (!res.ok) {
    const err = await res.text()
    send(sender, { requestId, error: `OpenAI error ${res.status}: ${err}`, done: true })
    return
  }

  // Read SSE stream
  const reader = res.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done || abort.signal.aborted) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
      try {
        const json = JSON.parse(line.slice(6))
        const delta = json.choices?.[0]?.delta?.content
        if (delta) send(sender, { requestId, text: delta, done: false })
      } catch { /* skip malformed */ }
    }
  }
}

// ─── Google (Gemini) ──────────────────────────────────────────────────────────

async function handleGoogle(sender: WebContents, payload: ChatPayload, abort: AbortController) {
  const { requestId, messages, model, systemPrompt } = payload
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) { send(sender, { requestId, error: 'GEMINI_API_KEY가 설정되지 않았습니다.', done: true }); return }

  // Build Gemini contents format
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []
  for (const m of messages) {
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })
  }

  const body: Record<string, unknown> = { contents }
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abort.signal,
  })

  if (!res.ok) {
    const err = await res.text()
    send(sender, { requestId, error: `Gemini error ${res.status}: ${err}`, done: true })
    return
  }

  // Read SSE stream
  const reader = res.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done || abort.signal.aborted) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const json = JSON.parse(line.slice(6))
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) send(sender, { requestId, text, done: false })
      } catch { /* skip malformed */ }
    }
  }
}
