'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = locale === 'ko' ? 'en' : 'ko';
  const label = locale === 'ko' ? 'EN' : '한국어';

  function handleSwitch() {
    const path = pathname.replace(/^\/(ko|en)/, '') || '/';
    router.replace(`/${switchTo}${path}`);
  }

  return (
    <button
      onClick={handleSwitch}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
    >
      {label}
    </button>
  );
}
