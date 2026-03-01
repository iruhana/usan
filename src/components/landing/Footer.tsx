import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="py-8 bg-white border-t">
      <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <span>&copy; {new Date().getFullYear()} {t('copyright')}</span>
        <a
          href="mailto:hello@usan.ai"
          className="hover:text-gray-700 transition-colors"
        >
          {t('contact')}
        </a>
      </div>
    </footer>
  );
}
