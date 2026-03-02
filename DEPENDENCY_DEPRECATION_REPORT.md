# Dependency Deprecation Report (P5)
Date: 2026-03-03
Repo: C:\Users\admin\Projects\usan

## Scope
- Checked: `apps/desktop/package-lock.json`, `apps/web/package-lock.json`
- Actions run:
  - `npm update` in both apps
  - `npm ls ... --all` for deprecation ownership
  - Post-update validation (desktop typecheck/unit/e2e, web lint/build)

## Updated
- `C:\Users\admin\Projects\usan\apps\desktop\package-lock.json` refreshed
- `C:\Users\admin\Projects\usan\apps\web\package-lock.json` refreshed

## Remaining Deprecated Transitives

### Desktop
- `boolean@3.2.0`
  - owner chain: `electron -> @electron/get@2.0.3 -> global-agent@3.0.0 -> boolean`
- `glob@7.2.3`, `inflight@1.0.6`
  - owner chain: `electron-builder -> app-builder-lib -> @electron/asar@3.4.1 -> glob@7 -> inflight`
- `glob@10.5.0`
  - owner chain: `electron-builder -> app-builder-lib -> @electron/rebuild -> node-gyp -> make-fetch-happen -> cacache -> glob@10.5.0`
- `rimraf@2.6.3`
  - owner chain: `electron-builder -> app-builder-lib -> electron-builder-squirrel-windows -> electron-winstaller -> temp -> rimraf@2`
- `lodash.isequal@4.5.0`
  - owner chain: `electron-updater -> lodash.isequal`

### Web
- `node-domexception@1.0.0`
  - owner chain: `shadcn -> node-fetch -> fetch-blob -> node-domexception`

## Why These Remain
- They are locked by upstream dependency trees.
- Safe in-range updates do not remove them.
- Forcing overrides on key nodes (`@electron/get`, `glob`, `rimraf`) caused invalid tree conflicts or carries high break risk.

## Validation After Update
- Desktop:
  - `npm run typecheck` ✅
  - `npm run test:unit` ✅
  - `npm run test:e2e` ✅
- Web:
  - `npm run lint` ✅
  - `npm run build` ✅

## Next Safe Options
1. Plan a controlled Electron toolchain upgrade window (Electron/Electron Builder ecosystem) and re-evaluate transitive tree.
2. For web, keep `shadcn` CLI dependency pinned but monitor upstream for removal of `node-domexception`.
3. Re-run this audit after each significant dependency bump.
