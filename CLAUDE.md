# Usan Monorepo

## Scope

- Applies to `C:\Users\admin\Projects\usan`.
- Read `C:\Users\admin\Dendron\notes\CLAUDE.md` first, then this file.
- Use `C:\Users\admin\Projects\usan\AGENTS.md` only as a short routing note.

## Monorepo Structure

- `apps/desktop`: Electron desktop assistant app
- `apps/web`: Next.js web app for `usan.ai`
- If you are working in `apps/web`, also read `C:\Users\admin\Projects\usan\apps\web\CLAUDE.md`.

## Project Essentials

- Product: Agentic workspace — a unified execution container for work automation (not a chatbot, not targeting elderly/low-literacy users).
- Naming:
- Project name: `우산` / `Usan`
- IPC bridge: `window.usan`
- appId: `com.usan.app`
- Domain: `usan.ai`
- Product rules:
- Keep primary user-facing UI copy in Korean unless the task explicitly targets localized web content.
- Accessibility is mandatory: preserve large hit targets, font scaling, and high-contrast behavior.
- AI provider policy: OpenRouter-only unless the user explicitly requests an architectural change.
- Desktop automation assumptions are Windows and PowerShell based.

## Root Commands

- Install all: `npm run install:all`
- Desktop dev: `npm run dev:desktop`
- Web dev: `npm run dev:web`
- Desktop lint: `npm run lint`
- Desktop build: `npm run build:desktop`
- Web build: `npm run build:web`
- Desktop tests: `npm run test`
- Desktop typecheck: `npm run typecheck`

## Desktop App Rules

- Tech: Electron, React, Zustand, Tailwind.
- For desktop UI work, read `C:\Users\admin\Dendron\notes\Electron_React_Design.txt` first.
- Prefer `apps/desktop/package.json` scripts for validation:
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:a11y`
- `npm run test:e2e:electron`
- `npm run test:e2e:electron:a11y`
- `npm run verify:strict`

## Web App Rules

- Tech: Next.js 16, Supabase, shadcn/ui, next-intl.
- App-specific operating rules live in `C:\Users\admin\Projects\usan\apps\web\CLAUDE.md`.

## Product Direction Notes

- Voice-phishing protection remains roadmap context, not assumed implemented behavior.
- The planned flow includes Android call capture, server-side analysis, real-time risk scoring, and cross-device warning behavior.
