# Floating Toolbar Implementation Status

Date: 2026-03-19
Status: Implemented
Owner: Codex

## Scope

Task `3.3 FloatingToolbar (context-aware)` from `docs/codex-development-guide.md` is now implemented for the desktop renderer.

## What Was Added

- A global renderer-side floating toolbar that appears for meaningful text selections.
- Selection detection for both document text and editable inputs/textareas.
- Viewport-aware positioning with above/below placement fallback.
- Contextual actions:
  - Ask Usan
  - Summarize
  - Explain selected text
  - Rewrite selected draft text when the source is editable
  - Add the selection to the Home composer
- Home composer draft handoff through a renderer event queue without changing the preload bridge.

## Key Files

- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\ambient\FloatingToolbar.tsx`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\ambient\floating-toolbar-state.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\ambient\floating-toolbar-events.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\shell\AppShell.tsx`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\pages\HomePage.tsx`

## Interaction Model

- The toolbar is mounted globally from `AppShell`.
- It is automatically suspended while higher-priority overlays are open.
- It reads renderer selection state only; no preload or main-process API changes were required.
- Composer handoff is resilient across page navigation because pending draft text is queued until `HomePage` consumes it.

## Validation

The following checks are required for close-out:

- `npm run typecheck`
- `npx vitest run tests/unit/floating-toolbar-state.test.ts tests/unit/floating-toolbar.test.tsx tests/unit/home-page.test.tsx tests/unit/app-shell.test.tsx`
- `npx vitest run tests/a11y/floating-toolbar.a11y.test.tsx tests/a11y/home-page.a11y.test.tsx`
- `npx eslint src/renderer/src/components/ambient/FloatingToolbar.tsx src/renderer/src/components/ambient/floating-toolbar-state.ts src/renderer/src/components/ambient/floating-toolbar-events.ts src/renderer/src/pages/HomePage.tsx tests/unit/floating-toolbar-state.test.ts tests/unit/floating-toolbar.test.tsx tests/a11y/floating-toolbar.a11y.test.tsx tests/unit/home-page.test.tsx tests/unit/app-shell.test.tsx tests/unit/i18n-visible-helpers.ts`
- `npm run build`

## Remaining Follow-up

- This version is intentionally renderer-scoped. Extending the same UX to external application selections would require deeper Windows accessibility or clipboard-trigger integration in a later phase.
