/**
 * Skip to main content link — hidden until focused via Tab key.
 * Essential for keyboard and screen reader users.
 */
import { t } from '../../i18n'

export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:rounded-[var(--radius-md)] focus:bg-[var(--color-primary)] focus:text-[var(--color-text-inverse)] focus:font-semibold focus:outline-none text-[length:var(--text-md)]"
    >
      {t('a11y.skipToContent')}
    </a>
  )
}
