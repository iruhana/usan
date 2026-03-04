'use client';

import { useTranslations } from 'next-intl';
import { Sparkles, MessageCircle, Users, Eye } from 'lucide-react';

const features = [
  { key: 'smartAssistant', icon: Sparkles, color: 'blue', hasBadge: true },
  { key: 'easyToUse', icon: MessageCircle, color: 'violet', hasBadge: false },
  { key: 'familyProtect', icon: Users, color: 'emerald', hasBadge: false },
  { key: 'accessibility', icon: Eye, color: 'amber', hasBadge: false },
] as const;

const COLOR_MAP: Record<string, { bg: string; icon: string; ring: string; glow: string }> = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', ring: 'ring-blue-100', glow: 'group-hover:shadow-blue-100' },
  violet: { bg: 'bg-violet-50', icon: 'text-violet-600', ring: 'ring-violet-100', glow: 'group-hover:shadow-violet-100' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-100', glow: 'group-hover:shadow-emerald-100' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', ring: 'ring-amber-100', glow: 'group-hover:shadow-amber-100' },
};

export function FeaturesSection() {
  const t = useTranslations('features');

  return (
    <section className="py-24 sm:py-32 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600 ring-1 ring-blue-100 mb-4">
            Features
          </span>
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg text-gray-500 leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Bento grid: first item spans full width, rest in 3 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {features.map(({ key, icon: Icon, color, hasBadge }, i) => {
            const c = COLOR_MAP[color];
            const isHero = i === 0;
            return (
              <div
                key={key}
                className={`group relative rounded-2xl bg-gray-50/80 p-8 ring-1 ring-gray-100 hover:bg-white hover:shadow-lg hover:ring-gray-200 transition-all duration-300 ${c.glow} ${
                  isHero ? 'sm:col-span-3 sm:flex sm:items-center sm:gap-8 sm:p-10' : ''
                }`}
              >
                {hasBadge && (
                  <span className="absolute top-6 right-6 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full ring-1 ring-blue-100">
                    {t(`${key}.badge`)}
                  </span>
                )}

                <div className={`inline-flex items-center justify-center rounded-2xl ${c.bg} ring-1 ${c.ring} ${
                  isHero ? 'w-16 h-16 shrink-0' : 'w-12 h-12 mb-5'
                }`}>
                  <Icon className={`${isHero ? 'h-7 w-7' : 'h-6 w-6'} ${c.icon}`} />
                </div>

                <div className={isHero ? 'flex-1' : ''}>
                  <h3 className={`font-bold text-gray-900 ${isHero ? 'text-2xl mb-3' : 'text-xl mb-2'}`}>
                    {t(`${key}.title`)}
                  </h3>
                  <p className={`text-gray-500 leading-relaxed ${isHero ? 'text-lg max-w-xl' : 'text-base'}`}>
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
