/**
 * Z8 — Command Palette
 * Global launcher / search overlay. Ctrl+K to open.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Search, Plus, Settings, History,
  Zap, FileText, TerminalSquare, PanelRight, PanelBottom,
  Command, Sparkles,
} from 'lucide-react'
import { useSettingsStore } from '../../stores/settings.store'
import { useShellStore } from '../../stores/shell.store'
import { useUiStore } from '../../stores/ui.store'

interface CommandItem {
  id: string
  icon: typeof Search
  label: string
  shortcut?: string
  section: string
  action: () => void
}

export default function CommandPalette() {
  const {
    commandPaletteOpen, setCommandPaletteOpen,
    setView, toggleContextPanel, toggleUtilityPanel,
    setUtilityTab, toggleSessionHistory,
  } = useUiStore()
  const defaultModel = useSettingsStore((state) => state.settings.defaultModel)
  const createSession = useShellStore((state) => state.createSession)

  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    setCommandPaletteOpen(false)
    setQuery('')
  }, [setCommandPaletteOpen])

  const handleNewSession = useCallback(() => {
    setView('chat')
    void createSession({ model: defaultModel })
    close()
  }, [close, createSession, defaultModel, setView])

  const commands: CommandItem[] = [
    { id: 'new-session', icon: Plus, label: '새 세션', shortcut: 'Ctrl+N', section: '세션', action: handleNewSession },
    { id: 'search-sessions', icon: Search, label: '세션 검색', section: '세션', action: () => {} },
    { id: 'builder', icon: Sparkles, label: '빌더 시작', section: '빌더', action: () => {} },
    { id: 'toggle-context', icon: PanelRight, label: '컨텍스트 패널 토글', shortcut: 'Ctrl+.', section: '패널', action: () => { toggleContextPanel(); close() } },
    { id: 'toggle-utility', icon: PanelBottom, label: '유틸리티 패널 토글', shortcut: 'Ctrl+`', section: '패널', action: () => { toggleUtilityPanel(); close() } },
    { id: 'show-logs', icon: TerminalSquare, label: '로그 보기', section: '패널', action: () => { setUtilityTab('logs'); close() } },
    { id: 'show-approvals', icon: Zap, label: '승인 보기', section: '패널', action: () => { setUtilityTab('approvals'); close() } },
    { id: 'show-steps', icon: FileText, label: '실행 단계 보기', section: '패널', action: () => { setUtilityTab('steps'); close() } },
    { id: 'settings', icon: Settings, label: '설정 열기', shortcut: 'Ctrl+,', section: '일반', action: () => { setView('settings'); close() } },
    { id: 'history', icon: History, label: '히스토리', section: '일반', action: () => { toggleSessionHistory(); close() } },
  ]

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands

  const sections = [...new Set(filtered.map((c) => c.section))]

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
        setQuery('')
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        close()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, setCommandPaletteOpen, close])

  // Focus input on open
  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [commandPaletteOpen])

  if (!commandPaletteOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.40)',
          zIndex: 200,
        }}
      />

      {/* Palette */}
      <div
        className="anim-scale-in"
        role="dialog"
        aria-label="명령 팔레트"
        style={{
          position: 'fixed',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 520,
          maxHeight: '60vh',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-4)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          padding: 'var(--sp-3) var(--sp-4)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <Command size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="명령 검색..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-md)',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <kbd style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-muted)',
            background: 'var(--bg-hover)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--border-subtle)',
          }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-1) 0' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
              결과 없음
            </div>
          ) : (
            sections.map((section) => (
              <div key={section}>
                <div style={{
                  padding: 'var(--sp-2) var(--sp-4) var(--sp-1)',
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  {section}
                </div>
                {filtered.filter((c) => c.section === section).map((cmd) => {
                  const Icon = cmd.icon
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      className="focus-ring"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-3)',
                        padding: '8px var(--sp-4)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--fs-sm)',
                        transition: `background var(--dur-micro)`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <Icon size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ flex: 1 }}>{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd style={{
                          fontSize: 'var(--fs-xs)',
                          color: 'var(--text-muted)',
                          background: 'var(--bg-hover)',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
