import { describe, expect, it } from 'vitest'

import { ko } from '../../src/renderer/src/i18n/locales/ko'
import { collectVisibleTranslationKeys } from './i18n-visible-helpers'

describe('korean locale coverage for visible UI', () => {
  it('covers all translation keys used on the main visible screens', () => {
    const missing = collectVisibleTranslationKeys().filter((key) => !(key in ko))
    expect(missing).toEqual([])
  })
})
