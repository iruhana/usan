# Security Architecture Implementation Status

Date: 2026-03-18
Status: Initial Task K scope implemented
Owner: Codex

## Summary

Task K is now implemented for the agent and workflow execution path in the desktop app.

The security layer now enforces:

- 4-tier tool privilege rings
- prompt-injection scanning for user input, tool arguments, tool output, and RAG context
- Ed25519 session identities for agent and workflow sessions
- time-bound capability tokens
- explicit ring 3 approval flow with staged session capabilities
- append-only SQLite audit logging for tool executions

## Implemented Components

### 1. Central security runtime

Added `apps/desktop/src/main/security/` with the following modules:

- `types.ts`
- `rings.ts`
- `prompt-guard.ts`
- `agent-identity.ts`
- `capability-tokens.ts`
- `audit-log.ts`
- `security-runtime.ts`
- `index.ts`

Key behavior:

- Ring 0: read-only metadata and status tools
- Ring 1: low-risk read operations
- Ring 2: write and side-effect operations gated by scoped approval
- Ring 3: destructive/system/automation actions gated by explicit capability approval every time

### 2. Prompt-injection defense

`prompt-guard.ts` now blocks or sanitizes:

- instruction override attempts
- prompt extraction attempts
- role hijacking
- credential exfiltration attempts
- dangerous command payloads
- encoded payload bursts
- invisible control-character smuggling

The guard is applied to:

- user input before agent execution
- tool arguments before tool execution
- tool output before it is returned to the model
- RAG chunks before they are injected into the system prompt

### 3. Capability model

The runtime now creates an Ed25519 identity per agent/workflow session and issues signed capability tokens.

Two approval paths are implemented:

- Ring 2: auto-issued short-lived session capability after tool grant or directory grant
- Ring 3: explicit manual approval via staged session capability

The manual approval path is exposed through a new IPC surface:

- `permissions:issue-capability`

Renderer access was added through:

- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/shared/constants/channels.ts`
- `apps/desktop/src/shared/types/ipc.ts`
- `apps/desktop/src/shared/types/permissions.ts`

This closes the earlier gap where ring 3 tools were blocked correctly but had no first-class approval route.

### 4. Permission model hardening

The permissions store no longer defaults to implicit full access.

Additional improvements:

- directory-scoped grants added to the shared permission model
- grant/revoke flows invalidate the tool-catalog permission cache immediately
- startup and revoke flows no longer reintroduce automatic full access

Main files:

- `apps/desktop/src/shared/types/permissions.ts`
- `apps/desktop/src/main/store.ts`
- `apps/desktop/src/main/ipc/index.ts`
- `apps/desktop/src/main/ai/tool-catalog.ts`

### 5. Audit logging

Tool execution audits are persisted to SQLite via `security_audit_log`.

Protections implemented:

- append-only table semantics
- update trigger blocked
- delete trigger blocked
- secret redaction in serialized request/response payloads
- in-memory recent audit buffer for quick inspection

Main files:

- `apps/desktop/src/main/security/audit-log.ts`
- `apps/desktop/src/main/db/database.ts`
- `apps/desktop/src/main/index.ts`

### 6. Agent and workflow integration

Security enforcement is now active in:

- `apps/desktop/src/main/ai/agent-loop.ts`
- `apps/desktop/src/main/infrastructure/workflow-engine.ts`
- `apps/desktop/src/main/ai/tool-catalog.ts`

This includes:

- session creation/destruction
- prompt scanning before execution
- RAG chunk filtering
- capability-aware tool authorization
- audit emission for blocked, failed, completed, and sanitized tool calls

## Validation

Passed:

- `npx vitest run tests/unit/prompt-guard.test.ts tests/unit/security-runtime.test.ts tests/unit/security-audit.test.ts tests/unit/permissions-model.test.ts`
- `npx eslint src/main/security/*.ts src/main/ai/tool-catalog.ts src/main/ai/agent-loop.ts src/main/infrastructure/workflow-engine.ts src/main/ipc/index.ts src/main/db/database.ts src/shared/types/permissions.ts src/shared/types/ipc.ts src/shared/constants/channels.ts src/preload/index.ts tests/unit/prompt-guard.test.ts tests/unit/security-runtime.test.ts tests/unit/security-audit.test.ts tests/unit/permissions-model.test.ts`

Added or updated tests:

- `apps/desktop/tests/unit/prompt-guard.test.ts`
- `apps/desktop/tests/unit/security-runtime.test.ts`
- `apps/desktop/tests/unit/security-audit.test.ts`
- `apps/desktop/tests/unit/permissions-model.test.ts`

Type-check note:

- targeted `tsc` runs still surface pre-existing document-engine dependency issues in `src/main/documents/docx-engine.ts`, `src/main/documents/pdf-engine.ts`, and `src/main/documents/xlsx-engine.ts`
- those errors are unrelated to Task K and were already present before this security pass

## Remaining Follow-up

Task K is complete for the agent/workflow/tool-execution path.

Remaining broader hardening work outside this task:

- migrate more legacy direct renderer IPC handlers onto the central security runtime so they use the same ring/capability/audit path as AI tool calls
- resolve missing document-engine dependencies so full `typecheck:node` can run cleanly
