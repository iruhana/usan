import { useTranslations } from 'next-intl';
import { Shield, MessageCircle, Users, Eye } from 'lucide-react';

const features = [
  { key: 'voicePhishing', icon: Shield, color: 'blue', hasBadge: true },
  { key: 'easyToUse', icon: MessageCircle, color: 'violet', hasBadge: false },
  { key: 'familyProtect', icon: Users, color: 'emerald', hasBadge: false },
  { key: 'accessibility', icon: Eye, color: 'amber', hasBadge: false },
] as const;

const COLOR_MAP: Record<string, { bg: string; icon: string; ring: string }> = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', ring: 'ring-blue-100' },
  violet: { bg: 'bg-violet-50', icon: 'text-violet-600', ring: 'ring-violet-100' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-100' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', ring: 'ring-amber-100' },
};

export function FeaturesSection() {
  const t = useTranslations('features');

  return (
    <section className="py-24 sm:py-32 bg-gray-50/50">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg text-gray-500 leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {features.map(({ key, icon: Icon, color, hasBadge }) => {
            const c = COLOR_MAP[color];
            return (
              <div
                key={key}
                className="group relative rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100 hover:shadow-md hover:ring-gray-200 transition-all duration-200"
              >
                {hasBadge && (
                  <span className="absolute top-6 right-6 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full ring-1 ring-blue-100">
                    {t(`${key}.badge`)}
                  </span>
                )}
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${c.bg} ring-1 ${c.ring} mb-5`}>
                  <Icon className={`h-6 w-6 ${c.icon}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {t(`${key}.title`)}
                </h3>
                <p className="text-base text-gray-500 leading-relaxed">
                  {t(`${key}.description`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
