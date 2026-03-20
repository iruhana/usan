/**
 * Z5 — Context Panel
 * References, memories, resources, model/build parameters.
 */
import type { ReferenceType, ShellReference } from '@shared/types'
import { X, File, Brain, Globe, BookOpen, ChevronRight } from 'lucide-react'
import { useChatStore } from '../../stores/chat.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useShellStore } from '../../stores/shell.store'
import { useUiStore } from '../../stores/ui.store'

const TYPE_CONFIG: Record<ReferenceType, { icon: typeof File; label: string; color: string }> = {
  file:     { icon: File,     label: '파일',   color: 'var(--accent)' },
  memory:   { icon: Brain,    label: '메모리', color: 'var(--success)' },
  web:      { icon: Globe,    label: '웹',     color: 'var(--warning)' },
  resource: { icon: BookOpen, label: '리소스', color: 'var(--text-secondary)' },
}

export default function ContextPanel() {
  const { contextPanelOpen, toggleContextPanel } = useUiStore()
  const activeSessionId = useShellStore((state) => state.activeSessionId)
  const references = useShellStore((state) => state.references)
  const { models, selectedModel } = useChatStore()
  const toolUseEnabled = useSettingsStore((state) => state.settings.toolUseEnabled)
  const activeReferences = activeSessionId
    ? references.filter((reference) => reference.sessionId === activeSessionId)
    : []
  const currentModel = models.find((model) => model.id === selectedModel)

  if (!contextPanelOpen) return null

  return (
    <div
      className="anim-fade-in"
      style={{
        width: 'var(--context-panel-width)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-default)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--sp-3)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          컨텍스트
        </span>
        <button
          onClick={toggleContextPanel}
          aria-label="패널 닫기"
          className="focus-ring"
          style={{
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* References list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-2) 0' }}>
        <SectionHeading label="참조" count={activeReferences.length} />
        {activeReferences.map((ref) => (
          <ReferenceRow key={ref.id} reference={ref} />
        ))}

        {/* Model parameters section */}
        <SectionHeading label="모델 파라미터" />
        <div style={{ padding: 'var(--sp-2) var(--sp-3)' }}>
          <ParamRow label="모델" value={currentModel?.name ?? '기본값'} />
          <ParamRow label="Temperature" value="0.7" />
          <ParamRow label="Max tokens" value="4,096" />
          <ParamRow label="도구 사용" value={toolUseEnabled ? '활성' : '비활성'} />
        </div>
      </div>
    </div>
  )
}

function SectionHeading({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{
      padding: 'var(--sp-3) var(--sp-3) var(--sp-1)',
      display: 'flex', alignItems: 'center', gap: 'var(--sp-1)',
    }}>
      <span style={{
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>({count})</span>
      )}
    </div>
  )
}

function ReferenceRow({ reference }: { reference: ShellReference }) {
  const config = TYPE_CONFIG[reference.type]
  const Icon = config.icon

  return (
    <button
      className="focus-ring"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        padding: '6px var(--sp-3)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: `background var(--dur-micro)`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={13} style={{ color: config.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>
          {reference.title}
        </div>
        <div className="truncate" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          {reference.detail}
        </div>
      </div>
      <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </button>
  )
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '4px 0',
      fontSize: 'var(--fs-sm)',
    }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)' }}>{value}</span>
    </div>
  )
}
