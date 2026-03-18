'use client';

import { useTranslations } from 'next-intl';
import { Download, Mic, CheckCircle } from 'lucide-react';

const steps = [
  { key: 'step1', icon: Download, num: '01' },
  { key: 'step2', icon: Mic, num: '02' },
  { key: 'step3', icon: CheckCircle, num: '03' },
] as const;

export function HowItWorksSection() {
  const t = useTranslations('howItWorks');

  return (
    <section className="relative bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-16 text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-100/80">
            How it works
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {t('title')}
          </h2>
        </div>

        {/* Agent-style timeline layout */}
        <div className="relative">
          {/* Vertical connector line (mobile) / Horizontal (desktop) */}
          <div className="absolute left-10 top-0 hidden h-full w-px bg-gradient-to-b from-blue-200 via-indigo-200 to-blue-200 sm:left-0 sm:right-0 sm:top-[52px] sm:mx-auto sm:block sm:h-px sm:w-[60%] sm:bg-gradient-to-r" />

          <div className="relative grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-6">
            {steps.map(({ key, icon: Icon, num }, i) => (
              <div key={key} className="relative text-center">
                <div className="relative inline-flex flex-col items-center">
                  {/* Step card — glassmorphism */}
                  <div className="relative mb-6 flex h-[104px] w-[104px] items-center justify-center rounded-3xl border border-gray-100 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1">
                    <Icon className="h-8 w-8 text-blue-600" />

                    {/* Step number badge */}
                    <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]">
                      {num}
                    </span>

                    {/* Subtle pulse ring */}
                    <span
                      className="absolute inset-0 rounded-3xl ring-1 ring-blue-100/0 transition-all duration-300 group-hover:ring-blue-100/50"
                      style={{ animationDelay: `${i * 200}ms` }}
                    />
                  </div>
                </div>

                <h3 className="mb-2 text-lg font-bold text-gray-900">
                  {t(`${key}.title`)}
                </h3>
                <p className="mx-auto max-w-[240px] text-[15px] leading-relaxed text-gray-500">
                  {t(`${key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
