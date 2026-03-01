import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
};

export default withNextIntl(nextConfig);
