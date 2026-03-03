import { useState } from 'react'
import {
  Monitor,
  FolderOpen,
  AppWindow,
  MousePointer2,
  Globe,
  Settings,
  ChevronRight,
  MessageCircle,
  Umbrella,
  Type,
  Sparkles,
} from 'lucide-react'
import { t } from '../../i18n'
import { Button, Card } from '../ui'

interface OnboardingWizardProps {
  onComplete: () => void
}

const PERMISSION_ITEMS = [
  { icon: Monitor, labelKey: 'onboarding.perm.screen', descKey: 'onboarding.perm.screenDesc' },
  { icon: FolderOpen, labelKey: 'onboarding.perm.files', descKey: 'onboarding.perm.filesDesc' },
  { icon: AppWindow, labelKey: 'onboarding.perm.apps', descKey: 'onboarding.perm.appsDesc' },
  { icon: MousePointer2, labelKey: 'onboarding.perm.input', descKey: 'onboarding.perm.inputDesc' },
  { icon: Globe, labelKey: 'onboarding.perm.internet', descKey: 'onboarding.perm.internetDesc' },
  { icon: Settings, labelKey: 'onboarding.perm.settings', descKey: 'onboarding.perm.settingsDesc' },
]

const TOTAL_STEPS = 3

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [fontScale, setFontScale] = useState(1.0)
  const [grantError, setGrantError] = useState('')

  const grantPermissions = async () => {
    try {
      setGrantError('')
      await window.usan?.permissions.grant({ scope: 'all', confirmAll: true })
      setStep(1)
    } catch {
      setGrantError(t('onboarding.permissionGrantError'))
    }
  }

  const updateFontScale = (val: number) => {
    setFontScale(val)
    document.documentElement.style.setProperty('--font-scale', String(val))
    window.usan?.settings.set({ fontScale: val })
  }

  return (
    <div className="flex items-center justify-center h-full bg-[var(--color-bg)] py-8">
      <div className="max-w-md w-full mx-6">
        {/* Step 0: Welcome + Permissions */}
        {step === 0 && (
          <div className="animate-in">
            <div className="text-center mb-8">
              <div className="mb-4">
                <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--color-primary)] mx-auto flex items-center justify-center shadow-[var(--shadow-md)]">
                  <Umbrella size={32} className="text-[var(--color-text-inverse)]" />
                </div>
              </div>
              <h1 className="font-semibold text-[var(--color-text)] mb-1 text-[length:var(--text-xl)]">
                {t('onboarding.welcome')}
              </h1>
              <p className="text-[length:var(--text-md)]">
                {t('onboarding.iAmUsanPrefix')}<strong className="text-[var(--color-primary)]">{t('onboarding.iAmUsanName')}</strong>{t('onboarding.iAmUsanSuffix')}
              </p>
            </div>

            <Card variant="elevated" padding="none" className="mb-6">
              <div className="px-4 py-3 border-b border-[var(--color-border)]">
                <p className="text-[var(--color-text-muted)] font-medium text-[length:var(--text-md)]">
                  {t('onboarding.permissionNeeded')}
                </p>
              </div>
              {PERMISSION_ITEMS.map((item, i) => {
                const Icon = item.icon
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3 ${i < PERMISSION_ITEMS.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
                  >
                    <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-[var(--color-primary)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--color-text)] text-[length:var(--text-md)]">
                        {t(item.labelKey)}
                      </div>
                      <div className="text-[var(--color-text-muted)] text-[length:var(--text-sm)]">
                        {t(item.descKey)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </Card>

            <Button size="lg" className="w-full h-14" onClick={grantPermissions}>
              {t('onboarding.agreeAll')}
            </Button>

            {grantError && (
              <p className="mt-3 text-center text-[var(--color-danger)] text-[length:var(--text-sm)]">
                {grantError}
              </p>
            )}

            <p className="mt-4 text-center text-[var(--color-text-muted)] text-[length:var(--text-sm)]">
              {t('onboarding.privacyNote')}
            </p>
          </div>
        )}

        {/* Step 1: Font Size */}
        {step === 1 && (
          <div className="animate-in">
            <div className="text-center mb-8">
              <div className="mb-4">
                <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)] mx-auto flex items-center justify-center">
                  <Type size={32} className="text-[var(--color-primary)]" />
                </div>
              </div>
              <h2 className="font-semibold text-[var(--color-text)] mb-1 text-[length:var(--text-xl)]">
                {t('onboarding.fontTitle')}
              </h2>
              <p className="text-[var(--color-text-muted)] text-[length:var(--text-md)]">
                {t('onboarding.fontHint')}
              </p>
            </div>

            <Card variant="elevated" className="mb-6">
              <p className="text-[var(--color-text)] text-[length:var(--text-md)]" style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                {t('onboarding.fontPreview')}
              </p>
            </Card>

            <div className="flex items-center gap-4 mb-8 px-2">
              <span className="text-[var(--color-text-muted)] text-[length:var(--text-md)]">가</span>
              <input
                type="range"
                min={1}
                max={2}
                step={0.1}
                value={fontScale}
                onChange={(e) => updateFontScale(parseFloat(e.target.value))}
                className="flex-1 h-2 accent-[var(--color-primary)] cursor-pointer"
                style={{ minHeight: '48px' }}
                aria-label={t('onboarding.fontTitle')}
                aria-valuetext={`${Math.round(fontScale * 100)}%`}
              />
              <span className="text-[var(--color-text)] text-[length:var(--text-2xl)]">가</span>
            </div>

            <Button size="lg" className="w-full h-14" rightIcon={<ChevronRight size={20} />} onClick={() => setStep(2)}>
              {t('onboarding.next')}
            </Button>
          </div>
        )}

        {/* Step 2: Ready */}
        {step === 2 && (
          <div className="animate-in">
            <div className="text-center mb-8">
              <div className="mb-4">
                <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)] mx-auto flex items-center justify-center">
                  <Sparkles size={32} className="text-[var(--color-primary)]" />
                </div>
              </div>
              <h2 className="font-semibold text-[var(--color-text)] mb-1 text-[length:var(--text-xl)]">
                {t('onboarding.readyTitle')}
              </h2>
              <p className="text-[var(--color-text-muted)] text-[length:var(--text-md)]" style={{ whiteSpace: 'pre-line' }}>
                {t('onboarding.readyDesc')}
              </p>
            </div>

            <Card variant="elevated" className="mb-6">
              <p className="font-medium text-[var(--color-text)] mb-3 text-[length:var(--text-md)]">
                {t('onboarding.readyHint')}
              </p>
              <ul className="flex flex-col gap-3">
                {[
                  { icon: Monitor, textKey: 'onboarding.example.screen' },
                  { icon: FolderOpen, textKey: 'onboarding.example.files' },
                  { icon: Globe, textKey: 'onboarding.example.weather' },
                  { icon: MessageCircle, textKey: 'onboarding.example.letter' },
                ].map((item, i) => {
                  const Icon = item.icon
                  return (
                    <li key={i} className="flex items-center gap-3 text-[var(--color-text-muted)] text-[length:var(--text-md)]">
                      <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] flex items-center justify-center shrink-0">
                        <Icon size={16} className="text-[var(--color-primary)]" />
                      </div>
                      {t(item.textKey)}
                    </li>
                  )
                })}
              </ul>
            </Card>

            <Button size="lg" className="w-full h-14 text-[length:var(--text-lg)]" onClick={onComplete}>
              {t('onboarding.start')}
            </Button>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'bg-[var(--color-primary)] w-6' : 'bg-[var(--color-border)] w-2'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
