/**
 * Z3 — Work List / Session Surface
 * Recent sessions, pinned work, search.
 */
import { useState } from 'react'
import {
  Archive, GitBranch, RotateCcw,
  Search, Pin, X, AlertTriangle,
  Loader2, Clock, ShieldAlert,
} from 'lucide-react'
import type { SessionStatus, ShellSession } from '@shared/types'
import { useShellStore } from '../../stores/shell.store'
import { useUiStore } from '../../stores/ui.store'

const STATUS_CONFIG: Record<SessionStatus, { icon: typeof Clock; color: string; label: string }> = {
  active:           { icon: Clock,        color: 'var(--accent)',  label: '활성' },
  idle:             { icon: Clock,        color: 'var(--text-muted)', label: '대기' },
  running:          { icon: Loader2,      color: 'var(--warning)', label: '실행 중' },
  failed:           { icon: AlertTriangle, color: 'var(--danger)', label: '실패' },
  approval_pending: { icon: ShieldAlert,  color: 'var(--warning)', label: '승인 대기' },
}

export default function WorkList() {
  const navExpanded = useUiStore((state) => state.navExpanded)
  const sessionHistoryOpen = useUiStore((state) => state.sessionHistoryOpen)
  const activeSessionId = useShellStore((state) => state.activeSessionId)
  const sessions = useShellStore((state) => state.sessions)
  const setActiveSession = useShellStore((state) => state.setActiveSession)
  const branchSession = useShellStore((state) => state.branchSession)
  const archiveSession = useShellStore((state) => state.archiveSession)
  const restoreSession = useShellStore((state) => state.restoreSession)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  if (!navExpanded) return null

  const filtered = sessions.filter((s) =>
    !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const visibleSessions = filtered.filter((session) => !session.archivedAt)
  const archivedSessions = filtered.filter((session) => Boolean(session.archivedAt))
  const pinned = visibleSessions.filter((s) => s.pinned)
  const recent = visibleSessions.filter((s) => !s.pinned)

  return (
    <div style={{
      width: 'var(--worklist-width)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-default)',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--sp-3) var(--sp-3) var(--sp-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span style={{ flex: 1, fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          작업 목록
        </span>
        {sessionHistoryOpen && (
          <span style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--accent)',
            background: 'var(--accent-soft)',
            padding: '1px 8px',
            borderRadius: 10,
          }}>
            히스토리
          </span>
        )}
        <button
          onClick={() => { setSearchOpen(!searchOpen); setSearchQuery('') }}
          aria-label="검색 토글"
          className="focus-ring"
          style={{
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)', cursor: 'pointer',
            transition: `color var(--dur-micro)`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          {searchOpen ? <X size={12} /> : <Search size={12} />}
        </button>
      </div>

      {/* Search */}
      {searchOpen && (
        <div style={{ padding: 'var(--sp-2) var(--sp-3)', borderBottom: '1px solid var(--border-subtle)' }}>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="세션 검색..."
            style={{
              width: '100%',
              padding: '5px var(--sp-2)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-sm)',
              outline: 'none',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-focus)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
          />
        </div>
      )}

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {pinned.length > 0 && (
          <>
            <SectionLabel icon={Pin} label="고정됨" />
            {pinned.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                active={s.id === activeSessionId}
                onClick={() => { void setActiveSession(s.id) }}
                actions={[
                  {
                    icon: GitBranch,
                    label: `${s.title} 분기`,
                    onClick: () => { void branchSession(s.id) },
                  },
                  {
                    icon: Archive,
                    label: `${s.title} 보관`,
                    onClick: () => { void archiveSession(s.id) },
                  },
                ]}
              />
            ))}
          </>
        )}
        {recent.length > 0 && (
          <>
            <SectionLabel icon={Clock} label="최근" />
            {recent.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                active={s.id === activeSessionId}
                onClick={() => { void setActiveSession(s.id) }}
                actions={[
                  {
                    icon: GitBranch,
                    label: `${s.title} 분기`,
                    onClick: () => { void branchSession(s.id) },
                  },
                  {
                    icon: Archive,
                    label: `${s.title} 보관`,
                    onClick: () => { void archiveSession(s.id) },
                  },
                ]}
              />
            ))}
          </>
        )}
        {sessionHistoryOpen && archivedSessions.length > 0 && (
          <>
            <SectionLabel icon={Archive} label="보관됨" />
            {archivedSessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                active={false}
                actions={[
                  {
                    icon: GitBranch,
                    label: `${s.title} 분기`,
                    onClick: () => { void branchSession(s.id) },
                  },
                  {
                    icon: RotateCcw,
                    label: `${s.title} 복원`,
                    onClick: () => { void restoreSession(s.id) },
                  },
                ]}
              />
            ))}
          </>
        )}
        {visibleSessions.length === 0 && (!sessionHistoryOpen || archivedSessions.length === 0) && (
          <div style={{ padding: 'var(--sp-6) var(--sp-4)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              {searchQuery ? '검색 결과 없음' : sessionHistoryOpen ? '보관된 세션이 없습니다' : '세션 없음'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ icon: Icon, label }: { icon: typeof Pin; label: string }) {
  return (
    <div style={{
      padding: 'var(--sp-3) var(--sp-3) var(--sp-1)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--sp-1)',
    }}>
      <Icon size={10} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  )
}

interface SessionRowAction {
  icon: typeof Archive
  label: string
  onClick: () => void
}

function SessionRow({ session, active, onClick, actions = [] }: {
  session: ShellSession
  active: boolean
  onClick?: () => void
  actions?: SessionRowAction[]
}) {
  const status = STATUS_CONFIG[session.status]
  const StatusIcon = status.icon
  const isRunning = session.status === 'running'
  const archived = Boolean(session.archivedAt)

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      <button
        onClick={onClick}
        disabled={!onClick}
        aria-current={active ? 'true' : undefined}
        className="focus-ring"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          padding: 'var(--sp-2) var(--sp-3)',
          background: active ? 'var(--bg-active)' : 'transparent',
          border: 'none',
          borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
          cursor: onClick ? 'pointer' : 'default',
          textAlign: 'left',
          opacity: archived ? 0.72 : 1,
          transition: `background var(--dur-micro), opacity var(--dur-micro)`,
        }}
        onMouseEnter={(e) => { if (!active && onClick) e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'var(--bg-active)' : 'transparent' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minWidth: 0 }}>
          <StatusIcon
            size={12}
            style={{
              color: status.color,
              flexShrink: 0,
              ...(isRunning ? { animation: 'spin 1.5s linear infinite' } : {}),
            }}
          />
          <span
            className="truncate"
            style={{
              flex: 1,
              fontSize: 'var(--fs-sm)',
              fontWeight: active ? 500 : 400,
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {session.title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', paddingLeft: 20 }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
            {archived ? `보관됨 ${session.archivedAt}` : session.updatedAt}
          </span>
          {session.branchedFromMessageId && (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              · 메시지 분기
            </span>
          )}
          {!session.branchedFromMessageId && session.branchedFromSessionId && (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              · 세션 분기
            </span>
          )}
          {session.artifactCount > 0 && (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              · 아티팩트 {session.artifactCount}개
            </span>
          )}
        </div>
      </button>

      {actions.map(({ icon: ActionIcon, label, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          aria-label={label}
          title={label}
          className="focus-ring"
          style={{
            width: 28,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <ActionIcon size={14} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  )
}
