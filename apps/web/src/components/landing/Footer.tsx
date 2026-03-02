import { useTranslations } from 'next-intl';
import { Shield } from 'lucide-react';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="py-12 bg-gray-900">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-white font-bold">{t('copyright')}</span>
              <p className="text-gray-500 text-sm">{t('description')}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a
              href="mailto:hello@usan.ai"
              className="text-gray-400 hover:text-white transition-colors"
            >
              {t('contact')}
            </a>
            <span className="text-gray-600">
              &copy; {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
