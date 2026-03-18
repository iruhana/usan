'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';

export function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="border-t border-white/[0.04] bg-[#08080a] py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <Image src="/logo-sm.png" alt="Usan" width={28} height={28} className="rounded-lg" />
          <span className="text-[13px] font-medium text-white/50">{t('copyright')}</span>
          <span className="text-[12px] text-white/20">— {t('description')}</span>
        </div>
        <div className="flex items-center gap-5 text-[12px]">
          <a href="mailto:hello@usan.ai" className="text-white/25 transition-colors duration-200 hover:text-white/50">
            {t('contact')}
          </a>
          <span className="text-white/15">&copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
