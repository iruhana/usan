/**
 * AI IPC handlers — bridges AgentLoop to renderer via IPC
 */

import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '@shared/constants/channels'
import type { ChatRequest, AppSettings, Locale } from '@shared/types/ipc'
import { AgentLoop } from '../ai/agent-loop'
import { ModelRouter } from '../ai/model-router'

const agentLoop = new AgentLoop()
const modelRouter = new ModelRouter()

export function registerAiIpcHandlers(): void {
  // ─── Chat (streaming via events) ──────────────────
  ipcMain.handle(IPC.AI_CHAT, async (event, req: ChatRequest) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    if (typeof req.conversationId !== 'string' || req.conversationId.length > 128) return
    if (typeof req.message !== 'string' || req.message.length > 100000) return

    // Resolve provider + model
    let provider = req.modelId ? modelRouter.getProvider(req.modelId) : null
    let modelId = req.modelId || ''

    if (!provider) {
      const auto = await modelRouter.autoSelect()
      if (!auto) {
        const errMsg = agentLoop.getLocale() === 'en'
          ? 'AI model not found. Please enter your OpenRouter API key in Settings.'
          : agentLoop.getLocale() === 'ja'
            ? 'AIモデルが見つかりません。設定でOpenRouter APIキーを入力してください。'
            : 'AI 모델을 찾을 수 없습니다. 설정에서 OpenRouter API 키를 입력해주세요.'
        win.webContents.send(IPC.AI_CHAT_STREAM, { type: 'error', content: errMsg })
        win.webContents.send(IPC.AI_CHAT_STREAM, { type: 'done', content: '' })
        return
      }
      provider = auto.provider
      modelId = auto.modelId
    }

    // Stream chunks to renderer
    await agentLoop.chat(provider, modelId, req.conversationId, req.message, (chunk) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.AI_CHAT_STREAM, chunk)
      }
    })
  })

  // ─── List Models ──────────────────────────────────
  ipcMain.handle(IPC.AI_MODELS, async () => {
    return modelRouter.listModels()
  })

  // ─── Stop Conversation ────────────────────────────
  ipcMain.handle(IPC.AI_STOP, (_, conversationId: unknown) => {
    if (typeof conversationId !== 'string' || conversationId.length > 128) return
    agentLoop.stop(conversationId)
  })
}

/** Update model router when settings change */
export function updateAiSettings(settings: AppSettings): void {
  modelRouter.updateSettings(settings)
  if (settings.locale) {
    agentLoop.setLocale(settings.locale as Locale)
  }
}
