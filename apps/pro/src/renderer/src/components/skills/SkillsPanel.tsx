import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, RefreshCw, X, Download, Star, ArrowLeft, Zap, ZapOff } from 'lucide-react'
import { useSkillsStore } from '../../stores/skills.store'
import type { SkillMeta } from '@shared/types'

const CATEGORY_LABELS: Record<string, string> = {
  ai: '🤖 AI',
  dev: '💻 개발',
  productivity: '📋 생산성',
  data: '🗄️ 데이터',
  research: '🔬 리서치',
  finance: '💰 금융',
  marketing: '📣 마케팅',
  security: '🔒 보안',
  media: '🎬 미디어',
  agent: '🤖 에이전트',
  general: '🔧 일반',
}

function SkillCard({ skill, active, onClick }: { skill: SkillMeta; active: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        marginBottom: 2,
        background: active ? 'rgba(91,138,245,0.08)' : 'transparent',
        border: 'none',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background var(--dur-fast)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = active ? 'rgba(91,138,245,0.12)' : 'var(--bg-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'rgba(91,138,245,0.08)' : 'transparent' }}
    >
      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{skill.emoji}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {skill.name || skill.slug}
        </p>
        {skill.description && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {skill.description}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {skill.downloads > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Download size={10} />
              {skill.downloads.toLocaleString()}
            </span>
          )}
          {skill.stars > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Star size={10} />
              {skill.stars}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  )
}

function SkillDetail({ skill, content, onBack }: { skill: SkillMeta; content: string; onBack: () => void }) {
  const { activatedSkill, activateSkill, deactivateSkill } = useSkillsStore()
  const isActive = activatedSkill?.slug === skill.slug

  return (
    <motion.div
      key="detail"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 6px', borderRadius: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
          >
            <ArrowLeft size={13} /> 뒤로
          </button>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{skill.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.name || skill.slug}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>v{skill.version}</p>
          </div>
        </div>
        {/* Activate button */}
        <button
          onClick={() => isActive ? deactivateSkill() : activateSkill(skill)}
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 8,
            background: isActive ? 'rgba(91,138,245,0.15)' : 'var(--bg-elevated)',
            border: `1px solid ${isActive ? 'rgba(91,138,245,0.4)' : 'var(--border)'}`,
            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'all var(--dur-fast)',
          }}
        >
          {isActive ? <ZapOff size={13} /> : <Zap size={13} />}
          {isActive ? '스킬 비활성화' : '이 스킬로 대화하기'}
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {content ? (
          <pre style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, fontFamily: 'inherit' }}>
            {content}
          </pre>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[80, 60, 90, 50, 70].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: 12, width: `${w}%` }} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function SkillsPanel() {
  const { skills, isLoading, query, selectedSkill, skillContent, activatedSkill, search, selectSkill, clearSelection, reindex } = useSkillsStore()
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
    <div
      style={{
        width: 'var(--panel-width)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <AnimatePresence mode="wait">
        {selectedSkill ? (
          <SkillDetail
            key="detail"
            skill={selectedSkill}
            content={skillContent}
            onBack={clearSelection}
          />
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  스킬 ({skills.length.toLocaleString()})
                </p>
                <button
                  onClick={handleReindex}
                  disabled={reindexing}
                  title="스킬 재인덱스"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 6 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <RefreshCw size={13} style={{ animation: reindexing ? 'spin 1s linear infinite' : 'none' }} />
                </button>
              </div>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="스킬 검색..."
                  style={{
                    width: '100%',
                    padding: '7px 28px 7px 28px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    outline: 'none',
                    transition: 'border var(--dur-fast)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.border = '1px solid var(--border-focus)' }}
                  onBlur={(e) => { e.currentTarget.style.border = '1px solid var(--border)' }}
                />
                {query && (
                  <button
                    onClick={() => { handleSearch(''); if (searchRef.current) searchRef.current.value = '' }}
                    style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />
                  ))}
                </div>
              ) : skills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: 13 }}>스킬을 찾을 수 없습니다</p>
                  <p style={{ fontSize: 11, marginTop: 4 }}>재인덱스 버튼을 눌러보세요</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {skills.map((skill) => (
                    <SkillCard
                      key={skill.slug}
                      skill={skill}
                      active={activatedSkill?.slug === skill.slug}
                      onClick={() => selectSkill(skill)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
