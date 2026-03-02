/**
 * Minimal i18n for the desktop app.
 * Supports ko, en, ja — locale files in ./locales/
 */

import { ko } from './locales/ko'
import { en } from './locales/en'
import { ja } from './locales/ja'

export type Locale = 'ko' | 'en' | 'ja'

type Messages = Record<string, string>

const ALL_MESSAGES: Record<Locale, Messages> = { ko, en, ja }

let currentLocale: Locale = 'ko'

export function setLocale(locale: Locale): void {
  currentLocale = locale
}

export function getLocale(): Locale {
  return currentLocale
}

export function t(key: string): string {
  return ALL_MESSAGES[currentLocale][key] ?? ALL_MESSAGES.ko[key] ?? key
}

/** Map locale to BCP-47 speech tag */
export function getSpeechLang(locale?: Locale): string {
  const l = locale ?? currentLocale
  switch (l) {
    case 'ko': return 'ko-KR'
    case 'en': return 'en-US'
    case 'ja': return 'ja-JP'
    default: return 'ko-KR'
  }
}
