import { useState, useEffect, lazy, Suspense } from 'react'
import { Umbrella } from 'lucide-react'
import ErrorBoundary from './components/ErrorBoundary'
import TitleBar from './components/layout/TitleBar'
import { useSettingsStore } from './stores/settings.store'
import { setLocale, t } from './i18n'
import { isTimedGrantActive } from '@shared/types/permissions'

const AppLayout = lazy(() => import('./components/layout/AppLayout'))
const OnboardingWizard = lazy(() => import('./components/onboarding/OnboardingWizard'))
const OfflineBanner = lazy(() => import('./components/OfflineBanner'))

function BootFallback() {
  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg)]">
      <TitleBar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-bounce"><Umbrella size={48} className="text-[var(--color-primary)] mx-auto" /></div>
          <p className="text-[var(--color-text-muted)] text-[length:var(--text-md)]">
            {t('app.loading')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [loading, setLoading] = useState(true)
  const loadSettings = useSettingsStore((s) => s.load)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        // Load persisted settings, then detect locale on first launch
        await loadSettings()
        const s = useSettingsStore.getState().settings
        if (!s.locale || s.locale === 'ko') {
          try {
            const detected = await window.usan?.system.detectLocale()
            if (detected && detected !== 'ko') {
              await window.usan?.settings.set({ locale: detected })
              setLocale(detected)
            }
          } catch {
            // ignore locale detection failures
          }
        }
      } catch {
        // ignore settings load failures
      }

      if (cancelled) return

      try {
        const grant = await window.usan?.permissions.get()
        if (!grant) {
          setShowOnboarding(false)
          return
        }
        const now = Date.now()
        const hasGranularGrant =
          Object.values(grant.toolGrants ?? {}).some((item) => isTimedGrantActive(item, now)) ||
          Object.values(grant.featureGrants ?? {}).some((item) => isTimedGrantActive(item, now)) ||
          Object.values(grant.skillGrants ?? {}).some((item) => isTimedGrantActive(item, now))
        if (grant.grantedAll || hasGranularGrant) {
          setShowOnboarding(false)
        }
      } catch {
        // If IPC not available (dev without electron), skip onboarding
        setShowOnboarding(false)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [loadSettings])

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[var(--color-bg)]">
        <TitleBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-4 animate-bounce"><Umbrella size={56} className="text-[var(--color-primary)] mx-auto" /></div>
            <p className="text-[var(--color-text-muted)] text-[length:var(--text-lg)]">
              {t('app.loading')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (showOnboarding) {
    return (
      <Suspense fallback={<BootFallback />}>
        <div className="flex flex-col h-screen bg-[var(--color-bg)]">
          <TitleBar />
          <div className="flex-1 overflow-auto">
            <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
          </div>
        </div>
      </Suspense>
    )
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<BootFallback />}>
        <OfflineBanner />
        <AppLayout />
      </Suspense>
    </ErrorBoundary>
  )
}
