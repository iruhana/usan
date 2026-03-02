'use client';

import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Shield, ArrowDown } from 'lucide-react';

export function HeroSection() {
  const t = useTranslations();

  return (
    <section className="relative overflow-hidden min-h-[90vh] flex flex-col justify-center">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-blue-100/40 blur-3xl" />

      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">
              {t('common.appName')}
            </span>
          </div>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        {/* Badge */}
        <div className="mb-8 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-4 py-1.5 text-sm font-medium text-blue-700 ring-1 ring-blue-600/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            {t('hero.badge')}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl leading-[1.15] whitespace-pre-line">
          {t('hero.title')}
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg leading-relaxed text-gray-500 sm:text-xl max-w-2xl mx-auto">
          {t('hero.subtitle')}
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <a
            href="#waitlist"
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-200 hover:-translate-y-0.5"
          >
            {t('hero.cta')}
          </a>
          <span className="text-sm text-gray-400">
            {t('hero.ctaSub')}
          </span>
        </div>

        {/* Trust indicators */}
        <div className="mt-16 flex flex-wrap justify-center gap-3">
          {(['items.0', 'items.1', 'items.2'] as const).map((key, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm text-gray-500 shadow-sm ring-1 ring-gray-100"
            >
              {t(`trust.${key}`)}
            </span>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ArrowDown className="h-5 w-5 text-gray-300" />
      </div>
    </section>
  );
}
