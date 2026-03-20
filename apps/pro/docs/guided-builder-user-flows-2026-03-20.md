# Usan Guided Builder User Flows

Date: 2026-03-20  
Scope: `C:\Users\admin\Projects\usan\apps\pro`  
Related roadmap: `C:\Users\admin\Projects\usan\apps\pro\ROADMAP.md`  
Related shell spec: `C:\Users\admin\Projects\usan\apps\pro\docs\shell-spec-2026-03-20.md`

## 1. Purpose

This document turns "guided vibe coding for ordinary users" into concrete product flows.

It defines how a non-technical user should move from plain-language intent to a usable result without being forced into raw code too early.

## 2. Shared Flow Contract

Every guided builder flow should follow the same macro structure:

1. entry
2. intake
3. clarification
4. plan
5. preview
6. revise
7. checkpoint
8. export or share

The system must avoid jumping straight from prompt to opaque generation when the task is ambiguous.

## 3. Shared Builder Rules

- plain-language entry first
- plan before full build when scope is unclear
- preview before technical detail
- easy edits before raw code edits
- checkpoint and rollback are visible product features
- failures must explain recovery, not only what broke

## 4. Flow A: Simple Public-Facing Page

### Typical user intent

- "Make a landing page for my cafe."
- "Create a simple event signup page."
- "I need a product page for my service."

### Primary success condition

The user reaches a visually understandable preview in the first serious session.

### Step-by-step flow

#### Entry

User starts from:

- a home prompt
- a starter template
- a quick action such as "Build a page"

#### Intake

System gathers:

- what the page is for
- audience
- sections needed
- tone or style
- whether a form or CTA is needed
- whether mobile layout matters

#### Clarification

If unclear, ask only the minimum:

- one or two questions
- visual preferences in plain language
- no framework jargon

#### Plan

System presents:

- page goal
- sections it will create
- assumptions
- what the first preview will include

#### Preview

User sees:

- live or static preview surface
- section outline
- quick change actions such as:
  - make it more modern
  - add testimonials
  - make the hero smaller

#### Revise

User can revise through:

- natural language
- quick actions
- template swaps
- targeted visual edits

#### Checkpoint

System creates named milestones such as:

- first preview
- revised layout
- final copy pass

#### Export or share

Possible outputs:

- code bundle
- static HTML
- shareable preview
- deployment handoff guidance

### Failure recovery

Required states:

- preview failed to render
- generated layout is low quality
- assets missing
- mobile layout broken

The UI must offer:

- retry preview
- revert to prior checkpoint
- regenerate this section only
- open details for advanced users

## 5. Flow B: Internal Tool, Form, or Dashboard

### Typical user intent

- "Make an admin dashboard for customer inquiries."
- "I need a form to collect internal requests."
- "Build a simple tracker for invoices."

### Primary success condition

The user reaches a usable structure with actions and data shape visible, not only a pretty mockup.

### Step-by-step flow

#### Entry

User starts from:

- "Build an internal tool"
- "Build a form"
- "Build a dashboard"

#### Intake

System gathers:

- who uses the tool
- what records exist
- what actions users need
- what fields matter
- whether there are approvals, export needs, or status changes

#### Clarification

If needed, ask:

- what are the primary records
- what should users create, edit, filter, or export
- what is the one most important screen

#### Plan

System presents:

- data objects
- primary screens
- actions
- assumptions
- what the first preview will simulate

#### Preview

User sees:

- table, form, dashboard, or workflow preview
- sample data
- information architecture
- obvious action paths

#### Revise

User can request:

- add filters
- simplify the form
- show totals
- add an approval status
- turn this table into cards

#### Checkpoint

Milestones should capture:

- first structure
- first usable screen
- revised workflow
- export-ready version

#### Export or share

Possible outputs:

- code bundle
- schema or JSON model
- requirements summary
- internal handoff package

### Failure recovery

Required states:

- data model unclear
- preview structurally wrong
- generated screen too complex
- builder assumptions mismatch user intent

The UI must offer:

- edit requirements
- revise only the current screen
- return to planning mode
- restore earlier structure

## 6. Flow C: Lightweight Workflow Automation

### Typical user intent

- "Make something that renames files automatically."
- "Build a workflow that summarizes a folder of documents every week."
- "Create a simple approval workflow."

### Primary success condition

The user understands trigger, action, and safety boundaries before anything side-effecting runs.

### Step-by-step flow

#### Entry

User starts from:

- "Build a workflow"
- "Automate a task"
- a starter template

#### Intake

System gathers:

- what starts the workflow
- what inputs are used
- what output or side effect should happen
- how often it runs
- whether approvals are required

#### Clarification

Ask only when needed:

- what file or event triggers it
- what should happen on failure
- whether it should run automatically or manually first

#### Plan

System presents:

- trigger
- steps
- outputs
- risky side effects
- checkpoints requiring approval

#### Preview

User sees:

- dry-run simulation
- sample inputs and outputs
- explicit risk summary

#### Revise

User can request:

- add a review step
- run only manually
- save a copy instead of overwriting
- notify me on failure

#### Checkpoint

Milestones should capture:

- dry-run ready
- approval-safe version
- first validated run

#### Export or share

Possible outputs:

- workflow definition
- step summary
- automation package
- reviewable runbook

### Failure recovery

Required states:

- simulation failed
- required tool unavailable
- approval denied
- unsafe action blocked
- rollback unavailable

The UI must offer:

- safe retry
- edit workflow plan
- remove dangerous step
- convert to manual review flow

## 7. Shared Preview Contract

Every builder flow needs a preview surface that answers:

- what is being built
- what the current version looks like
- what changed since the last checkpoint
- whether the preview is healthy, partial, or broken

Preview is successful only if a non-technical user can understand it without reading logs first.

## 8. Shared Artifact Contract

Every builder flow must also generate durable artifacts.

Required artifact classes:

- plan artifact
- preview metadata artifact
- revision history artifact
- export artifact
- failure or recovery artifact when relevant

These artifacts should remain queryable after restart.

## 9. Shared Failure Recovery Contract

Every flow must define:

- retry path
- edit path
- rollback path
- escalation path for advanced users

Advanced detail is allowed, but it must be secondary to the plain-language recovery action.

## 10. Acceptance Tests

- A first-time user can choose a builder template and understand what will happen next
- The system asks clarifying questions only when necessary
- The plan is visible before high-effort generation
- A preview appears before the user is forced to inspect raw code
- The user can revise via plain-language requests
- At least one checkpoint is visible and restorable
- Export or share options are understandable to a non-technical user
- Failure states explain the next safe action

## 11. Research Inputs

External references:

- v0 docs:
  - `https://v0.app/docs`
- Replit build with AI:
  - `https://docs.replit.com/getting-started/quickstarts/build-with-ai`
- Replit checkpoints and rollbacks:
  - `https://docs.replit.com/replitai/checkpoints-and-rollbacks`
- Replit design mode:
  - `https://docs.replit.com/replitai/design-mode`
- Lovable publish:
  - `https://docs.lovable.dev/features/publish`

Local references:

- `D:\AI-Apps\_extracted\08-onboarding-tutorial-patterns.tsx`
- `D:\AI-Apps\_extracted\09-dashboard-ui-patterns.tsx`
- `D:\AI-Apps\_extracted\Linear`
- `D:\AI-Apps\_extracted\Notion`
