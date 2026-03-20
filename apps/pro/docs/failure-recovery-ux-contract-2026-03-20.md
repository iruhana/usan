# Usan Failure Recovery UX Contract

Date: 2026-03-20  
Scope: `C:\Users\admin\Projects\usan\apps\pro`  
Related roadmap: `C:\Users\admin\Projects\usan\apps\pro\ROADMAP.md`

## 1. Purpose

This document defines how Usan should behave when work fails, partially fails, stalls, or becomes risky.

The product should not treat failure as a console detail. Failure recovery is part of the core UX.

## 2. Recovery Principles

- explain what failed in plain language first
- show what still succeeded
- offer the next safe action immediately
- expose deeper technical detail only as secondary depth
- preserve user trust by making rollback and retry explicit

## 3. Recovery Categories

### Category A: Input and intent problems

Examples:

- request is too vague
- required file missing
- prompt contradicts itself

Primary recovery actions:

- clarify request
- reattach file
- adjust builder assumptions

### Category B: Provider and generation problems

Examples:

- provider timeout
- stream interrupted
- malformed output

Primary recovery actions:

- retry
- switch provider or model
- continue from last stable checkpoint

### Category C: Preview and render problems

Examples:

- preview failed
- generated UI cannot render
- dependency install blocked preview

Primary recovery actions:

- retry preview
- show simplified preview
- return to plan
- rollback preview state

### Category D: Artifact and export problems

Examples:

- save failed
- export failed
- generated bundle incomplete

Primary recovery actions:

- retry save
- choose another export format
- keep working state and mark as unsaved

### Category E: Risk and approval problems

Examples:

- destructive action blocked
- approval denied
- permission unavailable

Primary recovery actions:

- request approval
- choose safer alternative
- dry-run only
- edit plan to remove risk

## 4. State Requirements

Every recovery state must show:

- what failed
- what remained successful
- whether retry is safe
- whether rollback exists
- what the user can do next

Every recovery state may optionally show:

- tool details
- provider details
- logs
- raw error payload

## 5. Canonical Recovery Patterns

### Pattern 1: Inline recoverable error

Use when:

- the user can fix the problem without leaving the current flow

Examples:

- attachment missing
- builder clarification required

### Pattern 2: Utility-panel recovery

Use when:

- the task is still active or partially active
- logs or steps matter

Examples:

- install failed
- run step failed
- preview timed out

### Pattern 3: Artifact-level recovery

Use when:

- the result exists but is unhealthy

Examples:

- preview stale
- export failed
- artifact save failed

### Pattern 4: Blocking approval or stop state

Use when:

- continuing would cause a risky side effect

Examples:

- overwrite file
- execute automation
- post to external service

## 6. Builder-Specific Recovery States

The guided builder must define first-class recovery for:

- plan unclear
- preview unavailable
- generated output is broken
- generated output is low quality
- checkpoint unavailable
- rollback unavailable

Each should give a plain-language next step such as:

- clarify the goal
- regenerate only this section
- return to the previous version
- use the safer option
- inspect details

## 7. Logs and Technical Detail

Technical detail should be layered.

Order of exposure:

1. plain-language summary
2. suggested next action
3. structured detail such as failed step, tool, or provider
4. raw logs

Do not dump raw logs first for mainstream users.

## 8. Retry Rules

Usan must indicate whether retry is:

- safe
- conditionally safe
- unsafe without approval

Safe retry examples:

- rerender preview
- retry export
- retry provider request

Conditionally safe examples:

- rerun build step that may overwrite cache or temp files

Unsafe retry examples:

- rerun destructive file operation
- rerun external posting action

## 9. Rollback Rules

Rollback should be visible when:

- a checkpoint exists
- a prior artifact exists
- a generated change can be reversed

Rollback must state:

- what it will restore
- what will be lost
- whether the action itself is reversible

## 10. UX Copy Examples

Preferred:

- Preview could not be generated. Try again or restore the previous version.
- Export failed, but your current work is still available.
- This step needs approval before it can change files.
- The build stopped after setup. You can retry safely.

Avoid:

- Error 500
- Failed
- Unexpected issue

without a recovery instruction.

## 11. Acceptance Checklist

- Every major failure state has a next safe action
- The UI distinguishes between preview failure, artifact failure, and approval blocking
- Retry safety is explicit
- Rollback availability is explicit
- Logs are available but not forced on first-time users
- A partially successful task still communicates what was preserved

## 12. Research Inputs

External references:

- Microsoft TeachingTip:
  - `https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/dialogs-and-flyouts/teaching-tip`
- Replit checkpoints and rollbacks:
  - `https://docs.replit.com/replitai/checkpoints-and-rollbacks`

Local references:

- `D:\AI-Apps\_extracted\08-onboarding-tutorial-patterns.tsx`
- `D:\AI-Apps\_extracted\15-resend-effects.css`
- `D:\AI-Apps\_extracted\AutoClaw`
