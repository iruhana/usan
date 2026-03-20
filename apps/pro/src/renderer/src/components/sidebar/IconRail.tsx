import { motion } from 'framer-motion'
import { MessageSquare, Layers, History, Settings } from 'lucide-react'
import { useSkillsStore } from '../../stores/skills.store'

type Panel = 'skills' | 'history'

const NAV_ITEMS: Array<{ id: Panel; icon: typeof Layers; label: string }> = [
  { id: 'skills',  icon: Layers,  label: '스킬' },
  { id: 'history', icon: History, label: '히스토리' },
]

export default function IconRail() {
  const { activePanel, setPanel } = useSkillsStore()

  return (
    <div
      style={{
        width: 48,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 8,
        gap: 2,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
        const active = activePanel === id
        return (
          <motion.button
            key={id}
            onClick={() => setPanel(active ? ('skills' as Panel) : id)}
            aria-label={label}
            title={label}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: active ? 'rgba(91,138,245,0.1)' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            {active && (
              <motion.div
                layoutId="rail-indicator"
                style={{
                  position: 'absolute', inset: 0, borderRadius: 8,
                  background: 'rgba(91,138,245,0.1)',
                  border: '1px solid rgba(91,138,245,0.18)',
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
            <Icon size={17} strokeWidth={active ? 2 : 1.5} style={{ position: 'relative', zIndex: 1 }} />
          </motion.button>
        )
      })}
    </div>
  )
}
