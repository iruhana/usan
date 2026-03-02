import { getRequestConfig } from 'next-intl/server';
import ko from '../../messages/ko.json';
import en from '../../messages/en.json';

const locales = ['ko', 'en'] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = 'ko';

const messageMap: Record<string, typeof ko> = { ko, en };

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }
  return { locale, messages: messageMap[locale] ?? ko };
});
