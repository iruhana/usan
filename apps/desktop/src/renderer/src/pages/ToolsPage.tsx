import {
  Monitor,
  Search,
  Volume2,
  Bell,
  Settings2,
  MousePointer2,
  Globe,
  FolderOpen,
  Terminal,
  ShieldCheck,
  Trash2,
  Rocket,
  Sparkles,
} from 'lucide-react'
import { t } from '../i18n'
import { useSafetyStore } from '../stores/safety.store'
import { useChatStore } from '../stores/chat.store'
import { useSettingsStore } from '../stores/settings.store'
import { useState } from 'react'

interface ToolCardProps {
  icon: typeof Monitor
  titleKey: string
  descKey: string
  descKeySimple: string
  promptKey: string
  dataAction?: string
  dangerous?: boolean
  beginnerMode?: boolean
}

const SAFE_TOOLS: ToolCardProps[] = [
  {
    icon: Monitor,
    titleKey: 'tools.screenCapture',
    descKey: 'tools.screenCaptureDesc',
    descKeySimple: 'tools.screenCaptureDescSimple',
    promptKey: 'tools.screenCapturePrompt',
  },
  {
    icon: Search,
    titleKey: 'tools.webSearch',
    descKey: 'tools.webSearchDesc',
    descKeySimple: 'tools.webSearchDescSimple',
    promptKey: 'tools.webSearchPrompt',
  },
  {
    icon: Volume2,
    titleKey: 'tools.tts',
    descKey: 'tools.ttsDesc',
    descKeySimple: 'tools.ttsDescSimple',
    promptKey: 'tools.ttsPrompt',
  },
  {
    icon: Bell,
    titleKey: 'tools.reminder',
    descKey: 'tools.reminderDesc',
    descKeySimple: 'tools.reminderDescSimple',
    promptKey: 'tools.reminderPrompt',
  },
  {
    icon: Trash2,
    titleKey: 'tools.cleanTemp',
    descKey: 'tools.cleanTempDesc',
    descKeySimple: 'tools.cleanTempDescSimple',
    promptKey: 'tools.cleanTempPrompt',
  },
  {
    icon: Rocket,
    titleKey: 'tools.startupManager',
    descKey: 'tools.startupManagerDesc',
    descKeySimple: 'tools.startupManagerDescSimple',
    promptKey: 'tools.startupManagerPrompt',
  },
]

const DANGEROUS_TOOLS: ToolCardProps[] = [
  {
    icon: MousePointer2,
    titleKey: 'tools.mouseKeyboard',
    descKey: 'tools.mouseKeyboardDesc',
    descKeySimple: 'tools.mouseKeyboardDescSimple',
    promptKey: 'tools.mouseKeyboardPrompt',
    dataAction: 'open-safety-confirmation',
    dangerous: true,
  },
  {
    icon: Globe,
    titleKey: 'tools.browserAutomation',
    descKey: 'tools.browserAutomationDesc',
    descKeySimple: 'tools.browserAutomationDescSimple',
    promptKey: 'tools.browserAutomationPrompt',
    dangerous: true,
  },
  {
    icon: FolderOpen,
    titleKey: 'tools.fileManagement',
    descKey: 'tools.fileManagementDesc',
    descKeySimple: 'tools.fileManagementDescSimple',
    promptKey: 'tools.fileManagementPrompt',
    dangerous: true,
  },
  {
    icon: Terminal,
    titleKey: 'tools.terminal',
    descKey: 'tools.terminalDesc',
    descKeySimple: 'tools.terminalDescSimple',
    promptKey: 'tools.terminalPrompt',
    dangerous: true,
  },
  {
    icon: ShieldCheck,
    titleKey: 'tools.secureDelete',
    descKey: 'tools.secureDeleteDesc',
    descKeySimple: 'tools.secureDeleteDescSimple',
    promptKey: 'tools.secureDeletePrompt',
    dangerous: true,
  },
]

