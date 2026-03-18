import { afterEach, describe, expect, it } from 'vitest'

import { getLocale, isLikelyCorruptedTranslation, setLocale, t } from '../../src/renderer/src/i18n'
import { en } from '../../src/renderer/src/i18n/locales/en'
import { ko } from '../../src/renderer/src/i18n/locales/ko'
import { ja } from '../../src/renderer/src/i18n/locales/ja'

describe('i18n runtime fallback', () => {
  const initialLocale = getLocale()

  afterEach(() => {
    setLocale(initialLocale)
  })

  it('returns locale override when the current locale provides one', () => {
    setLocale('ko')
    expect(t('account.invalidCredentials')).toBe(ko['account.invalidCredentials'])
  })

  it('falls back to english when the localized value is corrupted', () => {
    setLocale('ko')
    const original = ko['app.loading']
    ;(ko as Record<string, string>)['app.loading'] = '??'
    expect(isLikelyCorruptedTranslation(ko['app.loading'])).toBe(true)
    expect(t('app.loading')).toBe(en['app.loading'])
    ;(ko as Record<string, string>)['app.loading'] = original
  })

  it('uses japanese overrides without copying the english dictionary', () => {
    setLocale('ja')
    expect(t('files.noticePreviewTitle')).toBe(ja['files.noticePreviewTitle'])
  })

  it('returns the key itself when no locale contains it', () => {
    setLocale('en')
    expect(t('missing.test.key')).toBe('missing.test.key')
  })
})
