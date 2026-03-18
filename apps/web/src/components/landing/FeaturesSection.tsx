'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { Sparkles, MessageCircle, Globe, Layers } from 'lucide-react';

const spring = { type: 'spring' as const, stiffness: 80, damping: 20 };
const reveal = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: spring },
};

const features = [
  { key: 'smartAssistant', icon: Sparkles, accent: '#2563eb', hasBadge: true },
  { key: 'easyToUse', icon: MessageCircle, accent: '#7c3aed' },
  { key: 'familyProtect', icon: Globe, accent: '#0ea5e9' },
  { key: 'accessibility', icon: Layers, accent: '#f59e0b' },
] as const;

export function FeaturesSection() {
  const t = useTranslations('features');

  return (
    <section className="relative bg-[#08080a] py-28 sm:py-36">
      {/* Faint horizontal line separator */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="mx-auto max-w-5xl px-6">
        {/* Header */}
        <motion.div
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <motion.span
            variants={reveal}
            className="mb-4 inline-block rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40"
          >
            Features
          </motion.span>
          <motion.h2 variants={reveal} className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight text-white/90">
            {t('title')}
          </motion.h2>
          <motion.p variants={reveal} className="mt-4 text-[16px] leading-relaxed text-white/35">
            {t('subtitle')}
          </motion.p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {features.map((feature, i) => {
            const { key, icon: Icon, accent } = feature;
            const hasBadge = 'hasBadge' in feature && feature.hasBadge;
            const isHero = i === 0;
            return (
              <motion.div
                key={key}
                variants={reveal}
                className={[
                  'group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-colors duration-300 hover:bg-white/[0.04]',
                  isHero ? 'sm:col-span-2 sm:flex sm:items-start sm:gap-6 sm:p-10' : '',
                ].join(' ')}
              >
                {/* Hover glow */}
                <div
                  className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)` }}
                />

                {hasBadge && (
                  <span className="absolute right-6 top-6 rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-300">
                    {t(`${key}.badge`)}
                  </span>
                )}

                <div
                  className={[
                    'relative flex shrink-0 items-center justify-center rounded-xl',
                    isHero ? 'h-12 w-12' : 'mb-4 h-10 w-10',
                  ].join(' ')}
                  style={{ background: `${accent}15` }}
                >
                  <Icon className={`${isHero ? 'h-5 w-5' : 'h-4 w-4'}`} style={{ color: accent }} />
                </div>

                <div className={isHero ? 'flex-1' : ''}>
                  <h3 className={`font-semibold text-white/85 ${isHero ? 'mb-2 text-xl' : 'mb-1.5 text-[16px]'}`}>
                    {t(`${key}.title`)}
                  </h3>
                  <p className={`leading-relaxed text-white/35 ${isHero ? 'max-w-lg text-[15px]' : 'text-[14px]'}`}>
                    {t(`${key}.description`)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
