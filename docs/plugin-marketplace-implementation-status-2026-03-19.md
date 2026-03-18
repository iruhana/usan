# Plugin Marketplace Implementation Status

Date: 2026-03-19
Scope: `4.5 Plugin/extension marketplace (MCP-based)` in `docs/codex-development-guide.md`
Status: Implemented

## Summary

Usan Desktop now has a usable MCP-based plugin and extension marketplace flow.

This work closes the remaining gaps that existed in the partially-built marketplace code:

- remote marketplace catalog entries can now install from ZIP archives
- archive installs verify catalog-level SHA-256 digests when provided
- plugin manifests can declare bundled MCP server definitions
- bundled MCP servers are registered, connected, disabled, and removed with the plugin lifecycle
- the current `Tools` page now exposes marketplace browsing and MCP connection management in one place
- the old standalone marketplace page is reduced to a compatibility wrapper around the shared workspace

## Implementation

### Marketplace backend

- Extended remote catalog support:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\marketplace\marketplace-client.ts`
- Added support for:
  - local directory sources
  - local ZIP archives
  - remote ZIP archives over HTTP(S)
  - safe archive extraction with path traversal checks
  - temporary staging cleanup after install

### Plugin lifecycle + managed MCP servers

- Updated plugin manager:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\infrastructure\plugin-manager.ts`
- Added shared metadata:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\shared\types\infrastructure.ts`

Plugins can now declare `mcpServers` inside `manifest.json`.

When such a plugin is installed:

- MCP server configs are registered in the local MCP registry
- `stdio` commands are resolved relative to the installed plugin directory
- `autoConnect !== false` servers are connected automatically

When the plugin is disabled:

- bundled MCP servers are disconnected

When the plugin is re-enabled:

- bundled MCP servers are reconnected and re-registered if needed

When the plugin is uninstalled:

- bundled MCP server configs are removed from the registry

### AI tool integration

- Updated marketplace tool handlers:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\ai\tools\marketplace-tools.ts`

`marketplace_search` now uses the real catalog-aware marketplace client, and `plugin_install` accepts either:

- a marketplace plugin id
- a local source path

### Renderer integration

- Added shared workspace component:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\marketplace\MarketplaceWorkspace.tsx`
- Updated MCP panel refresh support:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\mcp\McpServerList.tsx`
- Updated plugin cards/details:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\marketplace\PluginCard.tsx`
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\components\marketplace\PluginDetail.tsx`
- Integrated marketplace workspace into the active Tools surface:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\pages\ToolsPage.tsx`
- Reduced the legacy marketplace page to a wrapper:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\renderer\src\pages\MarketplacePage.tsx`

### IPC integration

- Updated async plugin toggle handlers:
  - `C:\Users\admin\Projects\usan\apps\desktop\src\main\ipc\index.ts`

## Verification

Passed:

- `npm run typecheck`
- `npx eslint src/main/marketplace/marketplace-client.ts src/main/infrastructure/plugin-manager.ts src/main/ai/tools/marketplace-tools.ts src/main/ipc/index.ts src/renderer/src/components/marketplace/MarketplaceWorkspace.tsx src/renderer/src/components/marketplace/PluginCard.tsx src/renderer/src/components/marketplace/PluginDetail.tsx src/renderer/src/components/mcp/McpServerList.tsx src/renderer/src/pages/MarketplacePage.tsx src/renderer/src/pages/ToolsPage.tsx tests/unit/plugin-manager.test.ts tests/unit/marketplace-client.test.ts tests/unit/tools-page.test.tsx`
- `npx vitest run tests/unit/plugin-manager.test.ts tests/unit/marketplace-client.test.ts tests/unit/tools-page.test.tsx tests/a11y/tools-page.a11y.test.tsx tests/unit/user-facing-errors.test.ts`
- `npm run test:unit`
- `npm run build`
- `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick`

## Tests added

- `C:\Users\admin\Projects\usan\apps\desktop\tests\unit\plugin-manager.test.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\tests\unit\marketplace-client.test.ts`
- `C:\Users\admin\Projects\usan\apps\desktop\tests\unit\tools-page.test.tsx`

## Notes

- The remote install path currently targets ZIP archives only. That is intentional to keep package validation and extraction predictable.
- Catalog-level `sourceSha256` is optional, but when present it is enforced before archive extraction.
- Bundled MCP servers are plugin-scoped through generated ids of the form `{pluginId}--{serverId}`.
- The marketplace is now surfaced through `Tools`, which matches the current shell/navigation model and avoids reviving a deprecated top-level page.
