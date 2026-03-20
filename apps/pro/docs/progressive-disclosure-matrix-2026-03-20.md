# Usan Progressive Disclosure Matrix

Date: 2026-03-20  
Scope: `C:\Users\admin\Projects\usan\apps\pro`  
Related roadmap: `C:\Users\admin\Projects\usan\apps\pro\ROADMAP.md`  
Related shell spec: `C:\Users\admin\Projects\usan\apps\pro\docs\shell-spec-2026-03-20.md`  
Related guided builder flows: `C:\Users\admin\Projects\usan\apps\pro\docs\guided-builder-user-flows-2026-03-20.md`

## 1. Purpose

This matrix defines how Usan reveals power over time without overwhelming first-time users.

It exists to prevent two failure modes:

- beginner users seeing too much complexity too early
- power users feeling trapped in an oversimplified interface

## 2. Principle

Usan should not have separate "beginner mode" and "pro mode" products.

Instead, it should reveal depth through:

- time
- success milestones
- context
- explicit user intent
- failure states that justify deeper controls

## 3. User Stages

### Stage A: First Launch

User characteristics:

- little or no product knowledge
- unclear mental model
- high sensitivity to jargon

Design goal:

- obvious first action
- low vocabulary burden
- no clutter from advanced systems

### Stage B: First Successful Session

User characteristics:

- completed at least one meaningful task
- beginning to trust the shell

Design goal:

- reinforce success
- reveal next useful depth
- show history and recovery value

### Stage C: Returning Builder or Operator

User characteristics:

- repeated use
- wants speed
- can handle more structured controls

Design goal:

- increase efficiency
- reduce clicks
- expose reusable commands and history

### Stage D: Power User

User characteristics:

- actively wants control
- comfortable with logs, diffs, tools, settings, and automation

Design goal:

- maximize depth without breaking shell clarity

## 4. Visibility Levels

Use these visibility labels consistently.

- Always visible
- Secondary visible
- Reveal after first success
- Reveal on demand
- Reveal on failure or risk
- Advanced settings only

## 5. Surface Matrix

| Surface or capability | Stage A | Stage B | Stage C | Stage D |
| --- | --- | --- | --- | --- |
| Home prompt or builder entry | Always visible | Always visible | Always visible | Always visible |
| Starter templates | Always visible | Always visible | Secondary visible | Reveal on demand |
| Example prompts | Always visible | Secondary visible | Reveal on demand | Reveal on demand |
| Command palette | Secondary visible | Always visible | Always visible | Always visible |
| Recent sessions | Secondary visible | Always visible | Always visible | Always visible |
| Pinned work | Hidden | Reveal after first success | Always visible | Always visible |
| Preview surface | Always visible when building | Always visible when building | Always visible when building | Always visible when building |
| Artifact viewer | Secondary visible | Always visible when result exists | Always visible | Always visible |
| Diff viewer | Hidden | Reveal after first generated change | Always visible when relevant | Always visible when relevant |
| Logs and terminal | Hidden | Reveal on failure or explicit action | Secondary visible | Always visible when relevant |
| Run steps | Hidden | Reveal on active execution | Always visible when relevant | Always visible when relevant |
| Approval details | Reveal on risk only | Reveal on risk only | Always visible when relevant | Always visible when relevant |
| Context panel | Hidden by default | Reveal after first success | Secondary visible | Always visible when relevant |
| Model picker | Secondary visible | Secondary visible | Always visible | Always visible |
| Local models | Hidden | Reveal on demand | Secondary visible | Always visible when configured |
| MCP tools | Hidden | Hidden | Reveal on demand | Advanced settings only or explicit tool intent |
| Automation builder | Hidden | Hidden | Reveal on demand | Always visible when relevant |
| Raw code view | Hidden | Reveal on demand | Secondary visible | Always visible when relevant |

## 6. Unlock Triggers

### Time-based triggers

- after first successful artifact
- after second serious session
- after repeated use of a builder template

### Context-based triggers

- user opens command palette more than once
- user asks for revision, export, or rollback
- user asks "show details", "show code", or similar

### Failure-based triggers

- preview fails
- build fails
- risky action needs approval
- export fails
- generated result is structurally broken

### Intent-based triggers

- user explicitly asks for advanced control
- user opens settings related to tools, models, or automation
- user chooses an advanced template

## 7. Terminology Matrix

### Stage A wording

Prefer:

- Build
- Preview
- Make changes
- Recent work
- Details
- Safer option

Avoid by default:

- artifact
- diff
- MCP
- provider routing
- capability manifest
- schema migration

### Stage B wording

Introduce carefully:

- Version
- Compare changes
- History
- Approval
- Export

### Stage C and D wording

Acceptable when context supports it:

- artifact
- diff
- logs
- resources
- local model
- MCP server
- automation trigger

## 8. Panel Escalation Rules

### Context panel

Should auto-suggest itself only when:

- the builder flow benefits from visible assumptions or parameters
- the user is revising an existing result
- the task references files, memory, or prior work

### Utility panel

Should auto-open when:

- a run enters an approval state
- a build or preview fails
- a long-running step exceeds normal latency expectations

Should stay closed by default when:

- the task is simple and successful
- the extra detail would distract from the main result

## 9. Builder Escalation Rules

The builder should reveal depth in this order:

1. natural-language request
2. structured clarification
3. plan
4. preview
5. revision controls
6. checkpoints
7. export or share
8. code, logs, and deeper controls

The product should not jump from step 1 to step 8 unless the user explicitly asks for it.

## 10. Trust Escalation Rules

### Always visible trust signals

- task is running
- task completed
- task failed
- approval needed

### Reveal when relevant

- exact tool used
- run steps
- changed files
- detailed approval reason

### Advanced only

- provider internals
- model fallback policy
- MCP server internals
- automation configuration detail

## 11. Anti-Regressions

Do not allow the product to regress into:

- hiding core actions behind advanced vocabulary
- using the transcript as the only place where important state appears
- forcing advanced panels open for simple tasks
- burying recovery actions inside logs
- adding new feature surfaces without assigning them a disclosure stage

## 12. Acceptance Checklist

- A first-time user can complete a basic task without seeing unnecessary technical jargon
- A second-session user can discover history, command palette, and checkpoints naturally
- Returning users can reach faster paths without losing the simple path
- Failure states reveal the right amount of detail instead of either hiding everything or dumping internals immediately
- Every major surface has an explicit disclosure level

## 13. Research Inputs

External references:

- Microsoft TeachingTip:
  - `https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/dialogs-and-flyouts/teaching-tip`
- Raycast Teams:
  - `https://www.raycast.com/blog/bringing-raycast-to-teams`
- Linear command menu:
  - `https://linear.app/changelog/2019-12-18-new-command-menu`

Local references:

- `D:\AI-Apps\_extracted\08-onboarding-tutorial-patterns.tsx`
- `D:\AI-Apps\_extracted\09-dashboard-ui-patterns.tsx`
- `D:\AI-Apps\_extracted\Notion`
- `D:\AI-Apps\_extracted\Linear`
