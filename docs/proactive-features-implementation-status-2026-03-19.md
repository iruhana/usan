# Proactive Features Implementation Status

Date: 2026-03-19
Project: USAN Desktop
Scope: `3.5 Proactive features (context monitors)`

## 1. Summary

Task `3.5 Proactive features` is now implemented for the current desktop stack.

The proactive system is no longer limited to timer-based CPU, memory, disk, battery, and idle checks. It now reacts to live context signals from the active app, clipboard history, workflow progress, and voice status, then surfaces those suggestions directly inside the current Home shell.

## 2. What Changed

### Event-driven suggestion generation

Updated:

- `C:\Users\admin\Projects\usan\apps\desktop\src\main\proactive\suggestion-engine.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\proactive\triggers.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\proactive\rules.ts`

The suggestion engine now:

- keeps the existing system-health polling path
- subscribes to:
  - `clipboard.changed`
  - `context.changed`
  - `workflow.progress`
  - `voice.status`
- emits suggestions for:
  - JSON / URL-encoded / Markdown clipboard transforms
  - Explorer, browser, coding, and office app context
  - workflow completion and failure
  - voice input error recovery

### Clipboard event integration

Updated:

- `C:\Users\admin\Projects\usan\apps\desktop\src\main\infrastructure\clipboard-manager.ts`

The clipboard manager now emits a typed `clipboard.changed` event whenever a new clipboard entry is recorded, so the proactive engine can react without waiting for the next polling cycle.

### Renderer action bridge

Added:

- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\lib\proactive-actions.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\stores\proactive.store.ts`

This adds a renderer-side execution path for suggestion actions:

- `navigate`
- `send_prompt`
- `clean_temp`
- `clipboard_transform`
- compatibility fallback for legacy `show_processes`

### Home shell integration

Added or updated:

- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\proactive\SuggestionTray.tsx`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\proactive\SuggestionCard.tsx`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\pages\HomePage.tsx`

The Home page now shows a dedicated proactive tray in the right rail with:

- current context summary
- active app indicator
- idle-time indicator
- actionable suggestions
- dismiss support

This means proactive behavior is visible in the current `AppShell` navigation model instead of being effectively hidden in the legacy dashboard.

### Localization and coverage

Updated:

- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\en.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\ko.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\ja.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\tests\unit\i18n-visible-helpers.ts`

Added proactive monitoring copy for all supported locales and included the tray in visible-string coverage checks.

## 3. Validation

Passed:

- `npm run typecheck`
- `npx vitest run tests\unit\proactive-triggers.test.ts tests\unit\suggestion-tray.test.tsx tests\unit\home-page.test.tsx tests\a11y\suggestion-tray.a11y.test.tsx tests\a11y\home-page.a11y.test.tsx`
- `npm run test:unit`
- `npm run build`
- `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick`

Latest full unit result:

- `63` test files passed
- `316` tests passed

## 4. Additional Compatibility Fixes

While running full type-check validation, the workspace surfaced a settings type gap unrelated to proactive UI rendering.

Updated:

- `C:\Users\admin\Projects\usan\apps\desktop\src\shared\types\ipc.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\stores\settings.store.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\store.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\ipc\index.ts`

This restores typed support for `aiLabelEnabled` and keeps full-project typecheck green.

## 5. Remaining Notes

- Suggestion titles and descriptions generated in the main process are still hardcoded strings rather than locale-aware templates. The UI shell around them is localized, but the emitted suggestion content itself is not yet translated per locale.
- The current proactive tray is intentionally lightweight and Home-focused. If proactive behavior later needs a history view or per-source filtering, that should be added as a separate task instead of expanding this tray into a dashboard replacement.
