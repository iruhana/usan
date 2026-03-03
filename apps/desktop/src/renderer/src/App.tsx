import { useState, useEffect } from 'react'
import { Umbrella } from 'lucide-react'
import AppLayout from './components/layout/AppLayout'
import OnboardingWizard from './components/onboarding/OnboardingWizard'
import ErrorBoundary from './components/ErrorBoundary'
import OfflineBanner from './components/OfflineBanner'
import TitleBar from './components/layout/TitleBar'
import { useSettingsStore } from './stores/settings.store'
import { setLocale, t } from './i18n'
import { isTimedGrantActive } from '@shared/types/permissions'

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(true)
  const [loading, setLoading] = useState(true)
  const loadSettings = useSettingsStore((s) => s.load)

  useEffect(() => {
    // Load persisted settings, then detect locale on first launch
    loadSettings().then(async () => {
      const s = useSettingsStore.getState().settings
      if (!s.locale || s.locale === 'ko') {
        try {
          const detected = await window.usan?.system.detectLocale()
          if (detected && detected !== 'ko') {
            await window.usan?.settings.set({ locale: detected })
            setLocale(detected)
          }
        } catch { /* ignore */ }
      }
    }).catch(() => {})

    window.usan?.permissions.get().then((grant) => {
      const now = Date.now()
      const hasGranularGrant =
        Object.values(grant.toolGrants ?? {}).some((item) => isTimedGrantActive(item, now)) ||
        Object.values(grant.featureGrants ?? {}).some((item) => isTimedGrantActive(item, now)) ||
        Object.values(grant.skillGrants ?? {}).some((item) => isTimedGrantActive(item, now))
      if (grant.grantedAll || hasGranularGrant) {
        setShowOnboarding(false)
      }
      setLoading(false)
    }).catch(() => {
      // If IPC not available (dev without electron), skip onboarding
      setShowOnboarding(false)
      setLoading(false)
    })
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
      <div className="flex flex-col h-screen bg-[var(--color-bg)]">
        <TitleBar />
        <div className="flex-1 overflow-auto">
          <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <AppLayout />
    </ErrorBoundary>
  )
}
