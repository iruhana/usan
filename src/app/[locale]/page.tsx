import { setRequestLocale } from 'next-intl/server';
import { type Locale } from '@/lib/i18n/config';
import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { WaitlistSection } from '@/components/landing/WaitlistSection';
import { Footer } from '@/components/landing/Footer';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <main className="min-h-screen">
      <HeroSection />
      <FeaturesSection />
      <WaitlistSection />
      <Footer />
    </main>
  );
}
