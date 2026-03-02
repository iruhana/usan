# Usan Action Checklist (2026-03-03)

## P2 (Completed)
- [x] Confirm feature scope: granular TTL permissions + legacy OpenClaw skill interop parsing
- [x] Add E2E scenarios: permission lifecycle and imported skill flow
- [x] Add observability baseline: permission grant/revoke/deny and skill import issue logs
- [x] Add execution automation: background E2E runner and npm scripts
- [x] Add CI quality gate: `desktop-quality.yml` (typecheck + unit + e2e)

## P3 (Completed)
- [x] Add observability hardening: log level control (`USAN_OBS_LEVEL`) and sensitive data redaction
- [x] Add test execution optimization: split scripts into `test:unit`, `test:e2e`, and `test:all`
- [x] Add background E2E operations: status/stop scripts for long-running tasks
- [x] Remove redundant CI ambiguity: workflow now runs `test:unit` explicitly before `test:e2e`

## P4 (Completed)
- [x] Remove Node deprecation source in tests: replace `fs.rmdir(..., { recursive: true })` with `fs.rm(..., { recursive: true, force: true })`
- [x] Stabilize test log output: add global test setup (`tests/setup-env.ts`) with `USAN_OBS_LEVEL=off`
- [x] Keep observability unit tests isolated: reset env to `off` after each case to prevent cross-test noise
