# Home Page Implementation Status

Date: 2026-03-18
Scope: `E: HomePage rewrite`
Status: Implemented

## Summary

The Home page has been rewritten to match the new desktop shell direction:

- Agent Timeline is now the main content surface.
- Universal Composer remains the persistent bottom input.
- Quick launch actions and recent conversations moved into a supporting side rail.
- The legacy chat-bubble feed, inline streaming bubble view, and conversation dropdown header were removed from Home.

## Implemented UX Changes

- Main content now renders `Timeline` instead of `MessageBubble` and `StreamingText`.
- Home header now uses a page-intro pattern with a fresh-task action.
- Quick launch buttons start a new task directly from curated prompts.
- Recent work is shown through the existing `ConversationList` in a dedicated side panel.
- Composer remains wired to the existing chat store and voice input flow.
- Retry is wired to `useChatStore.retryLastMessage()`.

## Files Updated

- `apps/desktop/src/renderer/src/pages/HomePage.tsx`
- `apps/desktop/src/renderer/src/i18n/locales/en.ts`
- `apps/desktop/src/renderer/src/i18n/locales/ko.ts`
- `apps/desktop/src/renderer/src/i18n/locales/ja.ts`
- `apps/desktop/tests/unit/home-page.test.tsx`
- `apps/desktop/tests/a11y/home-page.a11y.test.tsx`

## Validation

Validated on 2026-03-18 with:

- `npm run typecheck`
- `npx vitest run tests/unit/home-page.test.tsx tests/a11y/home-page.a11y.test.tsx`
- `npx eslint src/renderer/src/pages/HomePage.tsx tests/unit/home-page.test.tsx tests/a11y/home-page.a11y.test.tsx`
- `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick`

## Deferred to the Next Task

`F: TasksPage` still owns the dedicated job list surface for in-progress, approval-needed, completed, and failed tasks.
The Home page intentionally keeps only resume-work and quick-launch responsibilities.
