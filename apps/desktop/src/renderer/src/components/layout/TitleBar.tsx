import type { ReactNode } from 'react'
import { Minus, Moon, Square, Sun, Umbrella, X } from 'lucide-react'
import { t } from '../../i18n'
import { useSettingsStore } from '../../stores/settings.store'
import type { AppPage } from '../../constants/navigation'

interface TitleBarProps {
  activePage?: AppPage
}

function CaptionButton({
  label,
  onClick,
  close = false,
  children,
}: {
  label: string
  onClick: () => void
  close?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`no-drag flex h-8 w-8 min-h-0 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors ${
        close
          ? 'hover:bg-[#E81123] hover:text-white'
          : 'hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]'
      }`}
    >
      {children}
    </button>
  )
}

export default function TitleBar({ activePage: _activePage = 'home' }: TitleBarProps) {
  const theme = useSettingsStore((s) => s.settings.theme)
  const update = useSettingsStore((s) => s.update)

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const toggleTheme = () => {
    update({ theme: isDark ? 'light' : 'dark' })
  }

  const handleMaximize = () => {
    window.usan?.window.maximize()
  }

  return (
    <div
      className="drag-region chrome-no-select flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] bg-white px-4 dark:bg-[var(--color-bg-sidebar)]"
      onDoubleClick={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('.no-drag')) return
        handleMaximize()
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-sky-500 to-[var(--color-primary)] shadow-[var(--shadow-xs)]">
          <Umbrella size={15} className="text-white" strokeWidth={2.1} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-bold leading-none text-[var(--color-text)]">
            {t('titlebar.title')}
          </div>
          <div className="truncate pt-1 text-[11px] leading-none text-[var(--color-text-muted)]">
            {t('titlebar.subtitle')}
          </div>
        </div>
      </div>

      <div className="no-drag flex items-center gap-1">
        <CaptionButton
          label={isDark ? t('settings.themeLight') : t('settings.themeDark')}
          onClick={toggleTheme}
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </CaptionButton>
        <div className="mx-2 h-4 w-px bg-[var(--color-border)]" />
        <CaptionButton label={t('titlebar.minimize')} onClick={() => window.usan?.window.minimize()}>
          <Minus size={16} strokeWidth={2.2} />
        </CaptionButton>
        <CaptionButton label={t('titlebar.maximize')} onClick={handleMaximize}>
          <Square size={13} strokeWidth={2} />
        </CaptionButton>
        <CaptionButton label={t('titlebar.close')} onClick={() => window.usan?.window.close()} close>
          <X size={16} strokeWidth={2.1} />
        </CaptionButton>
      </div>
    </div>
  )
}
