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
    <section className="py-24 sm:py-32 bg-white">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-3xl font-extrabold text-center text-gray-900 sm:text-4xl tracking-tight mb-16">
          {t('title')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-8">
          {steps.map(({ key, icon: Icon, num }, i) => (
            <div key={key} className="relative text-center">
              {/* Connector line (between steps on desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden sm:block absolute top-8 left-[60%] w-[80%] h-px bg-gray-200" />
              )}

              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-6 shadow-lg shadow-blue-600/20">
                <Icon className="h-7 w-7" />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white text-blue-600 text-xs font-bold flex items-center justify-center ring-2 ring-blue-100">
                  {num}
                </span>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {t(`${key}.title`)}
              </h3>
              <p className="text-gray-500 leading-relaxed">
                {t(`${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
