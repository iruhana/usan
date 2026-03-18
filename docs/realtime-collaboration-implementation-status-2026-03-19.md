# Real-time Collaboration Implementation Status

Date: 2026-03-19
Scope: `4.6 Real-time collaboration (Supabase Realtime)` in `docs/codex-development-guide.md`
Status: Implemented

Audit follow-up: Hardening pass completed on 2026-03-19

## Summary

Usan Desktop now supports a usable Supabase Realtime collaboration loop for live conversation sharing.

This implementation adds:

- share / join flows for the active Home conversation
- Supabase Realtime Broadcast for live conversation and draft sync
- Supabase Realtime Presence for participant awareness
- renderer-side merge handling for shared conversation snapshots
- a new Home collaboration panel for room creation, room joining, share-code copy, and participant visibility

## Implementation

### Main process realtime manager

- Added realtime collaboration manager:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\collaboration\realtime-collaboration.ts`

The manager is responsible for:

- creating and joining share-code rooms
- resolving the current Supabase identity when available
- setting the Realtime auth token on the Supabase client
- opening collaboration channels with Broadcast + Presence enabled
- broadcasting conversation snapshots and live draft previews
- emitting status and remote update events to the renderer via the existing event bus

### IPC / preload integration

- Updated IPC handlers:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\ipc\index.ts`
- Updated preload bridge:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\preload\index.ts`
- Added shared channel names:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\shared\constants\channels.ts`
- Added shared IPC contracts:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\shared\types\ipc.ts`
- Added shared collaboration types:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\shared\types\infrastructure.ts`

New renderer-facing collaboration APIs include:

- `window.usan.collaboration.status()`
- `window.usan.collaboration.start()`
- `window.usan.collaboration.join()`
- `window.usan.collaboration.leave()`
- `window.usan.collaboration.syncConversation()`
- `window.usan.collaboration.syncDraft()`
- realtime event subscriptions for status, remote conversation sync, and remote draft sync

### Renderer integration

- Added collaboration state store:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\stores\collaboration.store.ts`
- Updated conversation store for remote merge support:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\stores\chat.store.ts`
- Added Home collaboration UI:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\collaboration\CollaborationPanel.tsx`
- Integrated collaboration into Home:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\pages\HomePage.tsx`

Renderer behavior now includes:

- starting a share room from the active conversation
- joining a room by share code
- displaying current participants and self identity
- showing a teammate draft preview card
- syncing local conversation snapshots and live draft text with duplicate-loop suppression
- merging remote conversation snapshots into the existing local conversation store

## Verification

Passed:

- `npm run typecheck`
- `npx vitest run tests/unit/realtime-collaboration.test.ts tests/unit/home-page.test.tsx`
- `npx eslint src/main/collaboration/realtime-collaboration.ts src/main/ipc/index.ts src/preload/index.ts src/shared/constants/channels.ts src/shared/types/ipc.ts src/shared/types/infrastructure.ts src/renderer/src/stores/collaboration.store.ts src/renderer/src/stores/chat.store.ts src/renderer/src/components/collaboration/CollaborationPanel.tsx src/renderer/src/pages/HomePage.tsx tests/unit/realtime-collaboration.test.ts tests/unit/home-page.test.tsx`
- `npm run test:unit`
- `npm run build`
- `npx vitest run tests/a11y/home-page.a11y.test.tsx`
- `npm run verify:strict`

## Tests added

- `C:\Users\admin\Projects\usan\apps\desktop\tests\unit\realtime-collaboration.test.ts`

## Post-implementation hardening

The implementation received a follow-up audit and stabilization pass after the initial feature delivery.

Hardening changes applied:

- fixed share-code normalization so generated room codes keep the intended format instead of dropping valid characters
- stabilized `joinedAt` presence metadata so participant ordering does not shift on every sync
- updated remote conversation merge handling so the local collaboration session revision advances with remote snapshots
- tightened renderer collaboration subscription guards to avoid partial listener initialization states

Post-audit validation remained green:

- `npm run typecheck`
- `npx vitest run tests/unit/realtime-collaboration.test.ts tests/unit/home-page.test.tsx`
- `npx vitest run tests/a11y/home-page.a11y.test.tsx`
- `npm run test:unit`
- `npm run verify:strict`

## Notes

- The current collaboration transport uses high-entropy share codes on Supabase Realtime channels. When a Supabase auth session exists, that identity is exposed in Presence and the Realtime auth token is set on the client.
- This path does not yet depend on database-backed Realtime authorization policies. A later hardening pass can migrate the room topics to private channels with explicit `realtime.messages` RLS.
- Conversation merge is append-friendly and keyed by message id, which fits the existing chat/timeline architecture without replacing the local SQLite-first persistence model.
