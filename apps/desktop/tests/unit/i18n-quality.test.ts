import { describe, expect, it } from 'vitest'

import { isLikelyCorruptedTranslation, setLocale, t } from '../../src/renderer/src/i18n'
import { en } from '../../src/renderer/src/i18n/locales/en'
import { ja } from '../../src/renderer/src/i18n/locales/ja'
import { ko } from '../../src/renderer/src/i18n/locales/ko'
import { collectSupportPanelTranslationKeys, collectVisibleTranslationKeys } from './i18n-visible-helpers'

const USER_FACING_KEYS = [...new Set([
  ...collectVisibleTranslationKeys(),
  ...collectSupportPanelTranslationKeys(),
])].sort()

describe('i18n translation quality', () => {
  it('does not resolve corrupted visible strings in Korean', () => {
    setLocale('ko')
    const bad = USER_FACING_KEYS.filter((key) => isLikelyCorruptedTranslation(t(key)))
    expect(bad).toEqual([])
  })

  it('does not resolve corrupted visible strings in Japanese', () => {
    setLocale('ja')
    const bad = USER_FACING_KEYS.filter((key) => isLikelyCorruptedTranslation(t(key)))
    expect(bad).toEqual([])
  })

  it('keeps core Korean UI labels in Korean instead of falling back to English', () => {
    setLocale('ko')
    for (const key of ['home.send', 'account.title', 'notes.title', 'knowledge.helpTitle', 'mcp.title'] as const) {
      expect(t(key)).toBe(ko[key])
      expect(t(key)).not.toBe(en[key])
    }
  })

  it('keeps core Japanese UI labels in Japanese for common actions', () => {
    setLocale('ja')
    for (const key of ['nav.home', 'titlebar.close', 'tools.run', 'appLauncher.close', 'mcp.title'] as const) {
      expect(t(key)).toBe(ja[key])
      expect(t(key)).not.toBe(en[key])
    }
  })

  it('keeps polished Korean labels and helper copy for critical settings', () => {
    setLocale('ko')
    expect(t('titlebar.close')).toBe('\ub2eb\uae30')
    expect(t('home.voiceStart')).toBe('\ub9d0\ud558\uae30')
    expect(t('home.voiceStop')).toBe('\uc911\uc9c0')
    expect(t('settings.themeLight')).toBe('\ubc1d\uac8c')
    expect(t('settings.themeDark')).toBe('\uc5b4\ub461\uac8c')
    expect(t('settings.themeSystem')).toBe('\uc2dc\uc2a4\ud15c \uc124\uc815')
    expect(t('settings.developerGroupDiagnosticsHint')).not.toContain('This area is only')
  })

  it('keeps polished Japanese labels and helper copy for critical settings', () => {
    setLocale('ja')
    expect(t('titlebar.close')).toBe('\u9589\u3058\u308b')
    expect(t('notes.title')).toBe('\u30e1\u30e2')
    expect(t('settings.themeDark')).toBe('\u30c0\u30fc\u30af')
    expect(t('settings.themeSystem')).toBe('\u30b7\u30b9\u30c6\u30e0\u8a2d\u5b9a')
    expect(t('settings.passwordImportHint')).not.toContain('You can also import')
  })

  it('keeps simplified developer and marketplace terms readable in Korean', () => {
    setLocale('ko')
    expect(t('settings.developerGroupDiagnostics')).toBe('\uc571 \ud655\uc778')
    expect(t('settings.aiModels')).toBe('\uc0ac\uc6a9 \uac00\ub2a5\ud55c AI \ubaa8\ub378')
    expect(t('settings.permissionProfile')).toBe('Usan\uc774 \uc4f8 \uc218 \uc788\ub294 \uc870\uc791 \ubc94\uc704')
    expect(t('marketplace.title')).toBe('\ucd94\uac00 \ub3c4\uad6c')
    expect(t('marketplace.author')).toBe('\ub9cc\ub4e0 \uacf3')
    expect(t('knowledge.result.keywordScore')).toBe('\ub2e8\uc5b4\uac00 \ub9de\ub294 \uc815\ub3c4')
  })

  it('keeps simplified developer and marketplace terms readable in Japanese', () => {
    setLocale('ja')
    expect(t('settings.developerGroupDiagnostics')).toBe('\u30a2\u30d7\u30ea\u78ba\u8a8d')
    expect(t('settings.aiModels')).toBe('\u5229\u7528\u3067\u304d\u308b AI \u30e2\u30c7\u30eb')
    expect(t('settings.permissionProfile')).toBe('Usan\u306b\u8a31\u3059\u64cd\u4f5c\u306e\u5e83\u3055')
    expect(t('marketplace.title')).toBe('\u8ffd\u52a0\u30c4\u30fc\u30eb')
    expect(t('marketplace.author')).toBe('\u4f5c\u3063\u305f\u4eba')
    expect(t('knowledge.result.keywordScore')).toBe('\u8a00\u8449\u306e\u4e00\u81f4')
  })
})
