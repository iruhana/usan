# Usan Preview and Artifact Contract

Date: 2026-03-20  
Scope: `C:\Users\admin\Projects\usan\apps\pro`  
Related roadmap: `C:\Users\admin\Projects\usan\apps\pro\ROADMAP.md`  
Related shell spec: `C:\Users\admin\Projects\usan\apps\pro\docs\shell-spec-2026-03-20.md`

## 1. Purpose

This document separates two concepts that often get blurred in AI products:

- preview
- artifact

Usan must treat them as related but distinct surfaces.

If this distinction is weak, the product will regress into transcript-first UX.

## 2. Definitions

### Preview

A preview is a fast inspection surface that helps the user understand the current result visually or interactively.

Examples:

- page preview
- form preview
- dashboard preview
- rendered UI mock
- simulated workflow output

Preview is for:

- understanding
- iteration
- fast comparison
- confidence before export or apply

### Artifact

An artifact is a durable result entity that can be stored, compared, versioned, exported, or audited.

Examples:

- plan document
- markdown report
- generated code bundle
- JSON payload
- diff
- export package
- run summary

Artifact is for:

- persistence
- provenance
- review
- export
- rollback
- compliance or auditability

## 3. Product Rule

Usan should not treat "whatever the model produced" as a single output type.

Instead:

- preview answers "what does the current result look like"
- artifact answers "what durable thing was produced"

## 4. When To Use Each

### Use preview when

- the user needs visual or structural understanding first
- the result is still evolving
- the user wants fast iteration
- a non-technical user is still shaping the output

### Use artifact when

- the result should survive restart
- the result must be compared or exported
- the result should be reviewed by another person
- the result may be applied, approved, or rolled back

### Use both when

- the user is building a page, tool, or workflow
- the user is reviewing generated changes
- the system is producing a visually inspectable result and a durable output at the same time

## 5. Canonical Output Pairs

| Task type | Preview | Artifact |
| --- | --- | --- |
| Landing page | rendered page preview | code bundle + versioned plan |
| Internal tool | screen or data preview | schema + code + revision history |
| Workflow automation | dry-run simulation | workflow definition + run summary |
| Document rewrite | formatted content preview | saved markdown or document export |
| File transformation | sample transformed output | export package + change log |
| Code change | rendered diff preview | patch or file bundle |

## 6. Surface Rules

### Preview surface rules

- should load fast
- should be visually primary when iteration is the main task
- should support lightweight revise actions
- should clearly indicate whether it is:
  - healthy
  - partial
  - stale
  - failed

### Artifact surface rules

- should have explicit identity
- should expose timestamp and provenance
- should support rename, compare, export, and reopen
- should not disappear just because the preview changed

## 7. Storage Rules

Preview does not need to be fully durable in the same way as an artifact.

Required storage behavior:

- preview state may be transient or cacheable
- artifacts must be durable
- preview metadata should point back to the artifact or checkpoint it was derived from
- every significant artifact must be linked to a session and run context

## 8. Revision Rules

### Preview revision

Fast and lightweight:

- change copy
- adjust layout
- revise structure
- regenerate one section

### Artifact revision

Durable and explicit:

- create a new version
- compare against prior artifact
- restore prior checkpoint
- export a chosen version

## 9. Failure Rules

Preview and artifact failures must be different states.

### Preview failure

Examples:

- preview renderer crashed
- dependency missing for visual render
- current result cannot be displayed

Recovery actions:

- retry preview
- fall back to simplified preview
- open details
- restore previous checkpoint

### Artifact failure

Examples:

- result could not be saved
- export failed
- durable version could not be written

Recovery actions:

- retry save
- export alternate format
- inspect storage issue
- keep working copy but mark the artifact as unsaved

## 10. UX Copy Rules

Use:

- Preview
- Live preview
- Current version
- Saved result
- Export
- Compare versions

Avoid mixing labels such as:

- output
- result
- artifact
- preview

for the same action in the same screen.

## 11. Acceptance Checklist

- Every builder flow exposes a preview when visual understanding matters
- Every meaningful result creates a durable artifact when persistence matters
- Preview can fail without destroying artifact history
- Artifact save can fail without hiding the current working state
- Users can understand the difference between "current preview" and "saved result"
- Preview-first flows do not force non-technical users into code or logs too early

## 12. Research Inputs

External references:

- v0 docs:
  - `https://v0.app/docs`
- Replit design mode:
  - `https://docs.replit.com/replitai/design-mode`
- Replit checkpoints and rollbacks:
  - `https://docs.replit.com/replitai/checkpoints-and-rollbacks`

Local references:

- `D:\AI-Apps\_extracted\09-dashboard-ui-patterns.tsx`
- `D:\AI-Apps\_extracted\Linear`
- `D:\AI-Apps\_extracted\Notion`
