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
  Mic,
  Camera,
  CheckCircle,
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

const FEATURE_ITEMS = [
  { icon: MessageCircle, title: '채팅으로 뭐든 부탁', desc: '궁금한 것, 해야 할 일을 말하면 도와드려요' },
  { icon: Mic, title: '말로 편하게', desc: '타이핑 대신 마이크 버튼을 눌러 말해보세요' },
  { icon: Camera, title: '화면을 보고 도움', desc: '화면에 오류가 있으면 캡처해서 물어보세요' },
]

const TOTAL_STEPS = 5

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [fontScale, setFontScale] = useState(1.0)
  const [grantError, setGrantError] = useState('')
  const [micTested, setMicTested] = useState(false)

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

  const testMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setMicTested(true)
    } catch {
      setMicTested(false)
    }
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

        {/* Step 1: Feature Introduction (NEW) */}
        {step === 1 && (
          <div className="animate-in">
            <div className="text-center mb-8">
              <div className="mb-4">
                <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)] mx-auto flex items-center justify-center">
                  <Sparkles size={32} className="text-[var(--color-primary)]" />
                </div>
              </div>
              <h2 className="font-semibold text-[var(--color-text)] mb-1 text-[length:var(--text-xl)]">
                이런 일들을 도와드려요
              </h2>
              <p className="text-[var(--color-text-muted)] text-[length:var(--text-md)]">
                우산이 할 수 있는 핵심 기능이에요
              </p>
            </div>

            <div className="flex flex-col gap-3 mb-8">
              {FEATURE_ITEMS.map((item, i) => {
                const Icon = item.icon
                return (
                  <Card key={i}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
                        <Icon size={24} className="text-[var(--color-primary)]" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--color-text)] text-[length:var(--text-md)]">
                          {item.title}
                        </div>
                        <div className="text-[var(--color-text-muted)] text-[length:var(--text-sm)]">
                          {item.desc}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            <Button size="lg" className="w-full h-14" rightIcon={<ChevronRight size={20} />} onClick={() => setStep(2)}>
              {t('onboarding.next')}
            </Button>
          </div>
        )}

        {/* Step 2: Font Size */}
        {step === 2 && (
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

            <Button size="lg" className="w-full h-14" rightIcon={<ChevronRight size={20} />} onClick={() => setStep(3)}>
              {t('onboarding.next')}
            </Button>
          </div>
        )}

        {/* Step 3: Microphone Test (NEW) */}
        {step === 3 && (
          <div className="animate-in">
            <div className="text-center mb-8">
              <div className="mb-4">
                <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)] mx-auto flex items-center justify-center">
                  <Mic size={32} className="text-[var(--color-primary)]" />
                </div>
              </div>
              <h2 className="font-semibold text-[var(--color-text)] mb-1 text-[length:var(--text-xl)]">
                마이크 테스트
              </h2>
              <p className="text-[var(--color-text-muted)] text-[length:var(--text-md)]">
                음성으로 말하려면 마이크가 필요해요
              </p>
            </div>

            <Card variant="elevated" className="mb-6">
              <div className="flex flex-col items-center gap-4 py-4">
                {micTested ? (
                  <>
                    <CheckCircle size={48} className="text-[var(--color-success)]" />
                    <p className="text-[var(--color-text)] text-[length:var(--text-md)] font-medium">
                      마이크가 잘 작동해요!
                    </p>
                  </>
                ) : (
                  <>
                    <button
                      onClick={testMicrophone}
                      className="w-20 h-20 rounded-full bg-[var(--color-primary)] flex items-center justify-center shadow-[var(--shadow-md)] hover:bg-[var(--color-primary-hover)] transition-colors active:scale-95"
                    >
                      <Mic size={32} className="text-[var(--color-text-inverse)]" />
                    </button>
                    <p className="text-[var(--color-text-muted)] text-[length:var(--text-md)]">
                      위 버튼을 눌러 마이크를 테스트하세요
                    </p>
                  </>
                )}
              </div>
            </Card>

            <Button size="lg" className="w-full h-14" rightIcon={<ChevronRight size={20} />} onClick={() => setStep(4)}>
              {micTested ? t('onboarding.next') : '건너뛰기'}
            </Button>
          </div>
        )}

        {/* Step 4: Ready */}
        {step === 4 && (
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
