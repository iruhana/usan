# Usan Audit Report (2026-03-02, Post-P1+Low)

## Scope
- Repository: C:\Users\admin\Projects\usan
- Validation: static review + build/lint/typecheck/test + npm audit

## Result Summary
- Critical: 0
- High: 0
- Medium: 0
- Low: 0
- Dependency vulnerabilities (`npm audit --omit=dev`): 0 (`apps/web`, `apps/desktop`)

## Fixed in this pass

### Permission bypass risk (renderer compromise -> privileged IPC)
- Status: Fixed
- Applied controls:
  - Privileged tool gating in ToolCatalog based on persisted permissions.
  - Main-process IPC gate for sensitive channels (`shell/fs/system/screenshot/openPath`).
- Code:
  - C:\Users\admin\Projects\usan\apps\desktop\src\main\ai\tool-catalog.ts
  - C:\Users\admin\Projects\usan\apps\desktop\src\main\ipc\index.ts

### Sync key derivation from public identifier only
- Status: Fixed (backward compatible)
- Applied controls:
  - Introduced v2 envelope (`v2:salt:iv:tag:ciphertext`).
  - v2 key derivation uses userId + root secret (env shared secret preferred, local secret fallback).
  - Legacy v1 decrypt path retained.
- Code:
  - C:\Users\admin\Projects\usan\apps\desktop\src\main\sync\sync-engine.ts

### Waitlist API abuse control gap
- Status: Fixed
- Applied controls:
  - Same-origin validation.
  - In-memory per-IP rate limiting with `Retry-After` header.
  - Robust payload/email validation hardening.
- Code:
  - C:\Users\admin\Projects\usan\apps\web\src\app\api\waitlist\route.ts

### Electron top-level navigation hardening
- Status: Fixed
- Applied controls:
  - `will-navigate` guard denies non-app navigation and safely opens only vetted external URLs.
- Code:
  - C:\Users\admin\Projects\usan\apps\desktop\src\main\index.ts

### Next workspace root warning
- Status: Fixed
- Applied controls:
  - Explicit Turbopack root configured in Next config.
- Code:
  - C:\Users\admin\Projects\usan\apps\web\next.config.ts

## Verification Logs
- Desktop:
  - `npm run typecheck` ✅
  - `npm run test` ✅ (128 tests)
  - `npm run build` ✅
- Web:
  - `npm run lint` ✅
  - `npm run build` ✅
- Security:
  - `npm audit --omit=dev --json` (`apps/web`, `apps/desktop`) ✅ 0 vulnerabilities
