import { useState, useRef, useEffect } from 'react'
import {
  Monitor,
  FolderOpen,
  AppWindow,
  MousePointer2,
  Globe,
  Settings,
  ChevronRight,
  Check,
  Mic,
  Volume2,
  Play,
  Square,
  MessageCircle,
} from 'lucide-react'
import { t, getSpeechLang } from '../../i18n'

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

const TOTAL_STEPS = 4

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [fontScale, setFontScale] = useState(1.0)
  const [voiceSpeed, setVoiceSpeed] = useState(1.0)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [micTested, setMicTested] = useState(false)
  const [ttsTesting, setTtsTesting] = useState(false)
  const [micListening, setMicListening] = useState(false)
  const [micResult, setMicResult] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  const grantPermissions = async () => {
    try {
      await window.usan?.permissions.grant()
    } catch {
      // Dev mode — skip
    }
    setStep(1)
  }

  const updateFontScale = (val: number) => {
    setFontScale(val)
    document.documentElement.style.setProperty('--font-scale', String(val))
    window.usan?.settings.set({ fontScale: val })
  }

  const testTTS = () => {
    if (ttsTesting) {
      speechSynthesis.cancel()
      setTtsTesting(false)
      return
    }
    setTtsTesting(true)
    const utterance = new SpeechSynthesisUtterance(
      t('onboarding.ttsTestSentence')
    )
    utterance.lang = getSpeechLang()
    utterance.rate = voiceSpeed
    utterance.onend = () => setTtsTesting(false)
    utterance.onerror = () => setTtsTesting(false)
    speechSynthesis.speak(utterance)
  }

  const testMic = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setMicResult(t('onboarding.micNotSupported'))
      return
    }

    if (micListening) {
      recognitionRef.current?.stop()
      setMicListening(false)
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = getSpeechLang()
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript
      setMicResult(text)
      setMicTested(true)
      setMicListening(false)
    }
    recognition.onerror = () => {
      setMicResult(t('onboarding.micFailed'))
      setMicListening(false)
    }
    recognition.onend = () => setMicListening(false)

    setMicResult('')
    setMicListening(true)
    recognition.start()
  }

  const finishOnboarding = () => {
    window.usan?.settings.set({ voiceSpeed, voiceEnabled })
    onComplete()
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[var(--color-bg)]">
      <div className="max-w-lg w-full mx-4">
        {/* Step 0: Welcome + Permissions */}
        {step === 0 && (
          <div className="bg-[var(--color-bg-card)] rounded-3xl shadow-xl p-8 text-center">
            <div className="text-7xl mb-6">🤖</div>
            <h1 className="font-bold mb-2" style={{ fontSize: 'var(--font-size-xl)' }}>
              {t('onboarding.welcome')}
            </h1>
            <p className="mb-2" style={{ fontSize: 'var(--font-size-lg)' }}>
              {t('onboarding.iAmUsanPrefix')}<strong>{t('onboarding.iAmUsanName')}</strong>{t('onboarding.iAmUsanSuffix')}
            </p>
            <p className="text-[var(--color-text-muted)] mb-6" style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('onboarding.permissionNeeded')}
            </p>

            <div className="flex flex-col gap-3 mb-6 text-left">
              {PERMISSION_ITEMS.map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-primary-light)]">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-[var(--color-primary)]" />
                    </div>
                    <div>
                      <div className="font-medium" style={{ fontSize: 'var(--font-size-sm)' }}>
                        {t(item.labelKey)}
                      </div>
                      <div
                        className="text-[var(--color-text-muted)]"
                        style={{ fontSize: 'calc(13px * var(--font-scale))' }}
                      >
                        {t(item.descKey)}
                      </div>
                    </div>
                    <Check size={20} className="text-[var(--color-success)] ml-auto shrink-0" />
                  </div>
                )
              })}
            </div>

            <button
              onClick={grantPermissions}
              className="w-full h-16 rounded-2xl bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-all shadow-lg"
              style={{ fontSize: 'var(--font-size-lg)' }}
            >
              {t('onboarding.agreeAll')}
            </button>

            <p
              className="mt-4 text-[var(--color-text-muted)]"
              style={{ fontSize: 'calc(12px * var(--font-scale))' }}
            >
              {t('onboarding.privacyNote')}
            </p>
          </div>
        )}

        {/* Step 1: Font Size */}
        {step === 1 && (
          <div className="bg-[var(--color-bg-card)] rounded-3xl shadow-xl p-8 text-center">
            <div className="text-5xl mb-4">📏</div>
            <h2 className="font-bold mb-2" style={{ fontSize: 'var(--font-size-xl)' }}>
              {t('onboarding.fontTitle')}
            </h2>
            <p className="text-[var(--color-text-muted)] mb-8" style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('onboarding.fontHint')}
            </p>

            <div className="bg-[var(--color-primary-light)] rounded-2xl p-6 mb-6">
              <p style={{ fontSize: 'var(--font-size-base)', whiteSpace: 'pre-line' }}>
                {t('onboarding.fontPreview')}
              </p>
            </div>

            <div className="flex items-center gap-4 mb-8 px-4">
              <span style={{ fontSize: 'calc(16px * var(--font-scale))' }}>가</span>
              <input
                type="range"
                min={1}
                max={2}
                step={0.1}
                value={fontScale}
                onChange={(e) => updateFontScale(parseFloat(e.target.value))}
                className="flex-1 h-4 accent-[var(--color-primary)] cursor-pointer"
                style={{ minHeight: '56px' }}
              />
              <span style={{ fontSize: 'calc(32px * var(--font-scale))' }}>가</span>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full h-16 rounded-2xl bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2"
              style={{ fontSize: 'var(--font-size-lg)' }}
            >
              {t('onboarding.next')} <ChevronRight size={24} />
            </button>
          </div>
        )}

        {/* Step 2: Voice Settings */}
        {step === 2 && (
          <div className="bg-[var(--color-bg-card)] rounded-3xl shadow-xl p-8 text-center">
            <div className="text-5xl mb-4">🎙️</div>
            <h2 className="font-bold mb-2" style={{ fontSize: 'var(--font-size-xl)' }}>
              {t('onboarding.voiceTitle')}
            </h2>
            <p className="text-[var(--color-text-muted)] mb-6" style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('onboarding.voiceHint')}
            </p>

            {/* TTS test */}
            <div className="bg-[var(--color-primary-light)] rounded-2xl p-5 mb-4 text-left">
              <div className="flex items-center gap-3 mb-3">
                <Volume2 size={22} className="text-[var(--color-primary)]" />
                <span className="font-semibold" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {t('onboarding.voiceSpeedLabel')}
                </span>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <span style={{ fontSize: 'var(--font-size-sm)' }}>{t('settings.voiceSlow')}</span>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={voiceSpeed}
                  onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                  className="flex-1 h-3 accent-[var(--color-primary)] cursor-pointer"
                  style={{ minHeight: '56px' }}
                />
                <span style={{ fontSize: 'var(--font-size-sm)' }}>{t('settings.voiceFast')}</span>
              </div>
              <button
                onClick={testTTS}
                className={`w-full h-14 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  ttsTesting
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'bg-[var(--color-bg-card)] text-[var(--color-primary)] border border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]'
                }`}
                style={{ fontSize: 'var(--font-size-sm)' }}
              >
                {ttsTesting ? (
                  <>
                    <Square size={18} /> {t('onboarding.ttsStop')}
                  </>
                ) : (
                  <>
                    <Play size={18} /> {t('onboarding.ttsPlay')}
                  </>
                )}
              </button>
            </div>

            {/* Mic test */}
            <div className="bg-[var(--color-bg)] rounded-2xl p-5 mb-6 text-left">
              <div className="flex items-center gap-3 mb-3">
                <Mic size={22} className="text-[var(--color-success)]" />
                <span className="font-semibold" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {t('onboarding.micTitle')}
                </span>
              </div>
              <button
                onClick={testMic}
                className={`w-full h-14 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                  micListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-[var(--color-bg-card)] text-[var(--color-success)] border border-[var(--color-success)] hover:bg-[var(--color-bg)]'
                }`}
                style={{ fontSize: 'var(--font-size-sm)' }}
              >
                {micListening ? (
                  <>
                    <Mic size={18} /> {t('onboarding.micListening')}
                  </>
                ) : (
                  <>
                    <Mic size={18} /> {micTested ? t('onboarding.micRetry') : t('onboarding.micStart')}
                  </>
                )}
              </button>
              {micResult && (
                <div
                  className="mt-3 p-3 rounded-xl bg-[var(--color-bg-card)] text-center"
                  style={{ fontSize: 'var(--font-size-sm)' }}
                >
                  {micTested ? '✅' : '⚠️'} {micResult}
                </div>
              )}
            </div>

            {/* Voice enable toggle */}
            <div className="flex items-center justify-between bg-[var(--color-bg)] rounded-2xl p-4 mb-6">
              <span style={{ fontSize: 'var(--font-size-sm)' }}>{t('onboarding.voiceToggle')}</span>
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`w-16 h-9 rounded-full transition-all relative ${
                  voiceEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                }`}
                role="switch"
                aria-checked={voiceEnabled}
              >
                <span
                  className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-transform ${
                    voiceEnabled ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <button
              onClick={() => setStep(3)}
              className="w-full h-16 rounded-2xl bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2"
              style={{ fontSize: 'var(--font-size-lg)' }}
            >
              {t('onboarding.next')} <ChevronRight size={24} />
            </button>
          </div>
        )}

        {/* Step 3: First Chat (Ready) */}
        {step === 3 && (
          <div className="bg-[var(--color-bg-card)] rounded-3xl shadow-xl p-8 text-center">
            <div className="text-7xl mb-6">🎉</div>
            <h2 className="font-bold mb-2" style={{ fontSize: 'var(--font-size-xl)' }}>
              {t('onboarding.readyTitle')}
            </h2>
            <p className="text-[var(--color-text-muted)] mb-8" style={{ fontSize: 'var(--font-size-sm)', whiteSpace: 'pre-line' }}>
              {t('onboarding.readyDesc')}
            </p>

            <div className="bg-[var(--color-primary-light)] rounded-2xl p-6 mb-6 text-left">
              <p className="font-medium mb-3" style={{ fontSize: 'var(--font-size-sm)' }}>
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
                    <li key={i} className="flex items-center gap-3" style={{ fontSize: 'var(--font-size-sm)' }}>
                      <Icon size={18} className="text-[var(--color-primary)] shrink-0" />
                      {t(item.textKey)}
                    </li>
                  )
                })}
              </ul>
            </div>

            <button
              onClick={finishOnboarding}
              className="w-full h-16 rounded-2xl bg-[var(--color-primary)] text-white font-bold hover:bg-[var(--color-primary-hover)] transition-all"
              style={{ fontSize: 'var(--font-size-xl)' }}
            >
              {t('onboarding.start')}
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-3 rounded-full transition-all ${
                i === step ? 'bg-[var(--color-primary)] w-8' : 'bg-[var(--color-border)] w-3'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
