# usan.ai Web App

## Scope

- Applies to `C:\Users\admin\Projects\usan\apps\web`.
- Read `C:\Users\admin\Projects\usan\CLAUDE.md` first, then this file.

## Project Essentials

- Product surface: web landing and service pages for `usan.ai`.
- Stack: Next.js 16, TypeScript 5, Tailwind CSS 4, shadcn/ui, next-intl, Supabase.
- Hosting: Vercel with Cloudflare DNS.

## Core Commands

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`
- Lint: `npm run lint`

## Required Validation

- UI or routing changes: `npm run build` and `npm run lint`
- Content or translation changes: `npm run lint` and confirm locale routing behavior
- Supabase or auth changes: `npm run build`, `npm run lint`, and validate affected server/client paths

## Local Guardrails

- Next.js 16 dynamic route params are async. Await `params` before use.
- Supabase clients:
- Server client: `createServerSupabaseClient` from `@/lib/supabase/server`
- Service client: `createServiceClient` from `@/lib/supabase/server`
- Browser client: `createClient` from `@/lib/supabase/client`
- i18n:
- Default locale: `ko`
- Supported locales: `ko`, `en`
- URL structure: `/{locale}/path` with omitted `ko` prefix behavior where already implemented
- Translation files: `messages/ko.json`, `messages/en.json`
- Database:
- Supabase project ID: `forujutkhlgprfwupqlf`
- Migrations live in `supabase/migrations/`
