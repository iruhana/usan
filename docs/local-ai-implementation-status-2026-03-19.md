# Local AI Implementation Status

Date: 2026-03-19  
Scope: `3.1 Local AI (Ollama + node-llama-cpp)` for `C:\Users\admin\Projects\usan\apps\desktop`

## Summary

Local AI routing is now implemented in the desktop app.

- OpenRouter remains the primary cloud path when a cloud API key is configured.
- Ollama is now detected as the first local runtime and is used automatically when cloud AI is unavailable.
- `node-llama-cpp` is integrated as an optional offline fallback through dynamic runtime loading.
- Settings now show local models together with cloud models instead of labeling the section as online-only.

## What Was Implemented

### 1. Local provider layer

Added local AI runtime files under `src/main/ai/local/`:

- `ollama-client.ts`
  - Detects Ollama via `http://127.0.0.1:11434/api/tags`
  - Lists local Ollama models
  - Streams `/api/chat` responses
  - Passes through Ollama tool calls when the model/runtime supports them

- `node-llama-runtime.ts`
  - Dynamically loads `node-llama-cpp` only at runtime
  - Avoids bundling the package into Electron build output
  - Detects a GGUF model from explicit env vars or local model directories
  - Streams text completions from a local GGUF runtime

Provider wrappers were added under `src/main/ai/providers/`:

- `ollama.ts`
- `node-llama.ts`

### 2. Router changes

`src/main/ai/model-router.ts` now supports:

- explicit local model selection (`ollama/...`, `node-llama-cpp/...`)
- automatic local fallback when no cloud provider is available
- route-aware local model preference scoring
- short-lived local model caching to avoid repeated runtime discovery on every request

Current local preference order:

- most routes: `ollama` first, `node-llama-cpp` second
- tool-use/workflow: `ollama` only
- vision: no local fallback yet

### 3. User-visible behavior

`src/main/ipc/ai.ipc.ts` basic-mode copy was updated so it no longer assumes that only OpenRouter exists.

Settings model UI now:

- shows cloud and local models together
- shows whether a model is `Local` or `Cloud`
- includes a local model count in the routing summary card

Updated files:

- `src/renderer/src/components/settings/ModelsSettingsSection.tsx`
- `src/renderer/src/pages/SettingsPage.tsx`
- `src/renderer/src/i18n/locales/ko.ts`
- `src/renderer/src/i18n/locales/en.ts`
- `src/renderer/src/i18n/locales/ja.ts`

## Runtime Discovery Rules

### Ollama

- Default endpoint: `http://127.0.0.1:11434`
- Override with: `USAN_OLLAMA_BASE_URL`

### node-llama-cpp

Explicit model path env vars:

- `USAN_NODE_LLAMA_MODEL_PATH`
- `USAN_LOCAL_GGUF_PATH`

Model directory discovery order:

1. `USAN_NODE_LLAMA_MODEL_DIR`
2. `USAN_LOCAL_MODEL_DIR`
3. Electron user data: `models\local-ai`
4. App working directory: `models\local-ai`
5. Packaged resources: `resources\models\local-ai`

The first `.gguf` file found is used as the offline model.

## Validation

The following checks passed on 2026-03-19:

- `npm run typecheck`
- `npx vitest run tests\unit\model-router.test.ts tests\unit\ollama-provider.test.ts`
- `npx vitest run tests\unit\settings-page.test.tsx tests\a11y\settings-page.a11y.test.tsx`
- `npm run test:unit`
- `npx eslint src\main\ai\model-router.ts src\main\ai\local\ollama-client.ts src\main\ai\local\node-llama-runtime.ts src\main\ai\providers\ollama.ts src\main\ai\providers\node-llama.ts src\main\ipc\ai.ipc.ts src\renderer\src\components\settings\ModelsSettingsSection.tsx src\renderer\src\pages\SettingsPage.tsx tests\unit\model-router.test.ts tests\unit\ollama-provider.test.ts tests\unit\i18n-quality.test.ts`
- `npm run build`

## Constraints and Follow-up Notes

- `node-llama-cpp` is integrated via dynamic import, but it still requires the package and a GGUF model to exist at runtime.
- Local vision routing is intentionally not enabled yet.
- `node-llama-cpp` currently behaves as an offline text-generation fallback, not as a full tool-calling agent runtime.
- Cross-provider fallback chains are not yet streamed across provider boundaries in a single request. Current behavior is:
  - cloud available -> use cloud route
  - cloud unavailable -> use local route

## Status

`3.1 Local AI` is now implemented for the current desktop architecture and documented here.
