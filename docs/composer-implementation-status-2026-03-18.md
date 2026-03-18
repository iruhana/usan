# Composer Implementation Status

Date: 2026-03-18
Scope: Codex-C frontend task from `docs/codex-development-guide.md`

## Status

Implemented.

## What Changed

- Added the new Universal Composer under `apps/desktop/src/renderer/src/components/composer/`.
- Replaced the inline Home input area with the new composer in `apps/desktop/src/renderer/src/pages/HomePage.tsx`.
- Added mode chips for:
  - Search
  - Deep research
  - Files
  - Browser
  - Documents
- Added attachment actions for:
  - file
  - folder
  - screenshot
  - selected text
  - voice toggle
- Added prompt shaping so mode guidance and attachment context are serialized into the outgoing chat prompt before it reaches the existing `useChatStore.sendMessage()` path.
- Added recent prompt persistence with `localStorage`.
- Added keyboard interactions:
  - `Ctrl/Cmd+Enter` send
  - `Ctrl/Cmd+K` cycle mode
  - `Ctrl/Cmd+/` toggle recent prompts
  - `Ctrl/Cmd+Shift+V` paste plain text
- Allowed attachment-only submit so screenshot/file-only tasks can still be sent.
- Added renderer test hooks (`data-testid`) and dedicated unit/a11y coverage.

## IPC / Preload Wiring

- Added additive file-picker plumbing for the composer attach menu:
  - `apps/desktop/src/shared/constants/channels.ts`
  - `apps/desktop/src/shared/types/ipc.ts`
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/main/ipc/index.ts`
- The new `fs:pick` IPC path opens the native file or directory picker and returns selected paths to the renderer.

## Files Added

- `apps/desktop/src/renderer/src/components/composer/Composer.tsx`
- `apps/desktop/src/renderer/src/components/composer/ModeChips.tsx`
- `apps/desktop/src/renderer/src/components/composer/AttachMenu.tsx`
- `apps/desktop/src/renderer/src/components/composer/prompt.ts`
- `apps/desktop/src/renderer/src/components/composer/types.ts`
- `apps/desktop/tests/unit/composer.test.tsx`
- `apps/desktop/tests/unit/composer-prompt.test.ts`
- `apps/desktop/tests/a11y/composer.a11y.test.tsx`

## Files Updated

- `apps/desktop/src/renderer/src/components/composer/index.ts`
- `apps/desktop/src/renderer/src/pages/HomePage.tsx`
- `apps/desktop/src/shared/constants/channels.ts`
- `apps/desktop/src/shared/types/ipc.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/main/ipc/index.ts`
- `apps/desktop/tests/a11y/home-page.a11y.test.tsx`
- `apps/desktop/tests/unit/i18n-visible-helpers.ts`
- `apps/desktop/src/renderer/src/i18n/locales/en.ts`
- `apps/desktop/src/renderer/src/i18n/locales/ko.ts`
- `apps/desktop/src/renderer/src/i18n/locales/ja.ts`
- `docs/codex-development-guide.md`

## Design Alignment

- Completed in this task:
  - universal composer shell
  - mode chips
  - attach menu
  - prompt shaping
  - keyboard shortcuts
  - file picker IPC path
  - HomePage composer integration
- Deferred to later sequential tasks:
  - Codex-D: Agent Timeline
  - Codex-E: full HomePage rewrite around timeline/artifacts

## Verification

- `npm run typecheck`
- `npx vitest run tests/unit/composer.test.tsx tests/unit/composer-prompt.test.ts`
- `npx vitest run tests/a11y/composer.a11y.test.tsx tests/a11y/home-page.a11y.test.tsx`
- `npx eslint src/renderer/src/components/composer/Composer.tsx src/renderer/src/components/composer/AttachMenu.tsx src/renderer/src/components/composer/ModeChips.tsx src/renderer/src/components/composer/index.ts src/renderer/src/components/composer/types.ts src/renderer/src/pages/HomePage.tsx tests/unit/composer.test.tsx tests/unit/composer-prompt.test.ts tests/a11y/composer.a11y.test.tsx tests/a11y/home-page.a11y.test.tsx`

## Next Task

Codex-D: implement the agent timeline under `src/renderer/src/components/agent/`.
