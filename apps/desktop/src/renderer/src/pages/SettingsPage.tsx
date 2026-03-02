import { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  Type,
  Sun,
  Moon,
  Volume2,
  Cpu,
  Key,
  Palette,
  RefreshCw,
  Languages,
} from 'lucide-react'
import type { ModelInfo } from '@shared/types/ipc'
import { useSettingsStore } from '../stores/settings.store'
import { t } from '../i18n'
import type { Locale } from '../i18n'

export default function SettingsPage() {
  const { settings, update: updateStore } = useSettingsStore()
  const [cloudApiKey, setCloudApiKey] = useState('')
  const [apiKeyDirty, setApiKeyDirty] = useState(false)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [keyValidation, setKeyValidation] = useState<{ status: 'idle' | 'loading' | 'valid' | 'error'; message?: string }>({ status: 'idle' })

  const fontScale = settings.fontScale
  const highContrast = settings.highContrast
  const voiceEnabled = settings.voiceEnabled
  const voiceSpeed = settings.voiceSpeed
  const theme = settings.theme as 'light' | 'dark' | 'system'

  const loadModels = useCallback(async () => {
    setLoadingModels(true)
    try {
      const list = await window.usan?.ai.models()
      if (list) setModels(list as ModelInfo[])
    } catch {
      // ignore
    }
    setLoadingModels(false)
  }, [])

  useEffect(() => {
    window.usan?.settings.get().then((s) => {
      setCloudApiKey(s.cloudApiKey ?? '')
    })
    loadModels()
  }, [loadModels])

  // Theme sync with useEffect cleanup (replaces __usanThemeCleanup global)
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark')
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      if (mq.matches) root.classList.add('dark')
      const handler = (e: MediaQueryListEvent) => {
        root.classList.toggle('dark', e.matches)
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const updateFontScale = (val: number) => {
    updateStore({ fontScale: val })
  }

  const toggleHighContrast = () => {
    const next = !highContrast
    document.documentElement.classList.toggle('high-contrast', next)
    updateStore({ highContrast: next })
  }

  const updateTheme = (newTheme: 'light' | 'dark' | 'system') => {
    updateStore({ theme: newTheme })
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center gap-3 mb-8">
        <Settings size={32} className="text-[var(--color-primary)]" />
        <h1 className="font-bold" style={{ fontSize: 'var(--font-size-xl)' }}>
          {t('settings.title')}
        </h1>
      </div>

      <div className="flex flex-col gap-6">
        {/* Language */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Languages size={24} className="text-[var(--color-primary)]" />
            <h2 className="font-semibold" style={{ fontSize: 'var(--font-size-lg)' }}>
              {t('settings.language')}
            </h2>
          </div>
          <p className="text-[var(--color-text-muted)] mb-4" style={{ fontSize: 'var(--font-size-sm)' }}>
            {t('settings.languageHint')}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { id: 'ko' as Locale, label: '한국어' },
              { id: 'en' as Locale, label: 'English' },
              { id: 'ja' as Locale, label: '日本語' },
            ]).map((lang) => {
              const isActive = settings.locale === lang.id
              return (
                <button
                  key={lang.id}
                  onClick={() => updateStore({ locale: lang.id })}
                  className={`flex items-center justify-center gap-2 p-4 rounded-xl transition-all ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-sidebar)]'
                  }`}
                  style={{ minHeight: 'var(--min-target)' }}
                >
                  <span className="font-medium" style={{ fontSize: 'var(--font-size-sm)' }}>
                    {lang.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Font Size */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Type size={24} className="text-[var(--color-primary)]" />
            <h2 className="font-semibold" style={{ fontSize: 'var(--font-size-lg)' }}>
              {t('settings.fontSize')}
            </h2>
          </div>
          <p className="text-[var(--color-text-muted)] mb-4" style={{ fontSize: 'var(--font-size-sm)' }}>
            {t('settings.fontSizeHint')}
          </p>
          <div className="flex items-center gap-4">
            <span style={{ fontSize: 'calc(14px * var(--font-scale))' }}>{t('settings.fontSizeSmall')}</span>
            <input
              type="range"
              min={1}
              max={2}
              step={0.1}
              value={fontScale}
              onChange={(e) => updateFontScale(parseFloat(e.target.value))}
              className="flex-1 h-3 accent-[var(--color-primary)] cursor-pointer"
              style={{ minHeight: '56px' }}
            />
            <span style={{ fontSize: 'calc(28px * var(--font-scale))' }}>{t('settings.fontSizeLarge')}</span>
          </div>
          <div
            className="mt-3 text-center text-[var(--color-text-muted)]"
            style={{ fontSize: 'var(--font-size-sm)' }}
          >
            {t('settings.fontSizeCurrent')}: {Math.round(fontScale * 100)}%
          </div>
        </div>

        {/* Theme */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Palette size={24} className="text-[var(--color-primary)]" />
            <h2 className="font-semibold" style={{ fontSize: 'var(--font-size-lg)' }}>
              {t('settings.theme')}
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { id: 'light' as const, label: t('settings.themeLight'), icon: Sun },
                { id: 'dark' as const, label: t('settings.themeDark'), icon: Moon },
                { id: 'system' as const, label: t('settings.themeSystem'), icon: Settings },
              ]
            ).map((item) => {
              const Icon = item.icon
              const isActive = theme === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => updateTheme(item.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-sidebar)]'
                  }`}
                  style={{ minHeight: 'var(--min-target)' }}
                >
                  <Icon size={24} />
                  <span className="font-medium" style={{ fontSize: 'var(--font-size-sm)' }}>
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* High Contrast */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {highContrast ? (
                <Moon size={24} className="text-[var(--color-primary)]" />
              ) : (
                <Sun size={24} className="text-[var(--color-primary)]" />
              )}
              <div>
                <h2 className="font-semibold" style={{ fontSize: 'var(--font-size-lg)' }}>
                  {t('settings.highContrast')}
                </h2>
                <p className="text-[var(--color-text-muted)]" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {t('settings.highContrastHint')}
                </p>
              </div>
            </div>
            <button
              onClick={toggleHighContrast}
              className={`w-16 h-9 rounded-full transition-all relative ${
                highContrast ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
              }`}
              style={{ minHeight: '56px' }}
              role="switch"
              aria-checked={highContrast}
            >
              <span
                className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-transform ${
                  highContrast ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Voice */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Volume2 size={24} className="text-[var(--color-primary)]" />
            <h2 className="font-semibold" style={{ fontSize: 'var(--font-size-lg)' }}>
              {t('settings.voice')}
            </h2>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span style={{ fontSize: 'var(--font-size-sm)' }}>{t('settings.voiceReadAloud')}</span>
            <button
              onClick={() => {
                updateStore({ voiceEnabled: !voiceEnabled })
              }}
              className={`w-16 h-9 rounded-full transition-all relative ${
                voiceEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
              }`}
              style={{ minHeight: '56px' }}
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
          <p className="text-[var(--color-text-muted)] mb-2" style={{ fontSize: 'var(--font-size-sm)' }}>
            {t('settings.voiceSpeed')}
          </p>
          <div className="flex items-center gap-4">
            <span style={{ fontSize: 'var(--font-size-sm)' }}>{t('settings.voiceSlow')}</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={voiceSpeed}
              onChange={(e) => {
                updateStore({ voiceSpeed: parseFloat(e.target.value) })
              }}
              className="flex-1 h-3 accent-[var(--color-primary)] cursor-pointer"
              style={{ minHeight: '56px' }}
            />
            <span style={{ fontSize: 'var(--font-size-sm)' }}>{t('settings.voiceFast')}</span>
          </div>
        </div>

        {/* AI Models */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Cpu size={24} className="text-[var(--color-primary)]" />
              <h2 className="font-semibold" style={{ fontSize: 'var(--font-size-lg)' }}>
                {t('settings.aiModels')}
              </h2>
            </div>
            <button
              onClick={loadModels}
              disabled={loadingModels}
              className="p-2 rounded-lg hover:bg-[var(--color-bg-sidebar)] transition-all text-[var(--color-text-muted)]"
              aria-label={t('settings.refreshModels')}
            >
              <RefreshCw size={20} className={loadingModels ? 'animate-spin' : ''} />
            </button>
          </div>

          {models.length > 0 ? (
            <div className="flex flex-col gap-2">
              {models.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg)]"
                  style={{ minHeight: '56px' }}
                >
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>{m.name}</span>
                  <span
                    className="text-[var(--color-text-muted)]"
                    style={{ fontSize: 'calc(12px * var(--font-scale))' }}
                  >
                    {t('settings.provider')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="p-4 rounded-xl bg-[var(--color-bg)] text-center text-[var(--color-text-muted)]"
              style={{ fontSize: 'var(--font-size-sm)' }}
            >
              {loadingModels ? t('settings.loadingModels') : t('settings.noModels')}
            </div>
          )}
        </div>

        {/* API Key */}
        <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key size={24} className="text-[var(--color-primary)]" />
            <h2 className="font-semibold" style={{ fontSize: 'var(--font-size-lg)' }}>
              {t('settings.apiKey')}
            </h2>
          </div>
          <p className="text-[var(--color-text-muted)] mb-4" style={{ fontSize: 'var(--font-size-sm)' }}>
            {t('settings.apiKeyHint')}
          </p>

          <div>
            <label
              className="block mb-2 text-[var(--color-text-muted)]"
              style={{ fontSize: 'var(--font-size-sm)' }}
            >
              {t('settings.apiKeyLabel')}
            </label>
            <input
              type="password"
              value={cloudApiKey}
              onChange={(e) => {
                setCloudApiKey(e.target.value)
                setApiKeyDirty(true)
                setKeyValidation({ status: 'idle' })
              }}
              onBlur={() => {
                if (apiKeyDirty && cloudApiKey) {
                  updateStore({ cloudApiKey })
                  setApiKeyDirty(false)
                }
              }}
              placeholder="sk-or-..."
              className="w-full h-14 px-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] transition-all"
              style={{ fontSize: 'var(--font-size-sm)' }}
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={async () => {
                  const key = cloudApiKey.replace(/•/g, '')
                  if (!key || key === '••••••••') {
                    setKeyValidation({ status: 'error', message: t('settings.apiKeyEmpty') })
                    return
                  }
                  // Save dirty key before validating
                  if (apiKeyDirty) {
                    updateStore({ cloudApiKey })
                    setApiKeyDirty(false)
                  }
                  setKeyValidation({ status: 'loading' })
                  try {
                    const result = await window.usan?.aiExtras.validateKey(key)
                    if (result?.valid) {
                      setKeyValidation({ status: 'valid', message: t('settings.keyValid') })
                    } else {
                      setKeyValidation({ status: 'error', message: result?.error ?? t('settings.apiKeyInvalid') })
                    }
                  } catch {
                    setKeyValidation({ status: 'error', message: t('settings.apiKeyCheckError') })
                  }
                }}
                disabled={keyValidation.status === 'loading'}
                className="px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                style={{ fontSize: 'var(--font-size-sm)', minHeight: '56px' }}
              >
                {keyValidation.status === 'loading' ? t('settings.validating') : t('settings.validateKey')}
              </button>
              {keyValidation.status === 'valid' && (
                <span className="text-green-600 font-medium" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {keyValidation.message}
                </span>
              )}
              {keyValidation.status === 'error' && (
                <span className="text-red-500 font-medium" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {keyValidation.message}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
