import { useEffect } from 'react'
import { Command } from 'cmdk'
import {
  Search, Monitor, FileSearch, Globe, Settings, FileText, Wrench,
  Volume2, Bell, Home, FolderOpen, MessageSquarePlus, User, Workflow, BookOpen, Activity, Store,
} from 'lucide-react'
import FocusTrap from '../accessibility/FocusTrap'
import { useChatStore } from '../../stores/chat.store'
import { t } from '../../i18n'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (page: 'home' | 'tools' | 'notes' | 'files' | 'settings' | 'account' | 'workflows' | 'knowledge' | 'dashboard' | 'marketplace') => void
}

export default function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange])

  if (!open) return null

  const itemClass = "flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] aria-selected:bg-[var(--color-primary-light)] transition-colors"
  const itemStyle = { minHeight: 'var(--min-target)' }

  return (
    <FocusTrap active={open}>
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--color-backdrop)] backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Command dialog */}
      <div className="relative w-full max-w-lg bg-[var(--color-bg-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden border border-[var(--color-border)]">
        <Command className="flex flex-col" label={t('command.placeholder')}>
          <div className="flex items-center gap-3 px-4 border-b border-[var(--color-border)]">
            <Search size={20} className="text-[var(--color-text-muted)]" />
            <Command.Input
              placeholder={t('command.inputPlaceholder')}
              className="w-full h-14 bg-transparent outline-none text-[length:var(--text-md)]"
              aria-label={t('command.inputPlaceholder')}
            />
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] rounded border border-[var(--color-border)]">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-80 overflow-auto p-2">
            <Command.Empty
              className="p-6 text-center text-[length:var(--text-md)] text-[var(--color-text-muted)]"
            >
              {t('command.noResults')}
            </Command.Empty>

            {/* Quick actions */}
            <Command.Group heading={t('command.actions')} className="px-2 py-1">
              <Command.Item
                onSelect={() => {
                  onNavigate('home')
                  useChatStore.getState().newConversation()
                  onOpenChange(false)
                }}
                className={itemClass}
                style={itemStyle}
              >
                <MessageSquarePlus size={20} className="text-[var(--color-primary)]" />
                <div className="flex-1">
                  <span className="text-[length:var(--text-md)]">{t('chat.newConversation')}</span>
                </div>
                <kbd className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
                  Ctrl+N
                </kbd>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('home'); onOpenChange(false) }}
                className={itemClass}
                style={itemStyle}
              >
                <Monitor size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('command.screenAnalyze')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('files'); onOpenChange(false) }}
                className={itemClass}
                style={itemStyle}
              >
                <FileSearch size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('command.findFile')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('home'); onOpenChange(false) }}
                className={itemClass}
                style={itemStyle}
              >
                <Globe size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('command.search')}</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading={t('nav.tools')} className="px-2 py-1">
              <Command.Item
                onSelect={() => { onNavigate('tools'); onOpenChange(false) }}
                className={itemClass}
                style={itemStyle}
              >
                <Monitor size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('tools.screenCapture')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('tools'); onOpenChange(false) }}
                className={itemClass}
                style={itemStyle}
              >
                <Globe size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('tools.webSearch')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('tools'); onOpenChange(false) }}
                className={itemClass}
                style={itemStyle}
              >
                <Volume2 size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('tools.tts')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('tools'); onOpenChange(false) }}
                className={itemClass}
                style={itemStyle}
              >
                <Bell size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('tools.reminder')}</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading={t('command.navigate')} className="px-2 py-1">
              {[
                { page: 'home' as const, icon: Home, shortcut: '1' },
                { page: 'tools' as const, icon: Wrench, shortcut: '2' },
                { page: 'notes' as const, icon: FileText, shortcut: '3' },
                { page: 'files' as const, icon: FolderOpen, shortcut: '4' },
                { page: 'settings' as const, icon: Settings, shortcut: '5' },
                { page: 'account' as const, icon: User, shortcut: '6' },
                { page: 'workflows' as const, icon: Workflow, shortcut: '7' },
                { page: 'knowledge' as const, icon: BookOpen, shortcut: '8' },
                { page: 'dashboard' as const, icon: Activity, shortcut: '9' },
                { page: 'marketplace' as const, icon: Store, shortcut: '0' },
              ].map(({ page, icon: Icon, shortcut }) => (
                <Command.Item
                  key={page}
                  onSelect={() => { onNavigate(page); onOpenChange(false) }}
                  className={itemClass}
                  style={itemStyle}
                >
                  <Icon size={20} className="text-[var(--color-text-muted)]" />
                  <div className="flex-1">
                    <span className="text-[length:var(--text-md)]">{t(`nav.${page}`)}</span>
                  </div>
                  <kbd className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
                    Ctrl+{shortcut}
                  </kbd>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
    </FocusTrap>
  )
}
