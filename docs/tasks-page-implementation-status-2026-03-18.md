# TasksPage Implementation Status

Date: 2026-03-18
Owner: Codex
Scope: `F: TasksPage`

## Summary

The dedicated Tasks page is now implemented in the desktop app. It is no longer a placeholder or a re-export of `HomePage`.

The page now acts as a job board for saved conversations and exposes:

- task status classification (`in progress`, `approval needed`, `completed`, `failed`)
- task overview metrics with progress summary
- search and status filters
- a dedicated task list with selection state
- a task detail panel with timeline preview
- `Resume`, `Retry`, and guarded `Delete` actions

## Implementation Details

### 1. Task state derivation

Added `src/renderer/src/pages/tasks-page-state.ts`.

This utility converts stored conversations into task entries by reusing the existing timeline model:

- derives a normalized task status from conversation messages and live streaming state
- sorts tasks by priority and recent activity
- supports search and status filtering
- exposes counts for the page-level summary

This keeps the Tasks page aligned with the `Timeline` component instead of introducing a second status system.

### 2. Tasks page UI

Implemented `src/renderer/src/pages/TasksPage.tsx` as a real page with:

- `PageIntro` header and new-task entry point
- `ProgressSummary` metrics panel
- searchable and filterable task list
- selected-task detail header with metadata
- embedded `Timeline` for execution history
- action flows for:
  - resume in Home
  - retry failed task
  - soft-delete with undo support

### 3. Localization

Added new `tasks.*` keys in:

- `src/renderer/src/i18n/locales/en.ts`
- `src/renderer/src/i18n/locales/ko.ts`
- `src/renderer/src/i18n/locales/ja.ts`

Also updated `tests/unit/i18n-visible-helpers.ts` so the new page participates in visible-UI translation coverage.

## Verification

Passed:

- `npm run typecheck`
- `npx vitest run tests/unit/tasks-page-state.test.ts tests/unit/tasks-page.test.tsx tests/a11y/tasks-page.a11y.test.tsx tests/unit/i18n-visible-ko.test.ts tests/unit/i18n-visible-ja.test.ts tests/unit/i18n-quality.test.ts`
- `npm run build`
- `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick`

## Notes

- The task model currently derives status from persisted conversation history plus live streaming state. Stored approval requests are not yet part of the persistence model, so approval counts are structurally supported but depend on future runtime wiring.
- `ConversationList` still remains in `HomePage` for the recent-work rail. The Tasks page now provides the richer job-management surface; full component consolidation can happen later without changing the user-facing task model.

## Next Step

Proceed to `G: ArtifactView`.
