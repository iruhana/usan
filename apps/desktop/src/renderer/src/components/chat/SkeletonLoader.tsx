import { Loader2, Cog, Sparkles } from 'lucide-react'
import { t } from '../../i18n'

interface Props {
  phase?: 'waiting' | 'tool' | 'generating'
}

export function SkeletonLoader({ phase = 'waiting' }: Props) {
  const Icon = phase === 'tool' ? Cog : phase === 'generating' ? Sparkles : Loader2
  const label =
    phase === 'tool' ? t('home.toolRunning') :
    phase === 'generating' ? t('home.generating') :
    t('home.thinking')

  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-xl rounded-bl-sm bg-[var(--color-surface-soft)] border border-[var(--color-border)]/50 text-[length:var(--text-md)]"
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <Icon size={16} className={`text-[var(--color-primary)] shrink-0 ${phase === 'tool' ? 'animate-spin' : 'animate-pulse'}`} />
        <span className="text-[var(--color-text-muted)]">
          {label}
        </span>
      </div>
    </div>
  )
}
