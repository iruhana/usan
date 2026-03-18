import { describe, expect, it } from 'vitest'

import registry from '../../src/renderer/src/data/app-registry.json'
import { en } from '../../src/renderer/src/i18n/locales/en'
import { ko } from '../../src/renderer/src/i18n/locales/ko'
import { ja } from '../../src/renderer/src/i18n/locales/ja'

describe('app registry label localization', () => {
  it('has label keys in english, korean, and japanese locales', () => {
    const missing = (registry as Array<{ labelKey: string }>).flatMap(({ labelKey }) => {
      const absent = [] as string[]
      if (!(labelKey in en)) absent.push(`en:${labelKey}`)
      if (!(labelKey in ko)) absent.push(`ko:${labelKey}`)
      if (!(labelKey in ja)) absent.push(`ja:${labelKey}`)
      return absent
    })

    expect(missing).toEqual([])
  })
})
