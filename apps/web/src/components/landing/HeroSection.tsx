'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ArrowDown } from 'lucide-react';
import Image from 'next/image';

const spring = { type: 'spring' as const, stiffness: 100, damping: 18, mass: 1 };
const stagger = { staggerChildren: 0.12, delayChildren: 0.3 };
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: spring },
};

export function HeroSection() {
  const t = useTranslations();

  return (
    <section className="relative flex min-h-[100vh] flex-col overflow-hidden bg-[#08080a]">
      {/* Gradient mesh background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[-20%] h-[800px] w-[800px] rounded-full bg-[radial-gradient(ellipse,rgba(37,99,235,0.12)_0%,transparent_60%)]" />
        <div className="absolute bottom-[-15%] right-[5%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(ellipse,rgba(124,58,237,0.10)_0%,transparent_60%)]" />
        <div className="absolute left-[45%] top-[50%] h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(59,130,246,0.06)_0%,transparent_60%)]" />
      </div>

      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Nav */}
      <nav className="relative z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring, delay: 0.1 }}
            className="flex items-center gap-2.5"
          >
            <Image src="/logo-sm.png" alt="Usan" width={36} height={36} className="rounded-xl shadow-[0_0_24px_rgba(37,99,235,0.35)]" />
            <span className="text-[15px] font-semibold tracking-tight text-white/90">{t('common.appName')}</span>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <LanguageSwitcher />
          </motion.div>
        </div>
      </nav>

      {/* Content */}
      <motion.div
        variants={{ visible: { transition: stagger } }}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto flex max-w-3xl flex-1 flex-col justify-center px-6 pb-28 text-center"
      >
        {/* Badge */}
        <motion.div variants={fadeUp} className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-[13px] font-medium tracking-wide text-blue-300/90 backdrop-blur-md">
            {t('hero.badge')}
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={fadeUp}
          className="whitespace-pre-line bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-[clamp(2.5rem,6vw,4rem)] font-bold leading-[1.1] tracking-[-0.03em] text-transparent"
        >
          {t('hero.title')}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={fadeUp}
          className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-white/40"
        >
          {t('hero.subtitle')}
        </motion.p>

        {/* CTA */}
        <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-3">
          <a
            href="#waitlist"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-7 py-3 text-[15px] font-semibold text-[#08080a] shadow-[0_0_40px_rgba(255,255,255,0.08)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(255,255,255,0.15)] hover:-translate-y-px"
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-blue-100/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <span className="relative">{t('hero.cta')}</span>
          </a>
          <span className="text-[13px] text-white/25">{t('hero.ctaSub')}</span>
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeUp} className="mt-16 flex flex-wrap justify-center gap-8">
          {[
            { value: t('hero.stats.target'), label: t('hero.stats.targetLabel') },
            { value: t('hero.stats.voice'), label: t('hero.stats.voiceLabel') },
            { value: t('hero.stats.languages'), label: t('hero.stats.languagesLabel') },
          ].map(({ value, label }, i) => (
            <div key={i} className="text-center">
              <div className="text-[22px] font-bold tracking-tight text-white/90">{value}</div>
              <div className="mt-0.5 text-[12px] tracking-wide text-white/30">{label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        >
          <ArrowDown className="h-4 w-4 text-white/15" />
        </motion.div>
      </motion.div>
    </section>
  );
}
