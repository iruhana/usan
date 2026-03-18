# MCP Routing Implementation Status

Date: 2026-03-19
Project: USAN Desktop
Scope: `2.6 MCP routing`

## 1. Summary

Task `2.6 MCP routing` is now implemented for the current desktop architecture.

The routing layer no longer stops at simple target classification. It now includes:

- stronger app detection rules
- provider readiness/status reporting
- internal provider adapters for `playwright` and `qt-bridge`
- MCP-backed provider adapters for `chrome-devtools` and `windows-mcp`
- a central routing entry point that can list provider tools and execute provider-native actions

This closes the gap that remained after the initial Qt bridge work, where route detection existed but only the Qt path had a usable execution layer.

## 2. What Changed

### App detection improvements

`apps/desktop/src/main/mcp/app-detector.ts` now recognizes additional routing evidence:

- packaged Electron apps via `.asar`
- embedded WebView hosts via `EBWebView` / webview path evidence
- existing Qt / Chromium / CEF / WebView2 rules remain intact

### Provider adapter layer

New provider adapters were added under `apps/desktop/src/main/mcp/providers/`:

- `base.ts`
- `cdp.ts`
- `windows.ts`
- `playwright.ts`
- `index.ts`

The current routing model is:

- `playwright` -> internal adapter backed by `src/main/browser/browser-manager.ts`
- `qt-bridge` -> internal adapter backed by the native Qt bridge provider
- `chrome-devtools` -> MCP-backed adapter that resolves a connected chrome-devtools server from the MCP registry
- `windows-mcp` -> MCP-backed adapter that resolves a connected windows-mcp server from the MCP registry

### Central routing entry point

`apps/desktop/src/main/mcp/index.ts` now exposes:

- provider status listing
- provider tool listing
- routed provider tool execution

This is the first central execution surface that treats route detection and provider invocation as one feature instead of two unrelated pieces.

### Agent tool exposure

`apps/desktop/src/main/ai/tools/mcp-routing-tools.ts` adds generic routing tools:

- `app_list_providers`
- `app_list_provider_tools`
- `app_call_provider_tool`

These complement the existing Qt-specific tools and make the non-Qt routes usable from the tool catalog.

### Route enrichment

`apps/desktop/src/main/mcp/router.ts` now returns provider status alongside the selected route.

That means route resolution can report not only:

- which provider should be used

but also:

- whether that provider is actually ready
- whether an MCP server is configured
- whether an MCP server is connected
- how many tools are currently exposed

## 3. Files Updated

### Routing core

- `apps/desktop/src/main/mcp/app-detector.ts`
- `apps/desktop/src/main/mcp/router.ts`
- `apps/desktop/src/main/mcp/index.ts`

### Provider adapters

- `apps/desktop/src/main/mcp/providers/base.ts`
- `apps/desktop/src/main/mcp/providers/cdp.ts`
- `apps/desktop/src/main/mcp/providers/windows.ts`
- `apps/desktop/src/main/mcp/providers/playwright.ts`
- `apps/desktop/src/main/mcp/providers/index.ts`
- `apps/desktop/src/main/mcp/providers/qt-bridge.ts`

### Tool catalog integration

- `apps/desktop/src/main/ai/tools/mcp-routing-tools.ts`
- `apps/desktop/src/main/ai/tools/index.ts`
- `apps/desktop/src/main/ai/tools/qt-bridge-tools.ts`
- `apps/desktop/src/main/security/rings.ts`

### Validation

- `apps/desktop/tests/unit/app-detector.test.ts`
- `apps/desktop/tests/unit/automation-providers.test.ts`
- `apps/desktop/tests/unit/mcp-routing-tools.test.ts`

## 4. Validation

Passed:

- `npm run typecheck`
- `npx vitest run tests/unit/app-detector.test.ts tests/unit/automation-providers.test.ts tests/unit/mcp-routing-tools.test.ts`
- `npx eslint src/main/mcp/app-detector.ts src/main/mcp/router.ts src/main/mcp/index.ts src/main/mcp/providers/base.ts src/main/mcp/providers/cdp.ts src/main/mcp/providers/windows.ts src/main/mcp/providers/playwright.ts src/main/mcp/providers/index.ts src/main/ai/tools/mcp-routing-tools.ts src/main/ai/tools/qt-bridge-tools.ts src/main/security/rings.ts tests/unit/app-detector.test.ts tests/unit/automation-providers.test.ts tests/unit/mcp-routing-tools.test.ts`
- `npm run build`
- `npm run test:unit`

## 5. Design Notes

- `playwright` remains an internal provider because the desktop app already has a browser automation stack built on `playwright-core`.
- `chrome-devtools` and `windows-mcp` remain MCP-backed providers because the app should reuse the existing installed MCP servers instead of duplicating their surface area in-process.
- Route resolution now explicitly distinguishes between:
  - route selection
  - provider readiness
  - provider execution

That separation makes the automation layer easier to debug and safer to expose to the agent loop.

## 6. Remaining Notes

- `chrome-devtools` and `windows-mcp` availability still depends on MCP server configuration and connection state in the desktop registry.
- The central routed tool API is intentionally low-level. Higher-level workflow macros can be built on top later, but the routing architecture is no longer blocked on that.
