'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';

const spring = { type: 'spring' as const, stiffness: 80, damping: 20 };
const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: spring },
};

export function WaitlistSection() {
  const t = useTranslations('waitlist');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) { setStatus('success'); setEmail(''); }
      else { setStatus('error'); }
    } catch { setStatus('error'); }
  }

  return (
    <section id="waitlist" className="relative overflow-hidden bg-[#08080a] py-28 sm:py-36">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* CTA glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(37,99,235,0.08)_0%,transparent_70%)]" />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        className="relative z-10 mx-auto max-w-md px-6 text-center"
      >
        <motion.h2
          variants={reveal}
          className="text-[clamp(1.5rem,4vw,2.25rem)] font-bold tracking-tight text-white/90"
        >
          {t('title')}
        </motion.h2>
        <motion.p variants={reveal} className="mt-3 text-[15px] leading-relaxed text-white/35">
          {t('description')}
        </motion.p>

        {status === 'success' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={spring}
            className="mt-8 flex items-center justify-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5"
          >
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <span className="text-[14px] font-medium text-emerald-300">{t('success')}</span>
          </motion.div>
        ) : (
          <motion.form variants={reveal} onSubmit={handleSubmit} className="mt-8">
            <div className="flex gap-2">
              <input
                type="email"
                required
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'loading'}
                className="h-11 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-[14px] text-white placeholder:text-white/25 backdrop-blur-sm transition-colors focus:border-white/[0.15] focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="group relative flex h-11 items-center gap-1.5 overflow-hidden rounded-xl bg-white px-5 text-[14px] font-semibold text-[#08080a] transition-all hover:-translate-y-px hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] disabled:opacity-50"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-blue-100/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {status === 'loading' ? (
                  <Loader2 className="relative h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span className="relative">{t('submit')}</span>
                    <ArrowRight className="relative h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </div>
            <p className="mt-3 text-[12px] text-white/20">{t('privacy')}</p>
          </motion.form>
        )}

        {status === 'error' && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-[13px] font-medium text-red-400"
          >
            {t('error')}
          </motion.p>
        )}
      </motion.div>
    </section>
  );
}
