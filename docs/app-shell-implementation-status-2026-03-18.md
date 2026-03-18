# AppShell Implementation Status

Date: 2026-03-18
Scope: Codex-A frontend task from `docs/codex-development-guide.md`

## Status

Implemented.

## What Changed

- Added `apps/desktop/src/renderer/src/components/shell/AppShell.tsx` as the new renderer shell entrypoint.
- Moved main layout responsibilities out of `components/layout/AppLayout.tsx` and left `AppLayout.tsx` as a compatibility re-export.
- Switched `apps/desktop/src/renderer/src/App.tsx` to lazy-load `shell/AppShell`.
- Added `components/shell/TitleBar.tsx` and `components/shell/StatusBar.tsx` wrappers so the shell namespace exists before sidebar/composer/timeline migrations.
- Integrated `StatusBar` into the main shell so the frame now matches the documented titlebar + shell + statusbar structure.
- Preserved the existing `useState<AppPage>` navigation model and global keyboard routing:
  - `Ctrl/Cmd+K` toggles the command palette
  - `Ctrl/Cmd+1..5` switches pages
  - `Ctrl/Cmd+N` starts a new conversation on Home
  - app-level `usan:navigate` events still route into the shell
- Added a dedicated shell unit test suite and updated locale startup tests for the new entrypoint.

## Design Alignment

This task intentionally stops at the AppShell layer.

- Completed in this task:
  - shell entrypoint
  - overlay wiring
  - keyboard routing
  - shell frame styling
  - status bar integration
- Deferred to later sequential tasks:
  - Codex-B: 64px frosted glass sidebar implementation
  - Codex-C/D: composer and agent timeline
  - Codex-L: mini launcher

## Files Added

- `apps/desktop/src/renderer/src/components/shell/AppShell.tsx`
- `apps/desktop/src/renderer/src/components/shell/TitleBar.tsx`
- `apps/desktop/src/renderer/src/components/shell/StatusBar.tsx`
- `apps/desktop/tests/unit/app-shell.test.tsx`

## Files Updated

- `apps/desktop/src/renderer/src/App.tsx`
- `apps/desktop/src/renderer/src/components/layout/AppLayout.tsx`
- `apps/desktop/src/renderer/src/components/shell/index.ts`
- `apps/desktop/tests/unit/app-locale.test.tsx`
- `docs/codex-development-guide.md`

## Verification

- `npm run typecheck`
- `npx vitest run tests/unit/app-shell.test.tsx tests/unit/app-locale.test.tsx`
- `npx eslint src/renderer/src/App.tsx src/renderer/src/components/shell/AppShell.tsx src/renderer/src/components/layout/AppLayout.tsx tests/unit/app-shell.test.tsx tests/unit/app-locale.test.tsx`

## Next Task

Codex-B: replace the temporary legacy sidebar dependency with the documented 64px frosted glass responsive sidebar.
