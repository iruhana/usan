/**
 * Minimal i18n for the desktop app.
 * Supports ko, en, ja — locale files in ./locales/
 */

import { en } from './locales/en'
import { ko } from './locales/ko'
import { ja } from './locales/ja'

export type Locale = 'ko' | 'en' | 'ja'

type Messages = Record<string, string>
type PartialMessages = Partial<Messages>

const BASE_MESSAGES: Messages = en
const LOCALE_MESSAGES: Record<Locale, PartialMessages> = { en, ko, ja }

let currentLocale: Locale = 'ko'

export function setLocale(locale: Locale): void {
  currentLocale = locale
}

export function getLocale(): Locale {
  return currentLocale
}

function isLikelyCorruptedTranslation(value: string | undefined): boolean {
  if (!value) return false
  if (value.includes('??')) return true

  const questionCount = (value.match(/\?/g) ?? []).length
  if (questionCount < 2) return false

  const visibleChars = value.replace(/\{[^}]+\}/g, '')
  const letterCount = (visibleChars.match(/[A-Za-z\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) ?? []).length
  return questionCount >= Math.max(2, Math.floor(letterCount / 3))
}

export function t(key: string): string {
  const localized = LOCALE_MESSAGES[currentLocale][key]
  if (typeof localized === 'string' && !isLikelyCorruptedTranslation(localized)) {
    return localized
  }

  return BASE_MESSAGES[key] ?? key
}

export { isLikelyCorruptedTranslation }

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
