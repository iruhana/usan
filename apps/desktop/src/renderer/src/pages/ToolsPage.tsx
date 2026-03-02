import {
  Monitor,
  Search,
  Volume2,
  Bell,
  MousePointer2,
  Globe,
  FolderOpen,
  Terminal,
  Wrench,
  AlertTriangle,
  ShieldCheck,
  Trash2,
  Rocket,
} from 'lucide-react'
import { t } from '../i18n'
import { useSafetyStore } from '../stores/safety.store'
import { useChatStore } from '../stores/chat.store'

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
    <div className={`flex flex-col p-5 rounded-2xl border transition-all ${
      dangerous
        ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
        : 'border-[var(--color-border)] bg-[var(--color-bg-card)]'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          dangerous
            ? 'bg-red-100 dark:bg-red-900/30'
            : 'bg-[var(--color-surface-soft)]'
        }`}>
          <Icon size={24} className={dangerous ? 'text-red-600 dark:text-red-400' : 'text-[var(--color-primary)]'} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--color-text)]" style={{ fontSize: 'var(--font-size-sm)' }}>
            {t(titleKey)}
          </h3>
          <p className="text-[var(--color-text-muted)]" style={{ fontSize: 'calc(13px * var(--font-scale))' }}>
            {t(descKey)}
          </p>
        </div>
      </div>
      <button
        onClick={handleRun}
        className={`w-full rounded-xl font-semibold transition-all ${
          dangerous
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
        }`}
        style={{ fontSize: 'var(--font-size-sm)', minHeight: 'var(--min-target)' }}
      >
        {t('tools.run')}
      </button>
    </div>
  )
}

export default function ToolsPage() {
  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Wrench size={28} className="text-[var(--color-primary)]" />
        <h1 className="font-bold" style={{ fontSize: 'var(--font-size-xl)' }}>
          {t('tools.title')}
        </h1>
      </div>
      <p className="text-[var(--color-text-muted)] mb-6" style={{ fontSize: 'var(--font-size-sm)' }}>
        {t('tools.subtitle')}
      </p>

      {/* Safe tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {SAFE_TOOLS.map((tool) => (
          <ToolCard key={tool.titleKey} {...tool} />
        ))}
      </div>

      {/* Dangerous tools */}
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={20} className="text-[var(--color-warning)]" />
        <h2 className="font-semibold text-[var(--color-text)]" style={{ fontSize: 'var(--font-size-base)' }}>
          {t('tools.dangerZone')}
        </h2>
      </div>
      <p className="text-[var(--color-text-muted)] mb-4" style={{ fontSize: 'calc(13px * var(--font-scale))' }}>
        {t('tools.needsConfirmation')}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DANGEROUS_TOOLS.map((tool) => (
          <ToolCard key={tool.titleKey} {...tool} />
        ))}
      </div>
    </div>
  )
}
