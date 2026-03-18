import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { en } from '../../src/renderer/src/i18n/locales/en'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')
const TRANSLATION_KEY_RE = /\bt\(\s*['"`]([^'"`]+)['"`]/g

export const VISIBLE_UI_FILES = [
  'src/renderer/src/components/layout/TitleBar.tsx',
  'src/renderer/src/components/shell/Sidebar.tsx',
  'src/renderer/src/components/layout/StatusBar.tsx',
  'src/renderer/src/components/composer/Composer.tsx',
  'src/renderer/src/components/composer/ModeChips.tsx',
  'src/renderer/src/components/composer/AttachMenu.tsx',
  'src/renderer/src/components/agent/Timeline.tsx',
  'src/renderer/src/components/agent/StepItem.tsx',
  'src/renderer/src/components/agent/ApprovalCard.tsx',
  'src/renderer/src/components/settings/AccountSettingsPanel.tsx',
  'src/renderer/src/components/settings/GeneralSettingsSection.tsx',
  'src/renderer/src/components/settings/ConnectorsSettingsSection.tsx',
  'src/renderer/src/components/settings/SecuritySettingsSection.tsx',
  'src/renderer/src/components/settings/ModelsSettingsSection.tsx',
  'src/renderer/src/components/settings/AboutSettingsSection.tsx',
  'src/renderer/src/components/artifact/ArtifactShelf.tsx',
  'src/renderer/src/components/artifact/ArtifactView.tsx',
  'src/renderer/src/components/artifact/artifact-state.ts',
  'src/renderer/src/components/files/ActionBar.tsx',
  'src/renderer/src/components/files/FileExplorer.tsx',
  'src/renderer/src/components/files/ListView.tsx',
  'src/renderer/src/components/files/file-metadata.ts',
  'src/renderer/src/components/ambient/MiniLauncher.tsx',
  'src/renderer/src/components/ambient/FloatingToolbar.tsx',
  'src/renderer/src/components/proactive/SuggestionTray.tsx',
  'src/renderer/src/components/proactive/SuggestionCard.tsx',
  'src/renderer/src/components/chat/ConversationList.tsx',
  'src/renderer/src/pages/HomePage.tsx',
  'src/renderer/src/pages/TasksPage.tsx',
  'src/renderer/src/pages/SettingsPage.tsx',
  'src/renderer/src/pages/ToolsPage.tsx',
  'src/renderer/src/pages/FilesPage.tsx',
  'src/renderer/src/pages/MarketplacePage.tsx',
  'src/renderer/src/components/ErrorBoundary.tsx',
  'src/renderer/src/components/voice/VoiceOverlay.tsx',
  'src/renderer/src/components/voice/VoiceIndicator.tsx',
  'src/renderer/src/components/marketplace/MarketplaceWorkspace.tsx',
  'src/renderer/src/components/marketplace/PluginCard.tsx',
  'src/renderer/src/components/marketplace/PluginDetail.tsx',
  'src/renderer/src/components/vision/VisionPanel.tsx',
  'src/renderer/src/components/vision/AccessibilityTree.tsx',
  'src/renderer/src/components/collaboration/CollaborationPanel.tsx',
] as const

export const SUPPORT_PANEL_FILES = [
  'src/renderer/src/components/mcp/McpServerList.tsx',
  'src/renderer/src/components/mcp/McpToolPanel.tsx',
  'src/renderer/src/components/layout/CommandPalette.tsx',
  'src/renderer/src/components/onboarding/OnboardingWizard.tsx',
  'src/renderer/src/components/modal/SafetyConfirmationModal.tsx',
] as const

function collectTranslationKeysFromFiles(relativePaths: readonly string[]): string[] {
  const keys = new Set<string>()

  for (const relativePath of relativePaths) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8')

    for (const match of source.matchAll(TRANSLATION_KEY_RE)) {
      const key = match[1]
      if (!key.includes('/') && key in en) {
        keys.add(key)
      }
    }
  }

  return [...keys].sort()
}

export function collectVisibleTranslationKeys(): string[] {
  return collectTranslationKeysFromFiles(VISIBLE_UI_FILES)
}

export function collectSupportPanelTranslationKeys(): string[] {
  return collectTranslationKeysFromFiles(SUPPORT_PANEL_FILES)
}
