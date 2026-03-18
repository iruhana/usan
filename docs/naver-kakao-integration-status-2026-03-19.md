# Naver and Kakao Integration Status

Date: 2026-03-19
Project: USAN Desktop
Scope: `2.9 Naver/Kakao API integration`

## 1. Summary

Task `2.9 Naver/Kakao API integration` is now implemented for the current desktop stack.

The completed P1 scope is:

- Naver Search API integration
- Naver desktop OAuth integration
- Kakao desktop OAuth integration
- KakaoTalk "send to me" integration

The planned P2 items from the guide, including Kakao Calendar and KakaoMap, remain out of scope for this task.

## 2. What Changed

### Main-process OAuth providers

New desktop OAuth implementations were added for Naver and Kakao:

- `apps/desktop/src/main/auth/oauth-desktop.ts`
- `apps/desktop/src/main/auth/oauth-naver.ts`
- `apps/desktop/src/main/auth/oauth-kakao.ts`

The implementation uses:

- external browser login
- loopback callback listener on Windows
- encrypted token storage via Electron `safeStorage`
- automatic access token refresh when a refresh token is available

Operational defaults:

- Naver loopback callback: `http://127.0.0.1:18111/callback`
- Kakao loopback callback: `http://127.0.0.1:18112/callback`

These callback URLs must be registered in the corresponding developer console. The ports can also be overridden with:

- `USAN_NAVER_REDIRECT_PORT`
- `USAN_KAKAO_REDIRECT_PORT`

### Naver Search client

`apps/desktop/src/main/naver/naver-client.ts` now provides a typed client for:

- `news`
- `blog`
- `cafearticle`
- `shop`
- `encyc`

It reads:

- `USAN_NAVER_CLIENT_ID`
- `USAN_NAVER_CLIENT_SECRET`

The client normalizes Naver search output by:

- stripping HTML markup from titles and descriptions
- decoding common HTML entities
- mapping source metadata and publication time into cleaner output

### Kakao API client

`apps/desktop/src/main/kakao/kakao-client.ts` now provides:

- Kakao profile fetch
- Kakao logout helper
- KakaoTalk default-template memo send helper

The Kakao message helper targets:

- `POST https://kapi.kakao.com/v2/api/talk/memo/default/send`

and uses the stored access token from the desktop OAuth flow.

### AI tool exposure

`apps/desktop/src/main/ai/tools/korean-platform-tools.ts` adds tool-level integration for:

- `naver_search`
- `naver_news_search`
- `naver_oauth_start`
- `naver_oauth_status`
- `naver_oauth_logout`
- `kakao_oauth_start`
- `kakao_oauth_status`
- `kakao_oauth_logout`
- `kakao_send_to_me`

Security ring mapping was added in:

- `apps/desktop/src/main/security/rings.ts`

so the new tools follow the existing execution approval model.

### IPC and settings surface

Renderer-accessible status and connect/disconnect flows were added through:

- `apps/desktop/src/main/ipc/index.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/shared/constants/channels.ts`
- `apps/desktop/src/shared/types/ipc.ts`

The Settings > Connectors screen now shows Naver and Kakao connection state and lets the user launch or clear those connections:

- `apps/desktop/src/renderer/src/pages/SettingsPage.tsx`
- `apps/desktop/src/renderer/src/components/settings/ConnectorsSettingsSection.tsx`

## 3. Environment Variables

Naver:

- `USAN_NAVER_CLIENT_ID`
- `USAN_NAVER_CLIENT_SECRET`
- `USAN_NAVER_REDIRECT_PORT` (optional)

Kakao:

- `USAN_KAKAO_REST_API_KEY`
- `USAN_KAKAO_CLIENT_SECRET` (optional, but often required when client secret protection is enabled in Kakao Developers)
- `USAN_KAKAO_REDIRECT_PORT` (optional)

## 4. Validation

Passed:

- `npm run typecheck`
- `npx vitest run tests/unit/naver-client.test.ts tests/unit/korean-platform-tools.test.ts tests/unit/settings-page.test.tsx tests/a11y/settings-page.a11y.test.tsx`
- `npx eslint src/main/auth/oauth-desktop.ts src/main/auth/oauth-naver.ts src/main/auth/oauth-kakao.ts src/main/naver/naver-client.ts src/main/kakao/kakao-client.ts src/main/ai/tools/korean-platform-tools.ts src/main/ipc/index.ts src/preload/index.ts src/shared/types/ipc.ts src/shared/constants/channels.ts src/renderer/src/components/settings/ConnectorsSettingsSection.tsx src/renderer/src/pages/SettingsPage.tsx tests/unit/naver-client.test.ts tests/unit/korean-platform-tools.test.ts tests/unit/settings-page.test.tsx tests/a11y/settings-page.a11y.test.tsx`
- `npm run test:unit`
- `npm run build`

## 5. Design Notes

- Naver integration is implemented with the OIDC-style `openid` scope because the desktop OAuth policy in this project already assumes PKCE-capable loopback authorization.
- Kakao consent is requested with the `scope` parameter so the same connection can cover both login and KakaoTalk memo sending.
- The Settings surface intentionally does not expose credential entry. Developer console registration and secrets remain environment-driven.

## 6. Remaining Notes

- Exact provider console configuration still matters. If the registered callback URL does not match the loopback URL used by the app, the browser flow will fail before token exchange.
- Naver and Kakao runtime verification against real production app keys has not been done in this turn; the implementation was validated through typecheck, unit tests, and build integrity.
- P2 integrations from the guide, especially Kakao Calendar and KakaoMap, are still pending.
