'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, CheckCircle, Loader2, Send } from 'lucide-react';

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

      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <section id="waitlist" className="relative overflow-hidden bg-[#090909] py-24 sm:py-32">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.1)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-xl px-6 text-center">
        {/* Icon */}
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)]">
          <Mail className="h-7 w-7" />
        </div>

        <h2 className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          {t('title')}
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-white/40">
          {t('description')}
        </p>

        {status === 'success' ? (
          <div className="mt-8 flex items-center justify-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 backdrop-blur-sm">
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
            <span className="font-medium text-emerald-300">{t('success')}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'loading'}
                className="h-[52px] flex-1 rounded-xl border border-white/[0.08] bg-white/[0.05] px-5 text-base text-white placeholder:text-white/30 backdrop-blur-sm transition-all focus:border-blue-500/40 focus:outline-none focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="group relative flex h-[52px] items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 font-semibold text-white shadow-[0_0_30px_rgba(37,99,235,0.2)] transition-all hover:shadow-[0_0_40px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 disabled:opacity-50"
              >
                {/* Shimmer sweep */}
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {status === 'loading' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="relative h-4 w-4" />
                    <span className="relative">{t('submit')}</span>
                  </>
                )}
              </button>
            </div>
            <p className="mt-3 text-sm text-white/20">
              {t('privacy')}
            </p>
          </form>
        )}

        {status === 'error' && (
          <p className="mt-4 text-sm font-medium text-red-400">{t('error')}</p>
        )}
      </div>
    </section>
  );
}
