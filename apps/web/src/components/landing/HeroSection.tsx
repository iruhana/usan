'use client';

import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Umbrella, ArrowDown, Sparkles, Zap, Shield } from 'lucide-react';

export function HeroSection() {
  const t = useTranslations();

  return (
    <section className="relative min-h-[100vh] flex flex-col overflow-hidden bg-[#090909]">
      {/* Ambient gradient orbs (Doubao-inspired) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-15%] right-[-8%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.15)_0%,transparent_70%)] blur-[1px]" />
        <div className="absolute bottom-[-10%] left-[-5%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.12)_0%,transparent_70%)] blur-[1px]" />
        <div className="absolute top-[40%] left-[50%] h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.08)_0%,transparent_70%)]" />
      </div>

      {/* Subtle grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Navigation */}
      <nav className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_0_20px_rgba(37,99,235,0.3)]">
              <Umbrella className="h-[18px] w-[18px] text-white" />
            </div>
            <span className="text-lg font-semibold text-white/90">
              {t('common.appName')}
            </span>
          </div>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Content */}
      <div className="relative z-10 mx-auto flex max-w-4xl flex-1 flex-col justify-center px-6 pb-24 text-center">
        {/* Badge — glassmorphism (Yuanbao LaunchBox style) */}
        <div
          className="mb-8 flex justify-center opacity-0 animate-[fadeSlideUp_0.8s_ease-out_0.2s_forwards]"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm font-medium text-blue-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            {t('hero.badge')}
          </span>
        </div>

        {/* Title — AI gradient text */}
        <h1
          className="bg-gradient-to-b from-white via-white/90 to-white/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent opacity-0 sm:text-5xl lg:text-6xl animate-[fadeSlideUp_0.8s_ease-out_0.4s_forwards]"
          style={{ lineHeight: 1.15, fontWeight: 700 }}
        >
          {t('hero.title')}
        </h1>

        {/* Subtitle */}
        <p
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/50 opacity-0 sm:text-xl animate-[fadeSlideUp_0.8s_ease-out_0.6s_forwards]"
        >
          {t('hero.subtitle')}
        </p>

        {/* CTA — glass button with AI glow */}
        <div
          className="mt-10 flex flex-col items-center gap-3 opacity-0 animate-[fadeSlideUp_0.8s_ease-out_0.8s_forwards]"
        >
          <a
            href="#waitlist"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-[0_0_40px_rgba(37,99,235,0.3)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(37,99,235,0.4)] hover:-translate-y-0.5"
          >
            {/* Shimmer sweep on hover */}
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative">{t('hero.cta')}</span>
          </a>
          <span className="text-sm text-white/30">
            {t('hero.ctaSub')}
          </span>
        </div>

        {/* Stats bar — glass cards */}
        <div
          className="mt-16 flex flex-wrap justify-center gap-4 opacity-0 sm:gap-6 animate-[fadeSlideUp_0.8s_ease-out_1s_forwards]"
        >
          {[
            { icon: Zap, value: t('hero.stats.target'), label: t('hero.stats.targetLabel') },
            { icon: Shield, value: t('hero.stats.voice'), label: t('hero.stats.voiceLabel') },
            { icon: Umbrella, value: t('hero.stats.languages'), label: t('hero.stats.languagesLabel') },
          ].map(({ icon: Icon, value, label }, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 py-3 backdrop-blur-sm transition-colors duration-200 hover:bg-white/[0.06]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
                <Icon className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white/90">{value}</div>
                <div className="text-xs text-white/40">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ArrowDown className="h-5 w-5 text-white/20" />
      </div>
    </section>
  );
}
