/**
 * Linear-style sidebar — workspace header, navigation, skills tree, settings
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Layers, History, Settings, Search, Plus, X,
  ChevronRight, Download, Star, RefreshCw, Zap, ZapOff,
} from 'lucide-react'
import { useSkillsStore } from '../../stores/skills.store'
import { useChatStore } from '../../stores/chat.store'
import type { SkillMeta } from '@shared/types'

// ─── Nav Item ─────────────────────────────────────────────────────────────────

function NavItem({ icon: Icon, label, active, badge, onClick }: {
  icon: typeof MessageSquare; label: string; active?: boolean; badge?: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 6,
        background: active ? 'var(--bg-active)' : 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 13, fontWeight: active ? 500 : 400,
        transition: 'background 0.1s, color 0.1s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={15} strokeWidth={active ? 2 : 1.5} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 10 }}>
          {badge.toLocaleString()}
        </span>
      )}
    </button>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ label, collapsed, onToggle, action }: {
  label: string; collapsed: boolean; onToggle: () => void; action?: { icon: typeof Plus; title: string; onClick: () => void }
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '16px 12px 4px', gap: 4 }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, flex: 1,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}
      >
        <ChevronRight
          size={11}
          style={{ transform: collapsed ? 'none' : 'rotate(90deg)', transition: 'transform 0.15s' }}
        />
        {label}
      </button>
      {action && (
        <button
          onClick={action.onClick}
          title={action.title}
          style={{
            width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4,
            color: 'var(--text-muted)', transition: 'color 0.1s, background 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
        >
          <action.icon size={12} />
        </button>
      )}
    </div>
  )
}

// ─── Skill Row ────────────────────────────────────────────────────────────────

function SkillRow({ skill, isActivated, onSelect, onActivate }: {
  skill: SkillMeta; isActivated: boolean; onSelect: () => void; onActivate: () => void
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px 5px 24px', cursor: 'pointer',
        background: isActivated ? 'rgba(91,138,245,0.08)' : 'transparent',
        borderLeft: isActivated ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = isActivated ? 'rgba(91,138,245,0.12)' : 'var(--bg-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isActivated ? 'rgba(91,138,245,0.08)' : 'transparent' }}
      onClick={onSelect}
    >
      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{skill.emoji}</span>
      <span style={{
        flex: 1, fontSize: 12, color: isActivated ? 'var(--accent)' : 'var(--text-secondary)',
        fontWeight: isActivated ? 500 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {skill.name || skill.slug}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onActivate() }}
        title={isActivated ? '스킬 비활성화' : '스킬 활성화'}
        style={{
          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, flexShrink: 0,
          color: isActivated ? 'var(--accent)' : 'var(--text-muted)',
          opacity: isActivated ? 1 : 0,
          transition: 'opacity 0.1s, color 0.1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        {isActivated ? <ZapOff size={11} /> : <Zap size={11} />}
      </button>
    </div>
  )
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function Sidebar() {
  const {
    skills, isLoading, query, activatedSkill,
    search, selectSkill, activateSkill, deactivateSkill, reindex,
  } = useSkillsStore()
  const { clearMessages } = useChatStore()

  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [skillsCollapsed, setSkillsCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [reindexing, setReindexing] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { search('') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(q), 200)
  }, [search])

  const handleReindex = async () => {
    setReindexing(true)
    await reindex()
    setReindexing(false)
  }

  return (
    <div style={{
      width: 240, height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
      flexShrink: 0, overflow: 'hidden',
    }}>

      {/* ── Workspace Header ── */}
      <div style={{
        padding: '12px 10px 8px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: 'linear-gradient(135deg, #5b8af5, #7c5bf5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          U
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Usan</span>
        </div>
        {/* Search toggle */}
        <button
          onClick={() => { setSearchOpen((v) => !v); setTimeout(() => searchRef.current?.focus(), 100) }}
          style={{
            width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: 5, cursor: 'pointer',
            color: 'var(--text-muted)', transition: 'color 0.1s, background 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
        >
          <Search size={14} />
        </button>
        {/* New chat */}
        <button
          onClick={() => clearMessages()}
          title="새 대화"
          style={{
            width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: 5, cursor: 'pointer',
            color: 'var(--text-muted)', transition: 'color 0.1s, background 0.1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* ── Search Bar (collapsible) ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ overflow: 'hidden', borderBottom: '1px solid var(--border)' }}
          >
            <div style={{ padding: '6px 10px', position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                ref={searchRef}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="스킬 검색..."
                style={{
                  width: '100%', padding: '6px 24px 6px 26px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
                  transition: 'border 0.1s',
                }}
                onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--border-focus)' }}
                onBlur={(e) => { e.currentTarget.style.border = '1px solid var(--border)' }}
              />
              <button
                onClick={() => { setSearchOpen(false); handleSearch('') }}
                style={{
                  position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', padding: 2,
                }}
              >
                <X size={11} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navigation ── */}
      <div style={{ padding: '8px 6px 0' }}>
        <NavItem icon={MessageSquare} label="채팅" active={view === 'chat'} onClick={() => setView('chat')} />
        <NavItem icon={History} label="히스토리" active={view === 'history'} onClick={() => setView('history')} />
      </div>

      {/* ── Active Skill Indicator ── */}
      <AnimatePresence>
        {activatedSkill && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              margin: '8px 10px', padding: '6px 10px', borderRadius: 6,
              background: 'rgba(91,138,245,0.08)', border: '1px solid rgba(91,138,245,0.2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Zap size={12} color="var(--accent)" />
              <span style={{ flex: 1, fontSize: 12, color: 'var(--accent)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activatedSkill.emoji} {activatedSkill.name}
              </span>
              <button
                onClick={deactivateSkill}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 3 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <X size={11} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Skills Section ── */}
      <SectionHeader
        label={`스킬 ${skills.length > 0 ? `(${skills.length.toLocaleString()})` : ''}`}
        collapsed={skillsCollapsed}
        onToggle={() => setSkillsCollapsed((v) => !v)}
        action={{ icon: RefreshCw, title: '재인덱스', onClick: handleReindex }}
      />

      {/* Skills list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {!skillsCollapsed && (
          <>
            {isLoading || reindexing ? (
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 28, borderRadius: 4 }} />
                ))}
              </div>
            ) : skills.length === 0 ? (
              <div style={{ padding: '16px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>스킬 없음</p>
                <button
                  onClick={handleReindex}
                  style={{
                    marginTop: 8, padding: '4px 12px', fontSize: 11, borderRadius: 5,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                  }}
                >
                  재인덱스
                </button>
              </div>
            ) : (
              skills.map((skill) => (
                <SkillRow
                  key={skill.slug}
                  skill={skill}
                  isActivated={activatedSkill?.slug === skill.slug}
                  onSelect={() => selectSkill(skill)}
                  onActivate={() => activatedSkill?.slug === skill.slug ? deactivateSkill() : activateSkill(skill)}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* ── Bottom ── */}
      <div style={{ padding: '6px 6px 8px', borderTop: '1px solid var(--border)' }}>
        <NavItem icon={Settings} label="설정" onClick={() => {}} />
      </div>
    </div>
  )
}
