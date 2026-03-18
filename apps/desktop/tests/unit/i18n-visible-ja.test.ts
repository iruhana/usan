import { describe, expect, it } from 'vitest'

import { ja } from '../../src/renderer/src/i18n/locales/ja'
import { collectVisibleTranslationKeys } from './i18n-visible-helpers'

describe('japanese locale coverage for visible UI', () => {
  it('covers all translation keys used on the main visible screens', () => {
    const missing = collectVisibleTranslationKeys().filter((key) => !(key in ja))
    expect(missing).toEqual([])
  })
})
