# Multi-Model Routing Implementation Status

Date: 2026-03-18
Project: USAN Desktop
Scope: Task I from the Codex development guide

## 1. Summary

Task I has been implemented for the current desktop architecture.

The desktop app now uses a shared multi-model router instead of a single hard-coded default model. The new router still follows the local project rule of staying OpenRouter-only, but it now makes route decisions by request intent and sends model failover chains to OpenRouter when possible.

This means the app can make different routing decisions for:

- deep reasoning
- code generation
- quick chat
- summarization
- vision-like prompts
- tool-heavy prompts
- workflow decisions

## 2. What Changed

The routing layer now supports:

- a shared singleton router for both chat IPC and workflow execution
- explicit model selection when the caller provides a supported model id
- heuristic route selection when no model is specified
- ordered fallback model chains per route
- OpenRouter request bodies that use `models` failover arrays instead of only `model`

The current route table is:

| Route | Primary | Fallbacks |
|------|---------|-----------|
| complex-reasoning | `anthropic/claude-sonnet-4` | `openai/gpt-4o`, `deepseek/deepseek-chat` |
| code-generation | `anthropic/claude-sonnet-4` | `deepseek/deepseek-chat`, `openai/gpt-4o` |
| quick-chat | `google/gemini-2.5-flash` | `deepseek/deepseek-chat`, `openai/gpt-4o` |
| summarization | `anthropic/claude-sonnet-4` | `google/gemini-2.5-flash`, `deepseek/deepseek-chat` |
| vision | `anthropic/claude-sonnet-4` | `openai/gpt-4o` |
| tool-use | `anthropic/claude-sonnet-4` | `openai/gpt-4o` |
| workflow | `anthropic/claude-sonnet-4` | `openai/gpt-4o` |

## 3. Files Updated

### Core routing

- `apps/desktop/src/main/ai/model-router.ts`
- `apps/desktop/src/main/ipc/ai.ipc.ts`
- `apps/desktop/src/main/infrastructure/workflow-engine.ts`

### Provider plumbing

- `apps/desktop/src/main/ai/providers/base.ts`
- `apps/desktop/src/main/ai/providers/openrouter.ts`
- `apps/desktop/src/main/ai/agent-loop.ts`

### Validation

- `apps/desktop/tests/unit/model-router.test.ts`
- `apps/desktop/tests/unit/openrouter-provider.test.ts`

## 4. Validation Completed

The following checks passed after implementation:

- `npm run typecheck:node`
- `npx eslint src/main/ai/model-router.ts src/main/ai/agent-loop.ts src/main/ai/providers/base.ts src/main/ai/providers/openrouter.ts src/main/ipc/ai.ipc.ts src/main/infrastructure/workflow-engine.ts tests/unit/model-router.test.ts tests/unit/openrouter-provider.test.ts`
- `npx vitest run tests/unit/model-router.test.ts tests/unit/openrouter-provider.test.ts tests/unit/app-detector.test.ts`

## 5. Design Notes

The original guide mentions Vercel AI SDK 6 as the long-term direction. That specific provider layer change has not been applied in this implementation because the local project rule currently says to remain OpenRouter-only unless the user explicitly requests a provider architecture change.

Instead, this implementation completes the routing behavior inside the existing OpenRouter architecture:

- intent-based model selection
- shared routing between normal chat and workflow AI decisions
- model failover arrays passed through the provider

This keeps the work aligned with the current repository rules while still delivering the multi-model routing behavior needed by the product.

## 6. Remaining Gaps

The following are still out of scope for Task I:

- local offline model fallback via Ollama or `node-llama-cpp`
- embedding route separation for local versus cloud embedding providers
- provider-level migration to Vercel AI SDK 6
- route telemetry surfaced in the renderer UI

Those items should be treated as follow-up work, not blockers for the current multi-model routing implementation.
