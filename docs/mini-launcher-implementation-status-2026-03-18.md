# MiniLauncher Implementation Status

Date: 2026-03-18
Owner: Codex
Scope: `L: MiniLauncher`

## Summary

The MiniLauncher ambient entry is now implemented as a top-center overlay connected to the new shell.

It follows the design plan with:

- `Ctrl+Space` and `Alt+U` global open shortcuts
- top-center spotlight-style launcher surface
- quick actions for Recent, Files, Browser, and Screenshot
- recent task resume list
- lightweight suggestion list while typing
- `Esc` and explicit close button support

## Implementation Details

### 1. Overlay component

Added:

- `apps/desktop/src/renderer/src/components/ambient/MiniLauncher.tsx`
- `apps/desktop/src/renderer/src/components/ambient/index.ts`

The component uses:

- `FocusTrap` for keyboard containment
- `useChatStore` for recent conversations and task launching
- a dedicated dialog surface with backdrop blur and keyboard-first controls

### 2. AppShell integration

Updated:

- `apps/desktop/src/renderer/src/components/shell/AppShell.tsx`

The shell now:

- opens MiniLauncher with `Ctrl+Space`
- opens MiniLauncher with `Alt+U`
- closes MiniLauncher with `Esc`
- prevents command palette and launcher overlays from conflicting
- wires MiniLauncher navigation back into the existing `AppShell` page state

### 3. Behavior

MiniLauncher currently supports three launch patterns:

1. Type a prompt and run a fresh task.
2. Use quick actions to jump into common flows.
3. Resume an existing recent conversation directly into Home.

The prompt submit path intentionally creates a fresh conversation before sending so the launcher behaves like an ambient task starter rather than reusing the current thread unexpectedly.

### 4. Localization and visible UI coverage

Added new strings in:

- `apps/desktop/src/renderer/src/i18n/locales/en.ts`
- `apps/desktop/src/renderer/src/i18n/locales/ko.ts`
- `apps/desktop/src/renderer/src/i18n/locales/ja.ts`

Also updated:

- `apps/desktop/tests/unit/i18n-visible-helpers.ts`

This keeps MiniLauncher inside the visible UI translation audit set.

## Verification

Passed:

- `npm run typecheck`
- `npx vitest run tests/unit/mini-launcher.test.tsx tests/a11y/mini-launcher.a11y.test.tsx tests/unit/app-shell.test.tsx`
- `npx vitest run tests/unit/i18n-visible-ko.test.ts tests/unit/i18n-visible-ja.test.ts tests/unit/i18n-quality.test.ts`
- `npx eslint src/renderer/src/components/ambient src/renderer/src/components/shell/AppShell.tsx tests/unit/mini-launcher.test.tsx tests/a11y/mini-launcher.a11y.test.tsx tests/unit/app-shell.test.tsx tests/unit/i18n-visible-helpers.ts`
- `npm run build`

## Notes

- The current launcher keeps suggestions intentionally simple and local: typed text becomes an immediate launch target, while matching quick actions and recent tasks appear as lightweight suggestions.
- Quick actions favor safe renderer-side behavior. The Files, Browser, and Screenshot entries start prompt-based tasks rather than directly executing native side effects.
- The launcher is ready for future expansion with tray integration and FloatingToolbar work.

## Next Step

Proceed to the post-frontend audit and optimization loop across `A-H` and `L`.
