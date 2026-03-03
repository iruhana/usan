import {
  Monitor,
  Search,
  Volume2,
  Bell,
  MousePointer2,
  Globe,
  FolderOpen,
  Terminal,
  ShieldCheck,
  Trash2,
  Rocket,
} from 'lucide-react'
import { t } from '../i18n'
import { useSafetyStore } from '../stores/safety.store'
import { useChatStore } from '../stores/chat.store'
import { SectionHeader } from '../components/ui'

interface ToolCardProps {
  icon: typeof Monitor
  titleKey: string
  descKey: string
  promptKey: string
  dangerous?: boolean
}

const SAFE_TOOLS: ToolCardProps[] = [
  { icon: Monitor, titleKey: 'tools.screenCapture', descKey: 'tools.screenCaptureDesc', promptKey: 'tools.screenCapturePrompt' },
  { icon: Search, titleKey: 'tools.webSearch', descKey: 'tools.webSearchDesc', promptKey: 'tools.webSearchPrompt' },
  { icon: Volume2, titleKey: 'tools.tts', descKey: 'tools.ttsDesc', promptKey: 'tools.ttsPrompt' },
  { icon: Bell, titleKey: 'tools.reminder', descKey: 'tools.reminderDesc', promptKey: 'tools.reminderPrompt' },
  { icon: Trash2, titleKey: 'tools.cleanTemp', descKey: 'tools.cleanTempDesc', promptKey: 'tools.cleanTempPrompt' },
  { icon: Rocket, titleKey: 'tools.startupManager', descKey: 'tools.startupManagerDesc', promptKey: 'tools.startupManagerPrompt' },
]

const DANGEROUS_TOOLS: ToolCardProps[] = [
  { icon: MousePointer2, titleKey: 'tools.mouseKeyboard', descKey: 'tools.mouseKeyboardDesc', promptKey: 'tools.mouseKeyboardPrompt', dangerous: true },
  { icon: Globe, titleKey: 'tools.browserAutomation', descKey: 'tools.browserAutomationDesc', promptKey: 'tools.browserAutomationPrompt', dangerous: true },
  { icon: FolderOpen, titleKey: 'tools.fileManagement', descKey: 'tools.fileManagementDesc', promptKey: 'tools.fileManagementPrompt', dangerous: true },
  { icon: Terminal, titleKey: 'tools.terminal', descKey: 'tools.terminalDesc', promptKey: 'tools.terminalPrompt', dangerous: true },
  { icon: ShieldCheck, titleKey: 'tools.secureDelete', descKey: 'tools.secureDeleteDesc', promptKey: 'tools.secureDeletePrompt', dangerous: true },
]

function ToolCard({ icon: Icon, titleKey, descKey, promptKey, dangerous }: ToolCardProps) {
  const requestConfirmation = useSafetyStore((s) => s.requestConfirmation)
  const sendMessage = useChatStore((s) => s.sendMessage)

  const handleRun = async () => {
    if (dangerous) {
      const confirmed = await requestConfirmation({
        title: t(titleKey),
        summary: [t(descKey)],
        rollback: [],
        actionId: titleKey,
      })
      if (!confirmed) return
    }
    sendMessage(t(promptKey))
  }

  return (
    <button
      onClick={handleRun}
      className={`group flex items-center gap-4 p-4 rounded-[var(--radius-lg)] border transition-all hover:-translate-y-px text-left w-full ${
        dangerous
          ? 'border-[var(--color-danger)]/20 hover:border-[var(--color-danger)]/40 hover:bg-[var(--color-danger-bg)]/30'
          : 'border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-primary)]/30 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]'
      }`}
    >
      <div className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 transition-all group-hover:scale-110 ${
        dangerous
          ? 'bg-[var(--color-danger-bg)]'
          : 'bg-[var(--color-primary-light)] group-hover:bg-[var(--color-primary)] group-hover:shadow-[var(--shadow-md)]'
      }`}>
        <Icon size={18} className={`transition-colors ${
          dangerous
            ? 'text-[var(--color-danger)]'
            : 'text-[var(--color-primary)] group-hover:text-[var(--color-text-inverse)]'
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[length:var(--text-md)] font-medium text-[var(--color-text)]">
          {t(titleKey)}
        </h3>
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] truncate">
          {t(descKey)}
        </p>
      </div>
      <span className={`shrink-0 px-3 py-2 rounded-[var(--radius-md)] text-[length:var(--text-sm)] font-medium transition-all ${
        dangerous
          ? 'text-[var(--color-danger)] group-hover:bg-[var(--color-danger-bg)]'
          : 'text-[var(--color-primary)] group-hover:bg-[var(--color-primary-light)]'
      }`}>
        {t('tools.run')}
      </span>
    </button>
  )
}

export default function ToolsPage() {
  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-[var(--color-border)]">
        <h1 className="font-semibold tracking-tight text-[length:var(--text-xl)] text-[var(--color-text)]">
          {t('tools.title')}
        </h1>
        <p className="text-[length:var(--text-md)] text-[var(--color-text-muted)] mt-1">
          {t('tools.subtitle')}
        </p>
      </div>

      {/* Safe tools */}
      <div className="mb-8 max-w-2xl">
        <SectionHeader title={t('tools.safeTools')} indicator="var(--color-success)" />
        <div className="flex flex-col gap-2">
          {SAFE_TOOLS.map((tool) => (
            <ToolCard key={tool.titleKey} {...tool} />
          ))}
        </div>
      </div>

      {/* Dangerous tools */}
      <div className="max-w-2xl">
        <SectionHeader title={t('tools.dangerZone')} indicator="var(--color-danger)" />
        <div className="px-4 py-2 mb-4 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)]/30 border border-[var(--color-danger)]/15">
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {t('tools.needsConfirmation')}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {DANGEROUS_TOOLS.map((tool) => (
            <ToolCard key={tool.titleKey} {...tool} />
          ))}
        </div>
      </div>
    </div>
  )
}
