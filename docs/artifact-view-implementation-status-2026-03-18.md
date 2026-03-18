# ArtifactView Implementation Status

Date: 2026-03-18
Owner: Codex
Scope: `G: ArtifactView + ArtifactShelf`

## Summary

The artifact workspace is now implemented in the desktop renderer.

The UI no longer treats all model and tool output as plain chat text. Instead, the app now derives structured artifacts from conversation history and renders them through a dedicated shelf plus a focused viewer.

The implementation currently supports:

- markdown artifacts
- code artifacts
- table artifacts
- JSON artifacts
- image artifacts
- draft artifacts derived from live streaming text

## Implementation Details

### 1. Artifact state derivation

Added:

- `src/renderer/src/components/artifact/types.ts`
- `src/renderer/src/components/artifact/artifact-state.ts`

This layer converts `ChatMessage[]` plus live streaming state into a normalized artifact list.

It currently:

- derives artifact metadata such as source, kind, title, timestamps, and copy text
- recognizes fenced code blocks
- recognizes markdown-style tables
- converts structured tool output into JSON artifacts
- promotes tool screenshots into image artifacts
- exposes streaming text as a draft artifact so the user can inspect work-in-progress output

### 2. Artifact rendering components

Implemented:

- `src/renderer/src/components/artifact/ArtifactShelf.tsx`
- `src/renderer/src/components/artifact/ArtifactView.tsx`
- `src/renderer/src/components/artifact/CodeBlock.tsx`
- `src/renderer/src/components/artifact/index.ts`

The shelf provides horizontal selection across generated artifacts, while the viewer renders the selected item through a renderer matched to its type.

Rendering behavior includes:

- markdown via the existing markdown pipeline
- code and JSON via a dedicated code surface with copy action
- tables via a structured table renderer
- images via a preview surface
- fallback text rendering for plain text or draft output

### 3. Page integration

Integrated the artifact workspace into:

- `src/renderer/src/pages/HomePage.tsx`
- `src/renderer/src/pages/TasksPage.tsx`

Home now exposes an artifact workspace beneath the main timeline, and the Tasks detail panel now includes the same artifact workflow for the selected task.

This keeps output browsing aligned across the live execution view and the historical task view.

### 4. Localization and regression coverage

Added `artifact.*` keys in:

- `src/renderer/src/i18n/locales/en.ts`
- `src/renderer/src/i18n/locales/ko.ts`
- `src/renderer/src/i18n/locales/ja.ts`

Also updated:

- `tests/unit/i18n-visible-helpers.ts`

This ensures the new artifact UI participates in visible translation coverage.

## Verification

Passed:

- `npm run typecheck`
- `npx vitest run tests/unit/artifact-state.test.ts tests/unit/artifact-view.test.tsx tests/unit/home-page.test.tsx tests/unit/tasks-page.test.tsx tests/a11y/home-page.a11y.test.tsx tests/a11y/tasks-page.a11y.test.tsx tests/unit/i18n-visible-ko.test.ts tests/unit/i18n-visible-ja.test.ts tests/unit/i18n-quality.test.ts`
- `npx eslint src/renderer/src/components/artifact src/renderer/src/pages/HomePage.tsx src/renderer/src/pages/TasksPage.tsx tests/unit/artifact-state.test.ts tests/unit/artifact-view.test.tsx tests/unit/home-page.test.tsx tests/unit/tasks-page.test.tsx tests/unit/i18n-visible-helpers.ts`
- `npm run build`
- `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick`

## Notes

- The first artifact in a live session can be a draft artifact generated from `streamingText`. This is intentional and keeps the artifact workspace useful before the assistant response is finalized.
- Markdown table detection is intentionally conservative. Full rich-document artifact extraction can expand later without changing the page contract introduced here.
- Artifact persistence is still derived from saved conversation data rather than a dedicated artifact store.

## Next Step

Proceed to `H: SettingsPage restructure`.
