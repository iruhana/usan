'use client';

import { useTranslations } from 'next-intl';
import { Sparkles, MessageCircle, Users, Eye } from 'lucide-react';

const features = [
  { key: 'smartAssistant', icon: Sparkles, gradient: 'from-blue-500 to-indigo-500', hasBadge: true },
  { key: 'easyToUse', icon: MessageCircle, gradient: 'from-violet-500 to-purple-500', hasBadge: false },
  { key: 'familyProtect', icon: Users, gradient: 'from-emerald-500 to-teal-500', hasBadge: false },
  { key: 'accessibility', icon: Eye, gradient: 'from-amber-500 to-orange-500', hasBadge: false },
] as const;

export function FeaturesSection() {
  const t = useTranslations('features');

  return (
    <section className="relative bg-[#fafafa] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 ring-1 ring-blue-100/80">
            Features
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-gray-500">
            {t('subtitle')}
          </p>
        </div>

        {/* Bento grid — glassmorphism cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map(({ key, icon: Icon, gradient, hasBadge }, i) => {
            const isHero = i === 0;
            return (
              <div
                key={key}
                className={[
                  'group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-8 transition-all duration-300',
                  'hover:border-gray-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]',
                  isHero ? 'sm:col-span-3 sm:flex sm:items-center sm:gap-8 sm:p-10' : '',
                ].join(' ')}
              >
                {/* Subtle gradient overlay on hover (Doubao pattern) */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-50/0 to-indigo-50/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:from-blue-50/40 group-hover:to-indigo-50/20" />

                {hasBadge && (
                  <span className="absolute right-6 top-6 z-10 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 ring-1 ring-blue-100/80">
                    {t(`${key}.badge`)}
                  </span>
                )}

                {/* Icon with AI gradient background */}
                <div
                  className={[
                    'relative z-10 inline-flex items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg',
                    gradient,
                    isHero ? 'h-16 w-16 shrink-0 shadow-blue-500/20' : 'mb-5 h-12 w-12 shadow-gray-300/30',
                  ].join(' ')}
                >
                  <Icon className={`text-white ${isHero ? 'h-7 w-7' : 'h-5 w-5'}`} />
                </div>

                <div className={`relative z-10 ${isHero ? 'flex-1' : ''}`}>
                  <h3 className={`font-bold text-gray-900 ${isHero ? 'mb-3 text-2xl' : 'mb-2 text-lg'}`}>
                    {t(`${key}.title`)}
                  </h3>
                  <p className={`leading-relaxed text-gray-500 ${isHero ? 'max-w-xl text-lg' : 'text-[15px]'}`}>
                    {t(`${key}.description`)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
