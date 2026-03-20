/**
 * Z1 — Title Bar
 * Window drag region, session identity, launcher entry, window controls.
 */
import { useEffect, useState } from 'react'
import {
  Minus, Copy, X, Maximize2, Search, PanelLeft,
  Settings, History, ChevronLeft,
} from 'lucide-react'
import { useUiStore } from '../../stores/ui.store'
import { useShellStore } from '../../stores/shell.store'

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const {
    activeSessionId, navExpanded, toggleNav,
    setCommandPaletteOpen, setView, view,
  } = useUiStore()
  const sessions = useShellStore((state) => state.sessions)

  const activeSession = sessions.find((session) => session.id === activeSessionId)

  useEffect(() => {
    window.usan?.window?.isMaximized?.().then(setMaximized).catch(() => {})
  }, [])

  const handleMaximize = async () => {
    await window.usan?.window?.maximize?.()
    const m = await window.usan?.window?.isMaximized?.()
    if (m !== undefined) setMaximized(m)
  }

  return (
    <div
      className="drag-region"
      style={{
        height: 'var(--titlebar-height)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Left: nav toggle + breadcrumb */}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 2, paddingLeft: 8 }}>
        <TitleBarButton
          icon={navExpanded ? PanelLeft : PanelLeft}
          label={navExpanded ? '사이드바 닫기' : '사이드바 열기'}
          onClick={toggleNav}
        />
        {view === 'settings' && (
          <TitleBarButton
            icon={ChevronLeft}
            label="돌아가기"
            onClick={() => setView('chat')}
          />
        )}
      </div>

      {/* Center: session label */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          minWidth: 0,
        }}
      >
        <span
          className="truncate"
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-muted)',
            fontWeight: 500,
            maxWidth: 360,
            padding: '0 var(--sp-4)',
          }}
        >
          {view === 'settings' ? '설정' : activeSession?.title ?? 'Usan'}
        </span>
      </div>

      {/* Right: actions + window controls */}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 0 }}>
        <TitleBarButton
          icon={Search}
          label="명령 팔레트 (Ctrl+K)"
          onClick={() => setCommandPaletteOpen(true)}
        />
        <TitleBarButton
          icon={History}
          label="히스토리"
          onClick={() => {}}
        />
        <TitleBarButton
          icon={Settings}
          label="설정"
          onClick={() => setView(view === 'settings' ? 'chat' : 'settings')}
        />

        {/* Separator */}
        <div style={{ width: 1, height: 16, background: 'var(--border-default)', margin: '0 4px' }} />

        {/* Window controls */}
        <WindowButton icon={Minus} label="Minimize" onClick={() => window.usan?.window?.minimize?.()} />
        <WindowButton
          icon={maximized ? Copy : Maximize2}
          label="Maximize"
          onClick={handleMaximize}
        />
        <WindowButton
          icon={X}
          label="Close"
          onClick={() => window.usan?.window?.close?.()}
          danger
        />
      </div>
    </div>
  )
}

function TitleBarButton({ icon: Icon, label, onClick }: {
  icon: typeof Search; label: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="focus-ring"
      style={{
        width: 32,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        transition: `background var(--dur-micro), color var(--dur-micro)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-hover)'
        e.currentTarget.style.color = 'var(--text-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-muted)'
      }}
    >
      <Icon size={14} strokeWidth={1.5} />
    </button>
  )
}

function WindowButton({ icon: Icon, label, onClick, danger }: {
  icon: typeof Minus; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 46,
        height: 'var(--titlebar-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        transition: `background var(--dur-micro), color var(--dur-micro)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'var(--danger)' : 'var(--bg-hover)'
        e.currentTarget.style.color = danger ? 'var(--text-inverse)' : 'var(--text-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-muted)'
      }}
    >
      <Icon size={label === 'Close' ? 15 : 13} strokeWidth={1.5} />
    </button>
  )
}
