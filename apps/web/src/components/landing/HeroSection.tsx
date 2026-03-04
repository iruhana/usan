'use client';

import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Umbrella, ArrowDown, Sparkles, Mic, Globe } from 'lucide-react';

export function HeroSection() {
  const t = useTranslations();

  return (
    <section className="relative overflow-hidden min-h-[100vh] flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-blue-50/80 to-sky-50" />
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-200/30 to-indigo-200/30 blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-sky-200/20 to-violet-200/20 blur-3xl" />

      {/* Floating dots decoration */}
      <div className="absolute top-[20%] left-[10%] w-2 h-2 rounded-full bg-blue-300/60 animate-pulse" />
      <div className="absolute top-[30%] right-[15%] w-3 h-3 rounded-full bg-indigo-300/40 animate-pulse [animation-delay:1s]" />
      <div className="absolute bottom-[30%] left-[20%] w-2.5 h-2.5 rounded-full bg-sky-300/50 animate-pulse [animation-delay:2s]" />

      {/* Navigation */}
      <nav className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Umbrella className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">
              {t('common.appName')}
            </span>
          </div>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center mx-auto max-w-4xl px-6 text-center pb-24">
        {/* Badge */}
        <div className="mb-8 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-sm px-4 py-2 text-sm font-medium text-blue-700 shadow-sm ring-1 ring-blue-100/80">
            <Sparkles className="w-3.5 h-3.5" />
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
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-700 hover:to-indigo-700"
          >
            {t('hero.cta')}
          </a>
          <span className="text-sm text-gray-400">
            {t('hero.ctaSub')}
          </span>
        </div>

        {/* Stats bar */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 sm:gap-12">
          {[
            { icon: Umbrella, value: t('hero.stats.target'), label: t('hero.stats.targetLabel') },
            { icon: Mic, value: t('hero.stats.voice'), label: t('hero.stats.voiceLabel') },
            { icon: Globe, value: t('hero.stats.languages'), label: t('hero.stats.languagesLabel') },
          ].map(({ icon: Icon, value, label }, i) => (
            <div key={i} className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm ring-1 ring-gray-100">
                <Icon className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            </div>
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
