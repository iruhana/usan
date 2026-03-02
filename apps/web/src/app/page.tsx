import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function RootPage() {
  const headerList = await headers();
  const acceptLang = headerList.get('accept-language') || '';
  const locale = acceptLang.includes('en') ? 'en' : 'ko';
  redirect(`/${locale}`);
}
