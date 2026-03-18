# Usan Release Blockers Checklist

Last updated: 2026-03-13

## Goal

- This checklist defines the minimum bar for calling Usan "release ready" for the current desktop-first scope.
- A checked item means the feature exists, works in validation, and has evidence.
- If any blocker item below is not complete, do not call the whole Usan product 100% implemented.

## Scope Definition

- In scope for this checklist:
  - Desktop app (`apps/desktop`)
  - Windows release packaging path
  - Public web surface currently promised by the repo (`apps/web`)
- Out of scope for "release ready now":
  - Voice-phishing protection roadmap
  - Android call capture
  - Server-side call analysis
  - Real-time risk scoring
  - Cross-device warning flow

## A. Desktop Core Release Blockers

- [x] Desktop quality gate passes
  - Evidence: `npm run verify:strict` passes in `apps/desktop`

- [x] Desktop smoke launch passes
  - Evidence: Electron smoke E2E passes

- [x] Desktop accessibility smoke passes
  - Evidence: Electron accessibility E2E passes

- [x] Core voice code exists
  - Evidence: STT and TTS implementations are present in code

- [ ] Live OpenRouter end-to-end flow is validated with a real API key
  - Minimum proof:
  - A real prompt completes through OpenRouter
  - At least one tool-use path completes from the chat flow
  - A failure case is verified with user-facing error handling

- [ ] Voice input is verified end-to-end with a real API key
  - Minimum proof:
  - STT request succeeds against the live transcription endpoint
  - Recognized text reaches the renderer chat input or equivalent UI
  - Error path is verified when API key/network is unavailable

- [ ] Permission-critical flows are verified manually in packaged app
  - Minimum proof:
  - Onboarding permission grant
  - Revoke and re-request flow
  - Sensitive action confirmation flow

## B. Windows Packaging Release Blockers

- [ ] `npm run build:win` succeeds for the configured Windows targets
  - Current known failure:
  - `uiohook-napi` arm64 rebuild fails because Visual Studio `v143` toolset is missing

- [ ] Windows installer is tested on a clean machine or VM
  - Minimum proof:
  - Install succeeds
  - App launches after install
  - Uninstall succeeds without corrupting user data

- [ ] Architecture decision is explicit
  - Choose one:
  - Keep `x64` + `arm64` and fix native module toolchain
  - Ship `x64` only for this release and update builder config accordingly

## C. Marketplace / Plugin Blockers

- [ ] Marketplace scope is explicitly defined for this release
  - Choose one:
  - Local/catalog plugins only
  - Remote plugin installation supported

- [ ] Remote plugin source behavior matches the chosen scope
  - Current known gap:
  - Remote plugin source is still rejected with `Remote plugin source is not supported yet`

- [ ] Plugin install/update/uninstall flows are validated in packaged app
  - Minimum proof:
  - Install works
  - Enable/disable works
  - Uninstall works
  - Failure notices are understandable for non-technical users

## D. Web Release Blockers

- [ ] Web scope is explicitly declared as one of the following
  - Landing + waitlist only
  - Landing + service pages

- [ ] Repository docs match the actual web scope
  - Current mismatch:
  - `apps/web/CLAUDE.md` says "web landing and service pages"
  - Actual app currently exposes landing pages and `/api/waitlist`

- [ ] Web README is replaced with project-specific documentation
  - Current gap:
  - `apps/web/README.md` still contains the default `create-next-app` template

- [ ] Waitlist production path is verified
  - Minimum proof:
  - Form submit succeeds
  - Duplicate submit is handled correctly
  - Rate limiting works
  - Same-origin protection works

## E. Product Definition Blockers

- [ ] Release claim language is narrowed to current scope
  - Required:
  - Do not describe roadmap voice-phishing features as implemented
  - Do not describe cross-device protection flow as implemented

- [ ] "100% implemented" is defined against a written scope
  - Required:
  - Decide whether this means:
  - "current desktop MVP complete"
  - or "full Usan product vision complete"

- [ ] Out-of-scope roadmap items are moved into a separate roadmap document or section
  - This avoids mixing release status with future product vision

## F. Release Evidence Checklist

- [ ] Save latest validation outputs
  - `apps/desktop`: `verify:strict`
  - `apps/web`: `build`, `lint`
  - `apps/desktop`: `build:win`

- [ ] Record final release decision with exact date
  - Example:
  - "As of 2026-03-13, Usan desktop MVP is release ready"
  - or
  - "As of 2026-03-13, Usan is not yet fully release ready"

## Current Status Summary

- Ready now:
  - Desktop strict validation
  - Desktop smoke/a11y E2E
  - Web build/lint
  - Core desktop feature surface

- Not yet complete:
  - Live API-key-based end-to-end proof
  - Windows installer completion for configured targets
  - Marketplace remote-source decision/implementation
  - Web scope/doc alignment
  - Product-wide "100% implemented" definition
