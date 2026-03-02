import { getRequestConfig } from 'next-intl/server';
import { locales, defaultLocale, type Locale } from './config';
import ko from '../../../messages/ko.json';
import en from '../../../messages/en.json';

const messageMap: Record<string, typeof ko> = { ko, en };

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }
  return { locale, messages: messageMap[locale] ?? ko };
});
