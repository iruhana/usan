/**
 * Preview Surface — fast visual inspection of current result.
 * Separate from Artifact: preview is for iteration, artifact is for persistence.
 */
import { useState } from 'react'
import type { PreviewStatus } from '@shared/types'
import {
  RefreshCw, Maximize2, Minimize2, AlertTriangle,
  Smartphone, Monitor, Tablet,
} from 'lucide-react'

type ViewportMode = 'desktop' | 'tablet' | 'mobile'

const VIEWPORT_WIDTHS: Record<ViewportMode, number> = {
  desktop: 0, // full width
  tablet: 768,
  mobile: 375,
}

const STATUS_STYLE: Record<PreviewStatus, { color: string; bg: string; label: string }> = {
  healthy: { color: 'var(--success)', bg: 'var(--success-soft)', label: '정상' },
  partial: { color: 'var(--warning)', bg: 'var(--warning-soft)', label: '부분' },
  stale:   { color: 'var(--text-muted)', bg: 'var(--bg-hover)', label: '오래됨' },
  failed:  { color: 'var(--danger)', bg: 'var(--danger-soft)', label: '실패' },
}

interface PreviewPanelProps {
  status?: PreviewStatus
  title?: string
  version?: number
  onRetry?: () => void
  onRevert?: () => void
}

export default function PreviewPanel({
  status = 'healthy',
  title = 'page-preview',
  version = 3,
  onRetry,
  onRevert,
}: PreviewPanelProps) {
  const [viewport, setViewport] = useState<ViewportMode>('desktop')
  const [expanded, setExpanded] = useState(false)
  const statusConfig = STATUS_STYLE[status]

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
      overflow: 'hidden',
      ...(expanded ? { position: 'fixed', inset: 0, zIndex: 150 } : {}),
    }}>
      {/* Toolbar */}
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
          프리뷰
        </span>
        <span className="truncate" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', maxWidth: 160 }}>
          {title}
        </span>
        <span style={{
          fontSize: 'var(--fs-xs)',
          padding: '1px 6px',
          borderRadius: 10,
          background: statusConfig.bg,
          color: statusConfig.color,
        }}>
          {statusConfig.label}
        </span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          v{version}
        </span>

        <div style={{ flex: 1 }} />

        {/* Viewport switcher */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          {([
            { mode: 'desktop' as const, icon: Monitor },
            { mode: 'tablet' as const, icon: Tablet },
            { mode: 'mobile' as const, icon: Smartphone },
          ]).map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setViewport(mode)}
              aria-label={mode}
              style={{
                width: 26, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: viewport === mode ? 'var(--bg-active)' : 'transparent',
                border: 'none', borderRadius: 'var(--radius-xs)',
                color: viewport === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <Icon size={12} />
            </button>
          ))}
        </div>

        <button
          onClick={onRetry}
          aria-label="새로고침"
          style={{
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <RefreshCw size={13} />
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? '축소' : '확대'}
          style={{
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* Preview frame */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        overflow: 'auto',
        padding: 'var(--sp-4)',
        background: 'var(--bg-base)',
      }}>
        {status === 'failed' ? (
          <PreviewFailedState onRetry={onRetry} onRevert={onRevert} />
        ) : (
          <div style={{
            width: VIEWPORT_WIDTHS[viewport] || '100%',
            maxWidth: '100%',
            minHeight: 400,
            background: '#fff',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-default)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-2)',
            transition: `width var(--dur-panel) var(--ease-standard)`,
          }}>
            {/* Mock preview content */}
            <div style={{ padding: 0 }}>
              {/* Mock hero section */}
              <div style={{
                height: 280,
                background: 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}>
                <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>Cafe Blossom</h1>
                <p style={{ fontSize: 16, opacity: 0.9 }}>따뜻한 한 잔의 여유</p>
              </div>

              {/* Mock menu grid */}
              <div style={{ padding: 32 }}>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a', marginBottom: 16 }}>메뉴</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {['아메리카노', '카페라떼', '바닐라라떼', '초코프라페', '녹차라떼', '캐모마일'].map((name) => (
                    <div key={name} style={{
                      padding: 16,
                      background: '#fef3c7',
                      borderRadius: 8,
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#451a03' }}>{name}</div>
                      <div style={{ fontSize: 12, color: '#92400e', marginTop: 4 }}>4,500원</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PreviewFailedState({ onRetry, onRevert }: { onRetry?: () => void; onRevert?: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--sp-8)',
      textAlign: 'center',
    }}>
      <AlertTriangle size={32} style={{ color: 'var(--danger)', marginBottom: 'var(--sp-3)' }} />
      <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)' }}>
        프리뷰를 생성할 수 없습니다
      </h3>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)', maxWidth: 300 }}>
        빌드 과정에서 오류가 발생했습니다. 다시 시도하거나 이전 버전으로 복원하세요.
      </p>
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button
          onClick={onRetry}
          className="focus-ring"
          style={{
            padding: '6px 16px',
            fontSize: 'var(--fs-sm)',
            fontWeight: 500,
            background: 'var(--accent)',
            color: 'var(--text-inverse)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
        <button
          onClick={onRevert}
          className="focus-ring"
          style={{
            padding: '6px 16px',
            fontSize: 'var(--fs-sm)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}
        >
          이전 버전 복원
        </button>
      </div>
    </div>
  )
}
