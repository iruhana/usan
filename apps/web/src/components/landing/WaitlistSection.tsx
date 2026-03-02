'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, CheckCircle, Loader2 } from 'lucide-react';

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
    <section id="waitlist" className="py-24 sm:py-32 bg-gradient-to-b from-white to-blue-50">
      <div className="mx-auto max-w-xl px-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-6 shadow-lg shadow-blue-600/20">
          <Mail className="h-7 w-7" />
        </div>

        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight">
          {t('title')}
        </h2>
        <p className="mt-4 text-lg text-gray-500 leading-relaxed">
          {t('description')}
        </p>

        {status === 'success' ? (
          <div className="mt-8 flex items-center justify-center gap-3 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="text-emerald-700 font-medium">{t('success')}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8">
            <div className="flex gap-3 sm:flex-row flex-col">
              <input
                type="email"
                required
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'loading'}
                className="flex-1 h-13 px-5 rounded-xl bg-white text-base text-gray-900 placeholder:text-gray-400 ring-1 ring-gray-200 focus:ring-2 focus:ring-blue-600 focus:outline-none transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="h-13 px-7 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-md shadow-blue-600/20 hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {status === 'loading' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  t('submit')
                )}
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-400">
              {t('privacy')}
            </p>
          </form>
        )}

        {status === 'error' && (
          <p className="mt-4 text-sm text-red-500 font-medium">{t('error')}</p>
        )}
      </div>
    </section>
  );
}
