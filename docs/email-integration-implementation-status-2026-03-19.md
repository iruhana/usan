# Email Integration Implementation Status

Date: 2026-03-19
Scope: `4.1 Email integration (IMAP/SMTP)` in `docs/codex-development-guide.md`
Status: Implemented

## Summary

Usan Desktop now supports a local-first email account path based on standard IMAP and SMTP.

This work adds:

- encrypted local mailbox account storage using Electron `safeStorage`
- IMAP inbox listing and message reading through `imapflow`
- SMTP sending through `nodemailer`
- MIME parsing through `mailparser`
- renderer-accessible account status, save, and clear IPC routes
- Settings > Connectors UI for preset-based IMAP/SMTP configuration
- provider routing that prefers IMAP/SMTP and falls back to existing Gmail / Outlook OAuth adapters

## Implementation

### Main process

- Added encrypted account store:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\email\email-account-store.ts`
- Added IMAP/SMTP client:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\email\imap-smtp-client.ts`
- Updated manager routing:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\email\email-manager.ts`
- Added IPC routes:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\ipc\index.ts`

### Shared / preload

- Added typed email config/status contracts:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\shared\types\ipc.ts`
- Added IPC channel constants:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\shared\constants\channels.ts`
- Exposed new preload bridge methods:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\preload\index.ts`

### Renderer

- Extended Connectors settings surface with an email account card:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\settings\ConnectorsSettingsSection.tsx`
- Wired Settings page state and save / clear flows:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\pages\SettingsPage.tsx`
- Added i18n strings:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\en.ts`
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\ko.ts`
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\i18n\locales\ja.ts`

## Dependency changes

Added runtime dependencies:

- `imapflow`
- `nodemailer`
- `mailparser`

Added development dependency:

- `@types/mailparser`

## Verification

Passed:

- `npm run typecheck`
- `npx vitest run tests/unit/email-manager.test.ts tests/unit/settings-page.test.tsx tests/a11y/settings-page.a11y.test.tsx`
- `npx eslint src/main/email/email-account-store.ts src/main/email/imap-smtp-client.ts src/main/email/email-manager.ts src/main/ipc/index.ts src/preload/index.ts src/shared/types/ipc.ts src/shared/constants/channels.ts src/renderer/src/components/settings/ConnectorsSettingsSection.tsx src/renderer/src/pages/SettingsPage.tsx tests/unit/email-manager.test.ts tests/unit/settings-page.test.tsx tests/a11y/settings-page.a11y.test.tsx`
- `npm run test:unit`
- `npm run build`

## Notes

- The IMAP/SMTP path is now the preferred route when a local mailbox account is saved.
- Existing Gmail and Outlook OAuth integrations remain as fallback paths, so the new work does not remove previous support.
- Passwords are never echoed back to the renderer. The settings form can reuse a saved password without displaying it.

## Remaining follow-up

- Account presets currently cover `Gmail`, `Outlook`, `Naver`, `Daum`, and `Custom`. More presets can be added later if needed.
- The current message list path prioritizes reliability over rich previews. It can be extended later with better inbox snippet extraction if real-world usage requires it.
