import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Shield } from 'lucide-react';

export function HeroSection() {
  const t = useTranslations();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <LanguageSwitcher />
      </div>

      <div className="mx-auto max-w-4xl px-6 py-24 sm:py-32 text-center">
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-3 rounded-full bg-blue-100 px-5 py-2.5">
            <Shield className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-semibold text-blue-700">
              {t('common.appName')}
            </span>
          </div>
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          {t('hero.title')}
        </h1>

        <p className="mt-6 text-lg leading-8 text-gray-600 sm:text-xl">
          {t('hero.subtitle')}
        </p>

        <div className="mt-10">
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
            asChild
          >
            <a href="#waitlist">{t('hero.cta')}</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
