import { useState, useEffect, lazy, Suspense } from 'react'
import { Umbrella } from 'lucide-react'
import ErrorBoundary from './components/ErrorBoundary'
import TitleBar from './components/layout/TitleBar'
import { useSettingsStore } from './stores/settings.store'
import { setLocale, t } from './i18n'
import { isTimedGrantActive } from '@shared/types/permissions'

const AppShell = lazy(() => import('./components/shell/AppShell'))
const OnboardingWizard = lazy(() => import('./components/onboarding/OnboardingWizard'))
const OfflineBanner = lazy(() => import('./components/OfflineBanner'))

function BootFallback() {
  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg)]">
      <TitleBar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center animate-in">
          <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-[var(--color-primary)] to-indigo-500 shadow-[var(--shadow-primary)] mx-auto animate-bounce">
            <Umbrella size={28} className="text-white" strokeWidth={2} />
          </div>
          <p className="text-[var(--color-text-muted)] text-[length:var(--text-md)] font-medium">
            {t('app.loading')}
          </p>
        </div>
      </div>
    </div>
  )
}

function ForcedRenderError(): null {
  throw new Error('Forced E2E render error')
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [loading, setLoading] = useState(true)
  const loadSettings = useSettingsStore((s) => s.load)
  const locale = useSettingsStore((s) => s.settings.locale)
  const forceRenderError =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('usan_e2e_force_error') === '1'

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        // Load persisted settings, then detect locale on first launch
        await loadSettings()
        const s = useSettingsStore.getState().settings
        if (!s.localeConfigured) {
          try {
            const detected = await window.usan?.system.detectLocale()
            if (detected) {
              const localeUpdate = { locale: detected, localeConfigured: true }
              await window.usan?.settings.set(localeUpdate)
              useSettingsStore.setState((state) => ({
                ...state,
                settings: {
                  ...state.settings,
                  ...localeUpdate,
                },
              }))
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
          Object.values(grant.skillGrants ?? {}).some((item) => isTimedGrantActive(item, now)) ||
          Object.values(grant.directoryGrants ?? {}).some((item) => isTimedGrantActive(item, now))
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
          <div className="text-center animate-in">
            <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-[var(--color-primary)] to-indigo-500 shadow-[var(--shadow-primary)] mx-auto animate-bounce">
              <Umbrella size={36} className="text-white" strokeWidth={2} />
            </div>
            <p className="text-[var(--color-text-muted)] text-[length:var(--text-lg)] font-medium">
              {t('app.loading')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (forceRenderError) {
    return (
      <ErrorBoundary>
        <ForcedRenderError />
      </ErrorBoundary>
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
        <AppShell />
      </Suspense>
    </ErrorBoundary>
  )
}
