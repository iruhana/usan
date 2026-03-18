/**
 * AI IPC handlers - bridges AgentLoop to renderer via IPC
 */

import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/constants/channels'
import type { AppSettings, ChatRequest, Locale } from '@shared/types/ipc'
import { AgentLoop } from '../ai/agent-loop'
import { modelRouter } from '../ai/model-router'

const agentLoop = new AgentLoop()

function getLocalModeReply(locale: Locale, userMessage: string): string {
  const quoted = userMessage.trim().slice(0, 300)

  if (locale === 'en') {
    return [
      'You are currently using Usan basic mode (no cloud API key connected).',
      '',
      'I can still help you with beginner-friendly guidance and built-in actions:',
      '- "Capture my screen and find the error"',
      '- "Find recent files"',
      '- "Search the web for today\'s weather"',
      '',
      'If you connect an optional OpenRouter API key in Settings, advanced AI reasoning will be enabled.',
      quoted ? `You asked: "${quoted}"` : '',
      'You can continue right now with the Home quick actions or the Tools page.',
    ].filter(Boolean).join('\n')
  }

  if (locale === 'ja') {
    return [
      '\u73fe\u5728\u3001\u30af\u30e9\u30a6\u30c9API\u30ad\u30fc\u304c\u63a5\u7d9a\u3055\u308c\u3066\u3044\u306a\u3044\u57fa\u672c\u30e2\u30fc\u30c9\u3067\u3059\u3002',
      '',
      '\u305d\u308c\u3067\u3082\u3001\u4ee5\u4e0b\u306e\u3088\u3046\u306a\u64cd\u4f5c\u3092\u30b5\u30dd\u30fc\u30c8\u3067\u304d\u307e\u3059\uff1a',
      '- \u300c\u753b\u9762\u3092\u30ad\u30e3\u30d7\u30c1\u30e3\u3057\u3066\u30a8\u30e9\u30fc\u3092\u63a2\u3057\u3066\u300d',
      '- \u300c\u6700\u8fd1\u306e\u30d5\u30a1\u30a4\u30eb\u3092\u63a2\u3057\u3066\u300d',
      '- \u300c\u4eca\u65e5\u306e\u5929\u6c17\u3092\u691c\u7d22\u3057\u3066\u300d',
      '',
      '\u8a2d\u5b9a\u304b\u3089OpenRouter API\u30ad\u30fc\u3092\u63a5\u7d9a\u3059\u308b\u3068\u3001\u9ad8\u5ea6\u306aAI\u6a5f\u80fd\u304c\u6709\u52b9\u306b\u306a\u308a\u307e\u3059\u3002',
      quoted ? `\u3054\u8cea\u554f: \u300c${quoted}\u300d` : '',
      '\u30db\u30fc\u30e0\u306e\u30af\u30a4\u30c3\u30af\u30a2\u30af\u30b7\u30e7\u30f3\u307e\u305f\u306f\u30c4\u30fc\u30eb\u30da\u30fc\u30b8\u304b\u3089\u59cb\u3081\u3089\u308c\u307e\u3059\u3002',
    ].filter(Boolean).join('\n')
  }

  return [
    '\uc9c0\uae08\uc740 \ud074\ub77c\uc6b0\ub4dc API \ud0a4\uac00 \uc5f0\uacb0\ub418\uc9c0 \uc54a\uc740 \uae30\ubcf8 \ubaa8\ub4dc \uc0c1\ud0dc\uc785\ub2c8\ub2e4.',
    '',
    '\uadf8\ub798\ub3c4 \uc544\ub798 \uc791\uc5c5\uc740 \ubc14\ub85c \uc2dc\uc791\ud558\uc2e4 \uc218 \uc788\uc5b4\uc694.',
    '- "\ud654\uba74 \ucea1\ucc98\ud574\uc11c \uc624\ub958 \uc54c\ub824\uc918"',
    '- "\ucd5c\uadfc \ud30c\uc77c \ucc3e\uc544\uc918"',
    '- "\uc624\ub298 \ub0a0\uc528 \uac80\uc0c9\ud574\uc918"',
    '',
    '\uc124\uc815\uc5d0\uc11c \uc120\ud0dd\uc801\uc73c\ub85c OpenRouter API \ud0a4\ub97c \uc5f0\uacb0\ud558\uba74 \uace0\uae09 AI \uae30\ub2a5\uc774 \ud65c\uc131\ud654\ub429\ub2c8\ub2e4.',
    quoted ? `\uc694\uccad \ub0b4\uc6a9: "${quoted}"` : '',
    '\uc9c0\uae08\uc740 \ud648\uc758 \ube60\ub978 \uc791\uc5c5 \ub610\ub294 \ub3c4\uad6c \ud398\uc774\uc9c0\uc5d0\uc11c \uc2dc\uc791\ud574 \uc8fc\uc138\uc694.',
  ].filter(Boolean).join('\n')
}

export function registerAiIpcHandlers(): void {
  ipcMain.handle(IPC.AI_CHAT, async (event, req: ChatRequest) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    if (typeof req.conversationId !== 'string' || req.conversationId.length > 128) return
    if (typeof req.message !== 'string' || req.message.length > 100000) return

    const route = await modelRouter.resolveRoute({
      requestedModelId: req.modelId,
      userMessage: req.message,
    })

    if (!route) {
      const localReply = getLocalModeReply(agentLoop.getLocale(), req.message)
      try {
        win.webContents.send(IPC.AI_CHAT_STREAM, { type: 'text', content: localReply })
        win.webContents.send(IPC.AI_CHAT_STREAM, { type: 'done', content: '' })
      } catch {
        // window may have been destroyed
      }
      return
    }

    await agentLoop.chat(
      route.provider,
      route.modelId,
      req.conversationId,
      req.message,
      (chunk) => {
        try {
          if (!win.isDestroyed()) {
            win.webContents.send(IPC.AI_CHAT_STREAM, chunk)
          }
        } catch {
          // Window destroyed between isDestroyed() check and send()
        }
      },
      { fallbackModelIds: route.fallbackModelIds },
    )
  })

  ipcMain.handle(IPC.AI_MODELS, async () => {
    return modelRouter.listModels()
  })

  ipcMain.handle(IPC.AI_STOP, (_, conversationId: unknown) => {
    if (typeof conversationId !== 'string' || conversationId.length > 128) return
    agentLoop.stop(conversationId)
  })
}

export function updateAiSettings(settings: AppSettings): void {
  modelRouter.updateSettings(settings)
  if (settings.locale) {
    agentLoop.setLocale(settings.locale as Locale)
  }
}
