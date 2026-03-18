import { describe, expect, it } from 'vitest'

import { ko } from '../../src/renderer/src/i18n/locales/ko'
import { collectSupportPanelTranslationKeys } from './i18n-visible-helpers'

describe('korean locale coverage for support panels', () => {
  it('covers translation keys used in user-facing support panels', () => {
    const missing = collectSupportPanelTranslationKeys().filter((key) => !(key in ko))
    expect(missing).toEqual([])
  })
})
