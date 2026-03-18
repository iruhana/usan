import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Geist, Geist_Mono } from 'next/font/google';
import { locales, type Locale } from '@/lib/i18n/config';
import '../globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const titles: Record<string, string> = {
    ko: '우산 - 에이전트 워크스페이스',
    en: 'Usan - Agentic Workspace',
  };
  const descriptions: Record<string, string> = {
    ko: '하나의 입력창에서 계획, 실행, 승인, 결과물 생성을 이어주는 에이전트 워크스페이스',
    en: 'Agentic workspace that plans, executes, approves, and delivers from a single input',
  };
  return {
    title: titles[locale] || titles.ko,
    description: descriptions[locale] || descriptions.ko,
    metadataBase: new URL('https://usan.ai'),
    alternates: { languages: { ko: '/ko', en: '/en' } },
    icons: {
      icon: [
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      ],
      shortcut: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
    openGraph: {
      title: titles[locale] || titles.ko,
      description: descriptions[locale] || descriptions.ko,
      url: 'https://usan.ai',
      siteName: 'Usan',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Usan - Agentic Workspace' }],
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: titles[locale] || titles.ko,
      description: descriptions[locale] || descriptions.ko,
      images: ['/og-image.png'],
    },
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale as Locale);
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
