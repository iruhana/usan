# Screen Understanding Implementation Status

Date: 2026-03-19
Status: Completed
Owner: Codex

## Scope

Task `3.4 Screen understanding (accessibility tree)` is now implemented for the desktop app.

This work extended the existing vision pipeline instead of creating a separate subsystem. The main process now collects a bounded Windows UI Automation control-view subtree for the active or focused window, merges it with OCR output, and returns a single structured analysis object to the renderer and AI tool layer.

## What Was Implemented

### 1. Shared analysis contract

Added shared types in `C:\Users\admin\Projects\usan\apps\desktop\src\shared\types\infrastructure.ts`:

- `AccessibilityNode`
- `AccessibilityTreeSummary`
- `UiAnalysisResult`

This gives main, preload, renderer, and tests the same strongly typed contract.

### 2. Main-process accessibility tree collection

Updated `C:\Users\admin\Projects\usan\apps\desktop\src\main\vision\ui-detector.ts`.

Key behavior:

- Resolves the active window first, then falls back to the focused window
- Uses a bounded Windows UI Automation control-view traversal
- Avoids walking the desktop root subtree
- Limits traversal depth, node count, and child count per node
- Returns:
  - screenshot
  - OCR result
  - flattened visible UI elements
  - accessibility tree
  - tree summary

### 3. IPC and preload contract update

Updated:

- `C:\Users\admin\Projects\usan\apps\desktop\src\main\ipc\index.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\preload\index.ts`

`vision.analyzeUI()` now returns the full `UiAnalysisResult` instead of only `{ elements, screenshot }`.

### 4. Renderer tree inspector

Added:

- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\vision\AccessibilityTree.tsx`

Updated:

- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\vision\VisionPanel.tsx`

Renderer behavior now includes:

- accessibility summary cards
- expandable tree view
- selected node detail panel
- found-element focus highlight
- reuse of OCR data returned by `analyzeUI()`

### 5. AI tool enrichment

Updated `C:\Users\admin\Projects\usan\apps\desktop\src\main\ai\tools\vision-tools.ts`.

`screen_analyze_ui` now returns:

- screenshot
- flattened visible elements
- accessibility tree
- tree summary
- instruction text for fallback screenshot inspection

This means agent flows can use structured UI data before relying on pure screenshot interpretation.

### 6. Localization and coverage

Updated locale files:

- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\en.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\ko.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\ja.ts`

Updated i18n coverage list:

- `C:\Users\admin\Projects\usan\apps\desktop\tests\unit\i18n-visible-helpers.ts`

## Validation

Passed:

- `npm run typecheck`
- `npx vitest run tests\unit\vision-panel.test.tsx tests\unit\vision-tools.test.ts tests\a11y\vision-panel.a11y.test.tsx`
- `npm run test:unit`
- `npm run build`
- `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick`

Latest full unit result:

- `61` test files passed
- `311` tests passed

## Files Added

- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\vision\AccessibilityTree.tsx`
- `C:\Users\admin\Projects\usan\apps\desktop\tests\unit\vision-panel.test.tsx`
- `C:\Users\admin\Projects\usan\apps\desktop\tests\unit\vision-tools.test.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\tests\a11y\vision-panel.a11y.test.tsx`

## Files Updated

- `C:\Users\admin\Projects\usan\apps\desktop\src\shared\types\infrastructure.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\vision\ui-detector.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\ipc\index.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\preload\index.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\ai\tools\vision-tools.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\vision\VisionPanel.tsx`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\en.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\ko.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\ja.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\tests\unit\i18n-visible-helpers.ts`

## Remaining Notes

- This implementation is Windows UI Automation based. Non-accessible apps will still rely more heavily on screenshot/OCR fallback.
- The traversal is intentionally bounded for stability and performance. It is designed for “current window understanding,” not full desktop introspection.
