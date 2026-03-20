import { AI_MODELS, DEFAULT_APP_SETTINGS } from '@shared/types'
import { useChatStore } from '../stores/chat.store'
import { useSettingsStore } from '../stores/settings.store'
import { useShellStore } from '../stores/shell.store'
import { useUiStore } from '../stores/ui.store'

export function resetStores(): void {
  useUiStore.setState({
    view: 'chat',
    navExpanded: true,
    activeSessionId: null,
    contextPanelOpen: false,
    utilityPanelOpen: false,
    utilityTab: 'steps',
    commandPaletteOpen: false,
  })

  useShellStore.setState({
    activeSessionId: null,
    sessions: [],
    runSteps: [],
    artifacts: [],
    approvals: [],
    logs: [],
    templates: [],
    messages: [],
    references: [],
    previews: [],
    hydrated: false,
  })

  useSettingsStore.setState({
    settings: DEFAULT_APP_SETTINGS,
    hydrated: false,
  })

  useChatStore.setState({
    models: AI_MODELS,
    selectedModel: DEFAULT_APP_SETTINGS.defaultModel,
    messages: [],
    streaming: false,
    streamingContent: '',
    streamingId: null,
    streamingSessionId: null,
    error: null,
  })

  document.documentElement.removeAttribute('data-theme')
}
