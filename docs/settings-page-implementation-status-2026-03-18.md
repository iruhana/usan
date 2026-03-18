# Settings Page Implementation Status

Date: 2026-03-18
Owner: Codex
Scope: `H: SettingsPage restructure`

## Summary

The Settings screen is now restructured as a policy control surface instead of a flat tab dump.

The page now follows the design plan more closely:

- left-side section navigation
- right-side focused content area
- policy-oriented grouping instead of mixed technical buckets
- Account absorbed into Settings
- Settings primitives split into reusable renderer components

## Implementation Details

### 1. Information architecture rewrite

`src/renderer/src/pages/SettingsPage.tsx` was rebuilt around six sections:

- General
- Account
- Connectors
- Security
- AI Models
- About & Legal

Legacy `display / sound / system / advanced` tab requests still resolve through `src/renderer/src/constants/settings.ts`, so older callers do not break while the new structure is active.

### 2. Component split

The former 836-line page was decomposed into reusable settings components under `src/renderer/src/components/settings/`:

- `SettingsPrimitives.tsx`
- `AccountSettingsPanel.tsx`
- `GeneralSettingsSection.tsx`
- `ConnectorsSettingsSection.tsx`
- `SecuritySettingsSection.tsx`
- `ModelsSettingsSection.tsx`
- `AboutSettingsSection.tsx`

This isolates layout primitives from section-specific logic and makes later maintenance more realistic.

### 3. Account absorption

Account sign-in and sign-out flows now live inside the Settings page through `AccountSettingsPanel.tsx`.

`src/renderer/src/pages/AccountPage.tsx` is now a compatibility shim that routes to `SettingsPage` with the `account` section selected.

### 4. Localization and visible UI coverage

Added new `settings.section.*`, `settings.policySurface*`, and `settings.card.*` keys in:

- `src/renderer/src/i18n/locales/en.ts`
- `src/renderer/src/i18n/locales/ko.ts`
- `src/renderer/src/i18n/locales/ja.ts`

Also updated:

- `tests/unit/i18n-visible-helpers.ts`

This keeps the new settings subcomponents inside visible-UI translation coverage.

## Verification

Passed:

- `npm run typecheck`
- `npx vitest run tests/a11y/settings-page.a11y.test.tsx tests/unit/settings-page.test.tsx tests/unit/beginner-guidance.test.tsx tests/unit/i18n-visible-ko.test.ts tests/unit/i18n-visible-ja.test.ts tests/unit/i18n-quality.test.ts`
- `npx eslint src/renderer/src/pages/SettingsPage.tsx src/renderer/src/pages/AccountPage.tsx src/renderer/src/components/settings tests/a11y/settings-page.a11y.test.tsx tests/unit/settings-page.test.tsx tests/unit/beginner-guidance.test.tsx tests/unit/i18n-visible-helpers.ts`
- `npm run build`
- `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick`

## Notes

- The settings surface intentionally separates permissions, models, and update policy so the page reads as a policy center rather than a feature warehouse.
- The Account route still exists only as a compatibility layer. The primary surface is now the Account section inside Settings.
- Some old translation keys such as `settings.group.*` remain for compatibility, but the visible structure now uses `settings.section.*`.

## Next Step

Proceed to `L: MiniLauncher`.
