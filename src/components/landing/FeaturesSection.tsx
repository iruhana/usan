import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, Heart, Users } from 'lucide-react';

const features = [
  { key: 'voicePhishing', icon: Shield },
  { key: 'easyToUse', icon: Heart },
  { key: 'familyProtect', icon: Users },
] as const;

export function FeaturesSection() {
  const t = useTranslations('features');

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-3xl font-bold text-center text-gray-900 sm:text-4xl">
          {t('title')}
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {features.map(({ key, icon: Icon }) => (
            <Card key={key} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                  <Icon className="h-7 w-7 text-blue-600" />
                </div>
                <CardTitle className="text-xl">{t(`${key}.title`)}</CardTitle>
                <CardDescription className="mt-2 text-base leading-relaxed">
                  {t(`${key}.description`)}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
