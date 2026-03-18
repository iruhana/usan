import { describe, expect, it } from 'vitest'

import { ja } from '../../src/renderer/src/i18n/locales/ja'
import { collectSupportPanelTranslationKeys } from './i18n-visible-helpers'

describe('japanese locale coverage for support panels', () => {
  it('covers translation keys used in user-facing support panels', () => {
    const missing = collectSupportPanelTranslationKeys().filter((key) => !(key in ja))
    expect(missing).toEqual([])
  })
})
