# Calendar Integration Implementation Status

Date: 2026-03-19
Scope: `4.2 Calendar integration (Google + CalDAV)` in `docs/codex-development-guide.md`
Status: Implemented

## Summary

Usan Desktop now supports a local-first calendar route based on standard CalDAV while preserving the existing Google Calendar OAuth path as a fallback.

This work adds:

- encrypted local CalDAV account storage using Electron `safeStorage`
- CalDAV calendar discovery, event listing, event creation, and event deletion through `tsdav`
- renderer-accessible calendar account status, save, and clear IPC routes
- Settings > Connectors UI for preset-based CalDAV configuration
- provider routing that prefers CalDAV and falls back to existing Google / Microsoft calendar adapters

## Implementation

### Main process

- Added encrypted account store:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\calendar\calendar-account-store.ts`
- Added CalDAV client:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\calendar\caldav-client.ts`
- Updated manager routing:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\calendar\calendar-manager.ts`
- Added IPC routes:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\ipc\index.ts`

### Shared / preload

- Added typed calendar config/status contracts:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\shared\types\ipc.ts`
- Extended shared calendar event typing:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\shared\types\infrastructure.ts`
- Added IPC channel constants:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\shared\constants\channels.ts`
- Exposed new preload bridge methods:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\preload\index.ts`

### Renderer

- Extended Connectors settings surface with a calendar account card:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\settings\ConnectorsSettingsSection.tsx`
- Wired Settings page state and save / clear flows:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\pages\SettingsPage.tsx`
- Updated calendar free-time typing for the renderer:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\calendar\CalendarView.tsx`
- Added i18n strings:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\en.ts`
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\ko.ts`
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\ja.ts`

## Dependency changes

Added runtime dependency:

- `tsdav`

## Verification

Passed:

- `npm run typecheck`
- `npx vitest run tests/unit/calendar-manager.test.ts tests/unit/settings-page.test.tsx tests/a11y/settings-page.a11y.test.tsx`
- `npx eslint src/main/calendar/calendar-account-store.ts src/main/calendar/caldav-client.ts src/main/calendar/calendar-manager.ts src/main/ipc/index.ts src/preload/index.ts src/shared/types/ipc.ts src/shared/types/infrastructure.ts src/shared/constants/channels.ts src/renderer/src/components/settings/ConnectorsSettingsSection.tsx src/renderer/src/pages/SettingsPage.tsx src/renderer/src/components/calendar/CalendarView.tsx tests/unit/calendar-manager.test.ts tests/unit/settings-page.test.tsx tests/a11y/settings-page.a11y.test.tsx`
- `npm run test:unit`
- `npm run build`

## Notes

- The CalDAV path is now the preferred route when a local calendar account is saved.
- Existing Google and Microsoft calendar integrations remain as fallback paths, so the new work does not remove previous support.
- Passwords are never echoed back to the renderer. The settings form can reuse a saved password without displaying it.
- If the calendar URL is left blank, Usan verifies the account and uses the first discovered calendar for that CalDAV account.

## Remaining follow-up

- Provider presets currently cover `Custom`, `iCloud`, `Fastmail`, and `Nextcloud`. More presets can be added later if needed.
- The CalDAV event parser currently focuses on the common VEVENT fields used by the desktop UI. If a provider exposes heavy recurrence or timezone-specific edge cases in production, the parser can be hardened further with richer ICS handling.