function ToolCard({
  icon: Icon,
  titleKey,
  descKey,
  descKeySimple,
  promptKey,
  dataAction,
  dangerous,
  beginnerMode = false,
}: ToolCardProps) {
  const requestConfirmation = useSafetyStore((s) => s.requestConfirmation)
  const newConversation = useChatStore((s) => s.newConversation)
  const sendMessage = useChatStore((s) => s.sendMessage)

  const handleRun = async () => {
    if (dangerous) {
      const confirmed = await requestConfirmation({
        title: t(titleKey),
        summary: [t(beginnerMode ? descKeySimple : descKey)],
        rollback: [],
        actionId: titleKey,
      })
      if (!confirmed) return
    }
    newConversation()
    await sendMessage(t(promptKey))
  }

  return (
    <div className="flex items-center rounded-[18px] px-4 py-4 transition-colors hover:bg-[var(--color-surface-soft)]/82">
      <div className="mr-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-soft)] text-[var(--color-text-secondary)]">
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1 pr-4">
        <h3 className="truncate text-[14px] font-semibold text-[var(--color-text)]">{t(titleKey)}</h3>
        <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-muted)]">
          {t(beginnerMode ? descKeySimple : descKey)}
        </p>
      </div>
      <button
        type="button"
        data-action={dataAction}
        onClick={handleRun}
        className="shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-light)]"
      >
        {t('tools.run')}
      </button>
    </div>
  )
}

export default function ToolsPage() {
  const beginnerMode = useSettingsStore((s) => s.settings.beginnerMode)
  const [search, setSearch] = useState('')

  const filterTools = (tools: ToolCardProps[]) => {
    if (!search.trim()) return tools
    const q = search.toLowerCase()
    return tools.filter(
      (tool) =>
        t(tool.titleKey).toLowerCase().includes(q) ||
        t(beginnerMode ? tool.descKeySimple : tool.descKey).toLowerCase().includes(q),
    )
  }

  const filteredSafe = filterTools(SAFE_TOOLS)
  const filteredDangerous = filterTools(DANGEROUS_TOOLS)
  const allTools = [...filteredSafe, ...filteredDangerous]

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-bg)]">
      <header className="flex items-center justify-between px-8 pb-2 pt-6">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-bold text-[var(--color-text)]">{t('tools.title')}</h1>
          <Sparkles size={16} className="text-[var(--color-primary)]" />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex w-64 items-center gap-3 rounded-full bg-[var(--color-surface-soft)] px-4 py-2.5">
            <Search size={16} className="text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('tools.searchPlaceholder')}
              className="w-full bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
            />
          </label>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-soft)]"
            aria-label={t('tools.reminder')}
          >
            <Bell size={18} />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-soft)]"
            aria-label={t('settings.title')}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[960px] space-y-6 px-6 pb-6 pt-4">
        {allTools.length === 0 ? (
          <div className="rounded-[24px] border border-[var(--color-panel-border)] bg-[var(--color-panel-bg-strong)] px-5 py-6 text-[length:var(--text-sm)] text-[var(--color-text-muted)] shadow-[var(--shadow-xs)]">
            {t('tools.noMatches')}
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <div className="space-y-1 px-1">
                <p className="text-[13px] font-semibold text-[var(--color-text)]">
                  {t(beginnerMode ? 'tools.safeToolsSimple' : 'tools.safeTools')}
                </p>
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  {t('tools.commonTools')}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {filteredSafe.map((tool) => (
                  <ToolCard key={tool.titleKey} {...tool} beginnerMode={beginnerMode} />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="space-y-1 px-1">
                <p className="text-[13px] font-semibold text-[var(--color-text)]">
                  {t(beginnerMode ? 'tools.dangerZoneSimple' : 'tools.dangerZone')}
                </p>
                <p className="text-[12px] text-[var(--color-text-muted)]">
                  {t(beginnerMode ? 'tools.needsConfirmationSimple' : 'tools.needsConfirmation')}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {filteredDangerous.map((tool) => (
                  <ToolCard key={tool.titleKey} {...tool} beginnerMode={beginnerMode} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

