'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { Download, Zap, ShieldCheck } from 'lucide-react';

const spring = { type: 'spring' as const, stiffness: 80, damping: 20 };
const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: spring },
};

const steps = [
  { key: 'step1', icon: Download, num: '01' },
  { key: 'step2', icon: Zap, num: '02' },
  { key: 'step3', icon: ShieldCheck, num: '03' },
] as const;

export function HowItWorksSection() {
  const t = useTranslations('howItWorks');

  return (
    <section className="relative bg-[#08080a] py-28 sm:py-36">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="mb-16 text-center"
        >
          <motion.span
            variants={reveal}
            className="mb-4 inline-block rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40"
          >
            How it works
          </motion.span>
          <motion.h2 variants={reveal} className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight text-white/90">
            {t('title')}
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
          className="relative grid grid-cols-1 gap-6 sm:grid-cols-3"
        >
          {/* Connector line */}
          <div className="pointer-events-none absolute left-0 right-0 top-[56px] hidden h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent sm:block" />

          {steps.map(({ key, icon: Icon, num }) => (
            <motion.div key={key} variants={reveal} className="relative text-center">
              <div className="relative mx-auto mb-6 flex h-[112px] w-[112px] items-center justify-center">
                {/* Outer ring */}
                <div className="absolute inset-0 rounded-3xl border border-white/[0.06]" />
                {/* Inner card */}
                <div className="relative flex h-full w-full items-center justify-center rounded-3xl bg-white/[0.02] transition-colors duration-300 hover:bg-white/[0.05]">
                  <Icon className="h-7 w-7 text-white/50" />
                </div>
                {/* Number badge */}
                <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#08080a] shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                  {num}
                </span>
              </div>

              <h3 className="mb-2 text-[16px] font-semibold text-white/85">{t(`${key}.title`)}</h3>
              <p className="mx-auto max-w-[220px] text-[14px] leading-relaxed text-white/35">
                {t(`${key}.description`)}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
