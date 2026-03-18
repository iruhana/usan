import { Cpu, Moon, Palette, Settings as SettingsIcon, Sun, Volume2 } from 'lucide-react'
import type { Locale } from '../../i18n'
import { t } from '../../i18n'
import {
  SettingsRow,
  SettingsSectionCard,
  SettingsSegmentedControl,
  SettingsSwitch,
} from './SettingsPrimitives'

const LANGUAGES: Array<{ id: Locale; labelKey: string }> = [
  { id: 'ko', labelKey: 'settings.languageOptionKo' },
  { id: 'en', labelKey: 'settings.languageOptionEn' },
  { id: 'ja', labelKey: 'settings.languageOptionJa' },
]

interface GeneralSettingsSectionProps {
  locale: Locale
  theme: 'light' | 'dark' | 'system'
  fontScale: number
  fontScaleId: string
  voiceEnabled: boolean
  voiceOverlayEnabled: boolean
  voiceSpeed: number
  voiceSpeedId: string
  highContrast: boolean
  enterToSend: boolean
  openAtLogin: boolean
  advancedMenusEnabled: boolean
  onLocaleChange: (locale: Locale) => void
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void
  onFontScaleChange: (value: number) => void
  onToggleHighContrast: () => void
  onToggleEnterToSend: () => void
  onToggleVoiceEnabled: () => void
  onToggleVoiceOverlay: () => void
  onVoiceSpeedChange: (value: number) => void
  onToggleOpenAtLogin: () => void
  onToggleAdvancedMenus: () => void
}

