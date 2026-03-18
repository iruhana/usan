import { useTranslations } from 'next-intl';
import { Umbrella } from 'lucide-react';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="border-t border-white/[0.06] bg-[#090909] py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
              <Umbrella className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-white/80">{t('copyright')}</span>
              <p className="text-sm text-white/30">{t('description')}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a
              href="mailto:hello@usan.ai"
              className="text-white/30 transition-colors duration-200 hover:text-white/60"
            >
              {t('contact')}
            </a>
            <span className="text-white/20">
              &copy; {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
