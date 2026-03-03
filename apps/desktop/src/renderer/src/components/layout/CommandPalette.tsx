import { useEffect } from 'react'
import { Command } from 'cmdk'
import { Search, Monitor, FileSearch, Globe, Settings, FileText, Wrench, Volume2, Bell, Home, FolderOpen } from 'lucide-react'
import FocusTrap from '../accessibility/FocusTrap'
import { t } from '../../i18n'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (page: 'home' | 'tools' | 'notes' | 'files' | 'settings') => void
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
          </div>
          <Command.List className="max-h-80 overflow-auto p-2">
            <Command.Empty
              className="p-6 text-center text-[length:var(--text-md)] text-[var(--color-text-muted)]"
            >
              {t('command.noResults')}
            </Command.Empty>

            <Command.Group heading={t('command.actions')} className="px-2 py-1">
              <Command.Item
                onSelect={() => { onNavigate('home'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <Monitor size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('command.screenAnalyze')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('files'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <FileSearch size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('command.findFile')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('home'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <Globe size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('command.search')}</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading={t('nav.tools')} className="px-2 py-1">
              <Command.Item
                onSelect={() => { onNavigate('tools'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <Monitor size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('tools.screenCapture')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('tools'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <Globe size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('tools.webSearch')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('tools'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <Volume2 size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('tools.tts')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('tools'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <Bell size={20} className="text-[var(--color-primary)]" />
                <span className="text-[length:var(--text-md)]">{t('tools.reminder')}</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading={t('command.navigate')} className="px-2 py-1">
              <Command.Item
                onSelect={() => { onNavigate('home'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <Home size={20} className="text-[var(--color-text-muted)]" />
                <span className="text-[length:var(--text-md)]">{t('nav.home')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('tools'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <Wrench size={20} className="text-[var(--color-text-muted)]" />
                <span className="text-[length:var(--text-md)]">{t('nav.tools')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('notes'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <FileText size={20} className="text-[var(--color-text-muted)]" />
                <span className="text-[length:var(--text-md)]">{t('nav.notes')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('files'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <FolderOpen size={20} className="text-[var(--color-text-muted)]" />
                <span className="text-[length:var(--text-md)]">{t('nav.files')}</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { onNavigate('settings'); onOpenChange(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] cursor-pointer hover:bg-[var(--color-primary-light)] transition-colors"
                style={{ minHeight: 'var(--min-target)' }}
              >
                <Settings size={20} className="text-[var(--color-text-muted)]" />
                <span className="text-[length:var(--text-md)]">{t('nav.settings')}</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
    </FocusTrap>
  )
}
