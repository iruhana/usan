/**
 * Artifact Surface — durable, versionable, exportable result entities.
 * Separate from Preview: artifact is for persistence, preview is for iteration.
 */
import { useState } from 'react'
import type { ArtifactKind, ShellArtifact } from '@shared/types'
import {
  FileCode, FileText, FileJson, FileDiff, FileCheck,
  Eye, Download, Copy, ChevronRight,
  RotateCcw,
} from 'lucide-react'
import { useShellStore } from '../../stores/shell.store'

const KIND_CONFIG: Record<ArtifactKind, { icon: typeof FileCode; color: string; label: string }> = {
  code:     { icon: FileCode, color: 'var(--accent)',  label: '코드' },
  markdown: { icon: FileText, color: 'var(--success)', label: '마크다운' },
  json:     { icon: FileJson, color: 'var(--warning)', label: 'JSON' },
  diff:     { icon: FileDiff, color: 'var(--danger)',  label: 'Diff' },
  plan:     { icon: FileCheck, color: 'var(--text-secondary)', label: '계획' },
  preview:  { icon: Eye,      color: 'var(--accent)',  label: '프리뷰' },
}

interface ArtifactPanelProps {
  sessionId?: string
}

export default function ArtifactPanel({ sessionId }: ArtifactPanelProps) {
  const allArtifacts = useShellStore((state) => state.artifacts)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const artifacts = sessionId
    ? allArtifacts.filter((artifact) => artifact.sessionId === sessionId)
    : allArtifacts

  const selected = artifacts.find((a) => a.id === selectedId)

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-2) var(--sp-3)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-default)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
          아티팩트
        </span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          {artifacts.length}개
        </span>
      </div>

      {/* List + Detail split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Artifact list */}
        <div style={{
          width: selected ? 240 : '100%',
          borderRight: selected ? '1px solid var(--border-subtle)' : 'none',
          overflowY: 'auto',
          transition: `width var(--dur-panel)`,
        }}>
          {artifacts.length === 0 ? (
            <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
              아직 생성된 아티팩트가 없습니다
            </div>
          ) : (
            artifacts.map((art) => (
              <ArtifactRow
                key={art.id}
                artifact={art}
                active={art.id === selectedId}
                onClick={() => setSelectedId(art.id === selectedId ? null : art.id)}
              />
            ))
          )}
        </div>

        {/* Detail view */}
        {selected && (
          <div className="anim-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ArtifactDetail artifact={selected} />
          </div>
        )}
      </div>
    </div>
  )
}

function ArtifactRow({ artifact, active, onClick }: {
  artifact: ShellArtifact; active: boolean; onClick: () => void
}) {
  const config = KIND_CONFIG[artifact.kind]
  const Icon = config.icon

  return (
    <button
      onClick={onClick}
      aria-selected={active}
      className="focus-ring"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-2) var(--sp-3)',
        background: active ? 'var(--bg-active)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: `background var(--dur-micro)`,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'var(--bg-active)' : 'transparent' }}
    >
      <Icon size={14} style={{ color: config.color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>
          {artifact.title}
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          <span>{config.label}</span>
          <span>·</span>
          <span>v{artifact.version}</span>
          <span>·</span>
          <span>{artifact.createdAt}</span>
        </div>
      </div>
      <ChevronRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </button>
  )
}

function ArtifactDetail({ artifact }: { artifact: ShellArtifact }) {
  const config = KIND_CONFIG[artifact.kind]
  const content = artifact.content ?? `# ${artifact.title}\n\n이 아티팩트는 백엔드 연결 후 실제 내용이 표시됩니다.`

  return (
    <>
      {/* Detail header */}
      <div style={{
        padding: 'var(--sp-3)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
      }}>
        <config.icon size={14} style={{ color: config.color }} />
        <span className="truncate" style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
          {artifact.title}
        </span>

        {/* Actions */}
        <ActionButton icon={Copy} label="복사" />
        <ActionButton icon={Download} label="내보내기" />
        <ActionButton icon={RotateCcw} label="이전 버전" />
      </div>

      {/* Meta */}
      <div style={{
        padding: 'var(--sp-2) var(--sp-3)',
        display: 'flex',
        gap: 'var(--sp-4)',
        fontSize: 'var(--fs-xs)',
        color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <span>버전 {artifact.version}</span>
        <span>{artifact.createdAt}</span>
        <span>{artifact.size}</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--sp-3)' }}>
        {artifact.kind === 'diff' ? (
          <DiffView content={content} />
        ) : (
          <pre style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-sm)',
            lineHeight: 'var(--lh-relaxed)',
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {content}
          </pre>
        )}
      </div>
    </>
  )
}

function ActionButton({ icon: Icon, label }: { icon: typeof Copy; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className="focus-ring"
      style={{
        width: 26, height: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
        color: 'var(--text-muted)', cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      <Icon size={13} />
    </button>
  )
}

function DiffView({ content }: { content: string }) {
  const lines = content.split('\n')

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-relaxed)' }}>
      {lines.map((line, i) => {
        let bg = 'transparent'
        let color = 'var(--text-primary)'

        if (line.startsWith('+++') || line.startsWith('---')) {
          color = 'var(--text-muted)'
          bg = 'var(--bg-elevated)'
        } else if (line.startsWith('@@')) {
          color = 'var(--accent)'
          bg = 'var(--accent-soft)'
        } else if (line.startsWith('+')) {
          color = 'var(--success)'
          bg = 'var(--success-soft)'
        } else if (line.startsWith('-')) {
          color = 'var(--danger)'
          bg = 'var(--danger-soft)'
        }

        return (
          <div key={i} style={{
            display: 'flex',
            background: bg,
            padding: '0 var(--sp-2)',
            borderLeft: line.startsWith('+') ? '3px solid var(--success)'
              : line.startsWith('-') ? '3px solid var(--danger)'
              : '3px solid transparent',
          }}>
            <span style={{
              width: 32,
              textAlign: 'right',
              paddingRight: 'var(--sp-2)',
              color: 'var(--text-muted)',
              userSelect: 'none',
              flexShrink: 0,
            }}>
              {i + 1}
            </span>
            <span style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {line}
            </span>
          </div>
        )
      })}
    </div>
  )
}
