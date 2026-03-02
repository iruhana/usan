# usan.ai - AI 보이스피싱 방지 서비스

## Quick Start

```bash
npm run dev    # 개발 서버
npm run build  # 프로덕션 빌드
npm run lint   # ESLint
```

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + shadcn/ui (new-york)
- **i18n:** next-intl (ko, en)
- **DB/Auth:** Supabase
- **Hosting:** Vercel + Cloudflare DNS

## Next.js 16 Patterns

- Dynamic params are `Promise`: `{ params }: { params: Promise<{ id: string }> }`
- Must `await params`: `const { id } = await params;`

## Supabase Auth

- Server client: `createServerSupabaseClient` from `@/lib/supabase/server`
- Service client: `createServiceClient` from `@/lib/supabase/server`
- Browser client: `createClient` from `@/lib/supabase/client`

## i18n

- Default locale: ko
- Supported: ko, en
- URL: `/{locale}/path` (ko prefix 생략)
- Translations: `messages/ko.json`, `messages/en.json`

## Database

- Supabase project ID: `forujutkhlgprfwupqlf`
- Migrations: `supabase/migrations/`
