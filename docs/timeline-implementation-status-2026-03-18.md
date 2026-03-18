# Agent Timeline Implementation Status

Date: 2026-03-18
Scope: `D: Agent Timeline`
Status: Implemented

## Summary

The new Agent Timeline UI is implemented as a standalone renderer component set under `apps/desktop/src/renderer/src/components/agent/`.
It reinterprets existing chat history and streaming state as execution steps rather than chat bubbles, matching the product requirement that the execution view becomes the main content area.

## Implemented Components

- `Timeline.tsx`
  - Renders execution steps, summary badges, empty state, retry affordance, and approval entry points.
- `StepItem.tsx`
  - Renders one timeline step with status icon, detail preview, duration, timestamp, and inline approval support.
- `ApprovalCard.tsx`
  - Renders approve/reject controls for actions that require user confirmation.
- `timeline-state.ts`
  - Converts `ChatMessage[]` plus streaming state into timeline step data.
- `index.ts`
  - Exposes the public component and helper surface for later page integration.

## State Coverage

The implementation supports all required timeline states:

- `completed`
- `running`
- `awaiting`
- `failed`
- `pending`

The mapper also supports:

- tool call to step creation
- tool result to completion or failure update
- streaming tool execution state
- streaming response generation state
- waiting and thinking placeholder states
- inline approval request insertion

## i18n and Accessibility

Added translation keys for:

- timeline headings and empty state
- status labels
- detail labels
- approval labels
- streaming step labels

Accessibility coverage includes:

- labeled timeline region
- `aria-busy` during active execution
- `aria-live` updates for streamed steps
- keyboard-accessible approval controls
- dedicated axe regression coverage

## Tests

Added and passed:

- `apps/desktop/tests/unit/timeline-state.test.ts`
- `apps/desktop/tests/unit/timeline.test.tsx`
- `apps/desktop/tests/a11y/timeline.a11y.test.tsx`

Also updated:

- `apps/desktop/tests/unit/i18n-visible-helpers.ts`

## Validation

Validated on 2026-03-18 with:

- `npm run typecheck`
- `npx vitest run tests/unit/timeline-state.test.ts tests/unit/timeline.test.tsx`
- `npx vitest run tests/a11y/timeline.a11y.test.tsx`
- `npx eslint src/renderer/src/components/agent/ApprovalCard.tsx src/renderer/src/components/agent/StepItem.tsx src/renderer/src/components/agent/Timeline.tsx src/renderer/src/components/agent/timeline-state.ts src/renderer/src/components/agent/index.ts tests/unit/timeline-state.test.ts tests/unit/timeline.test.tsx tests/a11y/timeline.a11y.test.tsx tests/unit/i18n-visible-helpers.ts`

## Deferred to the Next Task

`E: HomePage rewrite` still owns the full replacement of the legacy chat-bubble content area with the new Timeline + Composer layout.
This task intentionally stops at a production-ready standalone timeline component so the page-level rewrite remains isolated and sequential.
