/**
 * Z2 — Primary Navigation
 * Compact rail (56px) or expanded sidebar navigation (240px).
 */
import {
  MessageSquare,
  Settings, Plus, Sparkles,
} from 'lucide-react'
import { useUiStore, type ShellView } from '../../stores/ui.store'

interface NavEntry {
  id: string
  icon: typeof MessageSquare
  label: string
  view?: ShellView
  action?: () => void
  badge?: number
}

export default function NavRail() {
  const { view, setView, navExpanded } = useUiStore()

  const topItems: NavEntry[] = [
    { id: 'chat', icon: MessageSquare, label: '채팅', view: 'chat' },
    { id: 'builder', icon: Sparkles, label: '빌더', view: 'chat' },
  ]

  const bottomItems: NavEntry[] = [
    { id: 'settings', icon: Settings, label: '설정', view: 'settings' },
  ]

  const width = navExpanded ? 'var(--sidebar-width)' : 'var(--nav-rail-width)'

  return (
    <nav
      aria-label="Primary navigation"
      style={{
        width,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-default)',
        flexShrink: 0,
        overflow: 'hidden',
        transition: `width var(--dur-panel) var(--ease-standard)`,
      }}
    >
      {/* New session button */}
      <div style={{ padding: navExpanded ? 'var(--sp-3) var(--sp-3)' : 'var(--sp-3) var(--sp-2)' }}>
        <button
          aria-label="새 세션"
          title="새 세션 (Ctrl+N)"
          className="focus-ring"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: navExpanded ? 'flex-start' : 'center',
            gap: 'var(--sp-2)',
            padding: navExpanded ? '6px 10px' : '6px 0',
            background: 'var(--accent-soft)',
            border: '1px solid rgba(91,138,245,0.18)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent)',
            fontSize: 'var(--fs-sm)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: `background var(--dur-micro)`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-glow)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-soft)' }}
        >
          <Plus size={14} strokeWidth={2} />
          {navExpanded && <span>새 세션</span>}
        </button>
      </div>

      {/* Top nav items */}
      <div style={{ flex: 1, padding: navExpanded ? '0 var(--sp-2)' : '0 var(--sp-1)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {topItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={item.view === view}
            expanded={navExpanded}
            onClick={() => item.view && setView(item.view)}
          />
        ))}
      </div>

      {/* Bottom nav items */}
      <div style={{ padding: navExpanded ? 'var(--sp-2) var(--sp-2) var(--sp-3)' : 'var(--sp-2) var(--sp-1) var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {bottomItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={item.view === view}
            expanded={navExpanded}
            onClick={() => item.view && setView(item.view)}
          />
        ))}
      </div>
    </nav>
  )
}

function NavButton({ item, active, expanded, onClick }: {
  item: NavEntry; active: boolean; expanded: boolean; onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className="focus-ring"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: expanded ? 'flex-start' : 'center',
        gap: 'var(--sp-2)',
        padding: expanded ? '6px 10px' : '8px 0',
        borderRadius: 'var(--radius-md)',
        background: active ? 'var(--bg-active)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 'var(--fs-sm)',
        fontWeight: active ? 500 : 400,
        transition: `background var(--dur-micro), color var(--dur-micro)`,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={16} strokeWidth={active ? 2 : 1.5} />
      {expanded && <span>{item.label}</span>}
      {expanded && item.badge !== undefined && item.badge > 0 && (
        <span style={{
          marginLeft: 'auto',
          fontSize: 'var(--fs-xs)',
          color: 'var(--text-muted)',
          background: 'var(--bg-elevated)',
          padding: '1px 6px',
          borderRadius: 10,
        }}>
          {item.badge}
        </span>
      )}
    </button>
  )
}