export default function GeneralSettingsSection({
  locale,
  theme,
  fontScale,
  fontScaleId,
  voiceEnabled,
  voiceOverlayEnabled,
  voiceSpeed,
  voiceSpeedId,
  highContrast,
  enterToSend,
  openAtLogin,
  advancedMenusEnabled,
  onLocaleChange,
  onThemeChange,
  onFontScaleChange,
  onToggleHighContrast,
  onToggleEnterToSend,
  onToggleVoiceEnabled,
  onToggleVoiceOverlay,
  onVoiceSpeedChange,
  onToggleOpenAtLogin,
  onToggleAdvancedMenus,
}: GeneralSettingsSectionProps) {
  return (
    <div className="space-y-4">
      <SettingsSectionCard
        cardId="appearance"
        icon={Palette}
        title={t('settings.card.appearance')}
        description={t('settings.card.appearanceDesc')}
      >
        <SettingsRow title={t('settings.language')} description={t('settings.languageHint')}>
          <SettingsSegmentedControl
            columns={3}
            value={locale}
            onChange={(id) => onLocaleChange(id as Locale)}
            options={LANGUAGES.map((lang) => ({ id: lang.id, label: t(lang.labelKey) }))}
          />
        </SettingsRow>

        <SettingsRow title={t('settings.fontSize')} description={t('settings.fontSizeHint')}>
          <div className="space-y-3 rounded-[16px] bg-[var(--color-surface-soft)]/72 px-4 py-4">
            <div className="flex items-center justify-between text-[12px] font-medium text-[var(--color-text-secondary)]">
              <span>{t('settings.fontSizeSmall')}</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[var(--color-text)] shadow-[var(--shadow-xs)]">
                {Math.round(fontScale * 100)}%
              </span>
              <span>{t('settings.fontSizeLarge')}</span>
            </div>
            <input
              id={fontScaleId}
              type="range"
              min={1}
              max={2}
              step={0.1}
              value={fontScale}
              onChange={(event) => onFontScaleChange(parseFloat(event.target.value))}
              className="h-2 w-full cursor-pointer rounded-full accent-[var(--color-primary)]"
              style={{ minHeight: '36px' }}
              aria-label={t('settings.fontSize')}
            />
          </div>
        </SettingsRow>

        <SettingsRow title={t('settings.theme')} description={t('settings.card.themeDesc')}>
          <SettingsSegmentedControl
            columns={3}
            value={theme}
            onChange={(id) => onThemeChange(id as 'light' | 'dark' | 'system')}
            options={[
              { id: 'light', label: t('settings.themeLight'), icon: Sun },
              { id: 'dark', label: t('settings.themeDark'), icon: Moon },
              { id: 'system', label: t('settings.themeSystem'), icon: SettingsIcon },
            ]}
          />
        </SettingsRow>

        <SettingsRow title={t('settings.highContrast')} description={t('settings.highContrastHint')}>
          <div className="flex justify-end">
            <SettingsSwitch
              checked={highContrast}
              onClick={onToggleHighContrast}
              ariaLabel={t('settings.highContrast')}
            />
          </div>
        </SettingsRow>
      </SettingsSectionCard>

      <SettingsSectionCard
        cardId="conversation"
        icon={SettingsIcon}
        title={t('settings.card.conversation')}
        description={t('settings.card.conversationDesc')}
      >
        <SettingsRow
          title={t('settings.enterToSendTitle')}
          description={enterToSend ? t('settings.enterToSendOnHint') : t('settings.enterToSendOffHint')}
        >
          <div className="flex justify-end">
            <SettingsSwitch
              checked={enterToSend}
              onClick={onToggleEnterToSend}
              ariaLabel={t('settings.enterToSendTitle')}
            />
          </div>
        </SettingsRow>
      </SettingsSectionCard>

      <SettingsSectionCard
        cardId="voice"
        icon={Volume2}
        title={t('settings.card.voice')}
        description={t('settings.card.voiceDesc')}
      >
        <SettingsRow title={t('settings.voiceReadAloud')} description={t('settings.voice')}>
          <div className="flex justify-end">
            <SettingsSwitch
              checked={voiceEnabled}
              onClick={onToggleVoiceEnabled}
              ariaLabel={t('settings.voiceReadAloud')}
            />
          </div>
        </SettingsRow>

        <SettingsRow
          title={t('settings.voiceOverlayTitle')}
          description={voiceOverlayEnabled ? t('settings.voiceOverlayHintOn') : t('settings.voiceOverlayHintOff')}
        >
          <div className="flex justify-end">
            <SettingsSwitch
              checked={voiceOverlayEnabled}
              onClick={onToggleVoiceOverlay}
              ariaLabel={t('settings.voiceOverlayTitle')}
            />
          </div>
        </SettingsRow>

        <SettingsRow title={t('settings.voiceSpeed')} description={t('settings.card.voiceSpeedDesc')}>
          <div className="space-y-3 rounded-[16px] bg-[var(--color-surface-soft)]/72 px-4 py-4">
            <div className="flex items-center justify-between text-[12px] font-medium text-[var(--color-text-secondary)]">
              <span>{t('settings.voiceSlow')}</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[var(--color-text)] shadow-[var(--shadow-xs)]">
                {voiceSpeed.toFixed(1)}x
              </span>
              <span>{t('settings.voiceFast')}</span>
            </div>
            <input
              id={voiceSpeedId}
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={voiceSpeed}
              onChange={(event) => onVoiceSpeedChange(parseFloat(event.target.value))}
              className="h-2 w-full cursor-pointer rounded-full accent-[var(--color-primary)]"
              style={{ minHeight: '36px' }}
              aria-label={t('settings.voiceSpeed')}
            />
          </div>
        </SettingsRow>
      </SettingsSectionCard>

      <SettingsSectionCard
        cardId="desktop-behavior"
        icon={Cpu}
        title={t('settings.card.desktop')}
        description={t('settings.card.desktopDesc')}
      >
        <SettingsRow title={t('settings.autoStart')} description={t('settings.autoStartHint')}>
          <div className="flex justify-end">
            <SettingsSwitch
              checked={openAtLogin}
              onClick={onToggleOpenAtLogin}
              ariaLabel={t('settings.autoStart')}
            />
          </div>
        </SettingsRow>

        <SettingsRow
          title={t('settings.advancedMenusTitle')}
          description={advancedMenusEnabled ? t('settings.advancedMenusHintOn') : t('settings.advancedMenusHintOff')}
        >
          <div className="flex justify-end">
            <SettingsSwitch
              checked={advancedMenusEnabled}
              onClick={onToggleAdvancedMenus}
              ariaLabel={t('settings.advancedMenusTitle')}
            />
          </div>
        </SettingsRow>
      </SettingsSectionCard>
    </div>
  )
}
