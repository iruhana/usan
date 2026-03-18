import type { ClipboardTransformFormat, SuggestionAction } from '@shared/types/infrastructure'
import type { SettingsTab } from '../constants/settings'
import { useChatStore } from '../stores/chat.store'
import { useNotificationStore } from '../stores/notification.store'
import { t } from '../i18n'
import { dispatchNavigate } from './navigation-events'

function formatFreedSpace(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${bytes} B`
}

function pushInfoToast(title: string, body: string): void {
  useNotificationStore.getState().push({
    title,
    body,
    level: 'info',
  })
}

function pushErrorToast(title: string, body: string): void {
  useNotificationStore.getState().push({
    title,
    body,
    level: 'error',
  })
}

export async function runProactiveSuggestionAction(action: SuggestionAction): Promise<void> {
  switch (action.action) {
    case 'navigate': {
      const page = typeof action.params?.['page'] === 'string' ? action.params['page'] : 'home'
      const settingsTab = typeof action.params?.['settingsTab'] === 'string'
        ? action.params['settingsTab'] as SettingsTab
        : undefined
      dispatchNavigate({
        page: page as 'home' | 'tasks' | 'files' | 'tools' | 'settings',
        settingsTab,
      })
      return
    }
    case 'show_processes': {
      dispatchNavigate({ page: 'tools' })
      return
    }
    case 'send_prompt': {
      const prompt = typeof action.params?.['prompt'] === 'string' ? action.params['prompt'].trim() : ''
      if (!prompt) {
        throw new Error('Proactive prompt action is missing prompt text.')
      }

      dispatchNavigate({ page: 'home' })
      const chatStore = useChatStore.getState()
      chatStore.newConversation()
      await chatStore.sendMessage(prompt)
      return
    }
    case 'clean_temp': {
      const result = await window.usan?.system.cleanTemp()
      if (!result) {
        throw new Error('Temporary files could not be cleaned.')
      }

      pushInfoToast(
        t('proactive.actionComplete'),
        t('proactive.cleanedTemp')
          .replace('{count}', String(result.deletedCount))
          .replace('{space}', formatFreedSpace(result.freedBytes)),
      )
      return
    }
    case 'clipboard_transform': {
      const format = action.params?.['format']
      const history = await window.usan?.clipboardManager.history()
      const latestEntry = history?.[0]
      if (!latestEntry) {
        throw new Error('Clipboard history is empty.')
      }

      const transformed = await window.usan?.clipboardManager.transform(
        latestEntry.id,
        format as ClipboardTransformFormat,
      )
      if (!transformed) {
        throw new Error('Clipboard text could not be transformed.')
      }

      await navigator.clipboard.writeText(transformed)
      pushInfoToast(t('proactive.actionComplete'), t('proactive.clipboardReady'))
      return
    }
    default:
      throw new Error(`Unknown proactive action: ${action.action}`)
  }
}

export function notifyProactiveActionError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  pushErrorToast(t('proactive.actionFailed'), message)
}
