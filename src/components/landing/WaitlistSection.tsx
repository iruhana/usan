'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    <section id="waitlist" className="py-20 sm:py-28 bg-blue-50">
      <div className="mx-auto max-w-xl px-6 text-center">
        <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
          {t('title')}
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          {t('description')}
        </p>

        {status === 'success' ? (
          <div className="mt-8 rounded-lg bg-green-50 p-4 text-green-700">
            {t('success')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 flex gap-3 sm:flex-row flex-col">
            <Input
              type="email"
              required
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-12 text-base"
              disabled={status === 'loading'}
            />
            <Button
              type="submit"
              size="lg"
              disabled={status === 'loading'}
              className="bg-blue-600 hover:bg-blue-700 text-white h-12 px-6"
            >
              {status === 'loading' ? '...' : t('submit')}
            </Button>
          </form>
        )}

        {status === 'error' && (
          <p className="mt-4 text-sm text-red-600">{t('error')}</p>
        )}
      </div>
    </section>
  );
}
