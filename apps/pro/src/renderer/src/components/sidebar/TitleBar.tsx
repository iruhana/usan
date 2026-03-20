import { useEffect, useState } from 'react'
import { Minus, Copy, X, Maximize2 } from 'lucide-react'

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.usan.window.isMaximized().then(setMaximized)
  }, [])

  const handleMaximize = async () => {
    await window.usan.window.maximize()
    setMaximized(await window.usan.window.isMaximized())
  }

  return (
    <div
      className="drag-region"
      style={{
        height: 'var(--titlebar-height)',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {/* Spacer for sidebar alignment */}
      <div style={{ width: 240, flexShrink: 0 }} />

      {/* Center: title */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
          Usan
        </span>
      </div>

      {/* Right: window controls */}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center' }}>
        {[
          { icon: Minus, label: 'Minimize', action: () => window.usan.window.minimize(), hoverBg: 'rgba(255,255,255,0.06)', hoverColor: 'var(--text-primary)' },
          { icon: maximized ? Copy : Maximize2, label: 'Maximize', action: handleMaximize, hoverBg: 'rgba(255,255,255,0.06)', hoverColor: 'var(--text-primary)' },
          { icon: X, label: 'Close', action: () => window.usan.window.close(), hoverBg: '#e81123', hoverColor: '#fff' },
        ].map(({ icon: Icon, label, action, hoverBg, hoverColor }) => (
          <button
            key={label}
            onClick={action}
            aria-label={label}
            style={{
              width: 46, height: 'var(--titlebar-height)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.color = hoverColor }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <Icon size={label === 'Close' ? 15 : 13} strokeWidth={1.5} />
          </button>
        ))}
      </div>
    </div>
  )
}
