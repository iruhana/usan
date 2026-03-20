import { motion, AnimatePresence } from 'framer-motion'
import { useTabsStore } from '../../stores/tabs.store'

export default function AIPanel() {
  const { providers, activeId, switchTo, isTransitioning } = useTabsStore()

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
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          AI 허브
        </p>
      </div>

      {/* Provider list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        <AnimatePresence initial={false}>
          {providers.map((p, i) => {
            const active = p.id === activeId
            return (
              <motion.button
                key={p.id}
                onClick={() => switchTo(p.id)}
                disabled={isTransitioning}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 24 }}
                style={{
                  position: 'relative',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  marginBottom: 2,
                  background: active ? 'var(--bg-active)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background var(--dur-fast)',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Active indicator bar */}
                {active && (
                  <motion.div
                    layoutId="ai-active-bar"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: 18,
                      background: 'var(--accent)',
                      borderRadius: '0 2px 2px 0',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                {/* Icon */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: active ? p.color + '22' : 'var(--bg-elevated)',
                    border: active ? `1px solid ${p.color}44` : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    flexShrink: 0,
                    transition: 'background var(--dur-fast), border var(--dur-fast)',
                    color: active ? p.color : 'var(--text-secondary)',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {p.icon}
                </div>

                {/* Label */}
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'color var(--dur-fast)',
                    }}
                  >
                    {p.name}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.type === 'api' ? 'Built-in' : 'Web'}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
