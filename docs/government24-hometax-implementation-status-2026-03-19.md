# Government24 / Hometax Implementation Status

Date: 2026-03-19
Owner: Codex
Status: Initial implementation completed

## Scope completed

- Added an encrypted local Government24 / public-data connector for `data.go.kr` and `odcloud` routes.
- Added a generic public-data request path plus a business-registration status lookup flow based on the commonly used `odcloud` NTS endpoint shape.
- Added an encrypted local Hometax / tax connector for Barobill-compatible partner routes.
- Added Barobill-compatible read-only query flows for:
  - business status lookup
  - Hometax sales or purchase evidence lookup
- Added typed IPC and preload bridge methods for both connector families.
- Added Settings > Connectors UI for public-data and tax route setup.
- Added AI tools and security ring mappings for Government24 / Hometax read flows.

## Main files

- `C:\Users\admin\Projects\usan\apps\desktop\src\main\public-data\public-data-account-store.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\public-data\data-go-kr-client.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\public-data\public-data-manager.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\tax\tax-account-store.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\tax\barobill-client.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\tax\tax-manager.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\ai\tools\government-hometax-tools.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\main\ipc\index.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\preload\index.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\shared\types\ipc.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\shared\constants\channels.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\settings\ConnectorsSettingsSection.tsx`
- `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\pages\SettingsPage.tsx`

## Product behavior

- Public-data credentials and Barobill-compatible tax credentials are stored in encrypted desktop storage.
- The Government24 route can execute generic public-data requests and a dedicated business-status lookup.
- The public-data save flow verifies `odcloud`-style routes against the business-status endpoint shape.
- The Hometax save flow attempts verification only when a business-state path is configured.
- Tax API result parsing is intentionally tolerant because Barobill-compatible partner responses can vary by contract and guide version.

## Validation completed

- `npm run typecheck`
- `npx vitest run tests/unit/public-data-manager.test.ts tests/unit/tax-manager.test.ts tests/unit/settings-page.test.tsx`
- `npx vitest run tests/a11y/settings-page.a11y.test.tsx`
- `npx eslint src/main/public-data src/main/tax src/main/ai/tools/government-hometax-tools.ts src/main/ipc/index.ts src/preload/index.ts src/shared/types/ipc.ts src/shared/constants/channels.ts src/renderer/src/components/settings/ConnectorsSettingsSection.tsx src/renderer/src/pages/SettingsPage.tsx tests/unit/public-data-manager.test.ts tests/unit/tax-manager.test.ts tests/unit/settings-page.test.tsx`
- `npm run test:unit`
- `npm run build`

## Known gaps

- `Government24` is implemented through practical `data.go.kr / odcloud` connector surfaces, not through a separate direct Government24 private API.
- The public-data generic query path is flexible by design, so endpoint-specific request variables still depend on the chosen dataset.
- The Hometax connector is `Barobill-compatible` rather than a hardcoded official Barobill SDK binding because exact endpoint names and payloads can vary by partner documentation and account tier.
- No invoice issuance or mutation flow was added in this pass; the implementation is read-oriented on purpose.

## Reference basis

- data.go.kr OpenAPI service-key routing and odcloud NTS business-status usage pattern
- Barobill service pages for Hometax sales/purchase lookup and business-status lookup

## Next recommended task

- `4.5 Plugin/extension marketplace`
