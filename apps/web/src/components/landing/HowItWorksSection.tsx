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
    <section className="py-24 sm:py-32 bg-gradient-to-b from-gray-50/80 to-white">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-100 mb-4">
            How it works
          </span>
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight">
            {t('title')}
          </h2>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-6">
          {/* Connector line (desktop only) */}
          <div className="hidden sm:block absolute top-10 left-[20%] right-[20%] h-px bg-gradient-to-r from-blue-200 via-indigo-200 to-blue-200" />

          {steps.map(({ key, icon: Icon, num }) => (
            <div key={key} className="relative text-center">
              <div className="relative inline-flex flex-col items-center">
                <div className="relative w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-md ring-1 ring-gray-100 mb-6">
                  <Icon className="h-8 w-8 text-blue-600" />
                  <span className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                    {num}
                  </span>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {t(`${key}.title`)}
              </h3>
              <p className="text-gray-500 leading-relaxed max-w-[240px] mx-auto">
                {t(`${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
