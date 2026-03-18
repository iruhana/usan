# Files Page Enhancement Status

Date: 2026-03-18
Owner: Codex
Scope: `2.4 Files page enhancement (views + action bar + react-window)`

## Summary

The Files page is no longer a single plain directory list.

It now matches the UI plan more closely:

- three view modes: list, grid, and column
- action-oriented bottom action bar
- `react-window` virtualization for large folders
- stronger file operations flow back into Home and local tools
- visible-UI localization coverage for the new file surface

## Implementation Details

### 1. Files surface split into dedicated components

New renderer components were added under `src/renderer/src/components/files/`:

- `FileExplorer.tsx`
- `ListView.tsx`
- `ActionBar.tsx`
- `file-metadata.ts`

This separates container logic, virtualized rendering, action controls, and file metadata formatting instead of keeping everything inside one page file.

### 2. Three file browsing modes

`src/renderer/src/pages/FilesPage.tsx` now delegates to `FileExplorer`, which supports:

- list view for dense scanning
- grid view for card-style browsing
- column view with an inline inspector panel

The page also keeps folder breadcrumbs, root/up navigation, search, sort, and folder picker access in one control surface.

### 3. Virtualized rendering

`react-window` is now used in `ListView.tsx` for both list and grid rendering.

This gives the Files page a realistic path for 1000+ item folders instead of fully rendering the whole directory every time.

### 4. Action-oriented file operations

When a file or folder is selected, `ActionBar.tsx` exposes:

- open
- open folder
- ask Usan
- copy path
- delete
- secure delete

For files, the “Ask Usan” action now creates a fresh Home task and sends a file-aware prompt into the chat pipeline.

### 5. Supporting backend changes

Two backend adjustments were made so the page can scale and behave correctly on Windows:

- `src/main/ipc/index.ts` now builds returned file paths with `join(dir, e.name)` instead of string concatenation
- `src/main/ai/tools/fs-tools.ts` increases directory listing capacity from 100 to 2000 entries

These changes are small but necessary for virtualization and correct path handling.

### 6. Localization and visible UI coverage

New `files.*` keys were added to:

- `src/renderer/src/i18n/locales/en.ts`
- `src/renderer/src/i18n/locales/ko.ts`
- `src/renderer/src/i18n/locales/ja.ts`

Visible-UI translation coverage was updated in:

- `tests/unit/i18n-visible-helpers.ts`

## Verification

Passed:

- `npm run typecheck`
- `npx vitest run tests/unit/files-page.test.tsx tests/a11y/files-page.a11y.test.tsx tests/unit/i18n-visible-ko.test.ts tests/unit/i18n-visible-ja.test.ts tests/unit/i18n-quality.test.ts`
- `npx eslint src/renderer/src/pages/FilesPage.tsx src/renderer/src/components/files src/main/ipc/index.ts src/main/ai/tools/fs-tools.ts tests/unit/files-page.test.tsx tests/a11y/files-page.a11y.test.tsx tests/unit/i18n-visible-helpers.ts`
- `npm run build`
- `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick`

## Notes

- The current page still uses fixed-height virtualization rather than dynamic row heights. That is intentional because fixed heights keep this surface simpler and faster.
- Directory deletion is intentionally not exposed from the action bar yet.
- The Files page now behaves more like an action workspace than a generic file explorer clone.

## Next Step

Proceed to the next remaining frontend surface after `2.4`, or move into another audit/improvement loop for the renderer stack.
