# Usan Shell Specification

Date: 2026-03-20  
Scope: `C:\Users\admin\Projects\usan\apps\pro`  
Related roadmap: `C:\Users\admin\Projects\usan\apps\pro\ROADMAP.md`  
Related audit: `C:\Users\admin\Projects\usan\apps\pro\docs\ui-ux-reference-audit-2026-03-20.md`

## 1. Purpose

This document defines the desktop shell contract for Usan.

It exists to prevent three common failures:

- the product becoming a transcript-only chat app
- new features inventing their own layout and state language
- beginner-friendly UI and power-user depth drifting into separate products

## 2. Shell Goals

The shell must make these things obvious at all times:

- where the user is
- what work is active
- what is running
- where the result appears
- what is risky
- what can be resumed

The shell must remain coherent as users move from:

- first-run guided use
- repeated document and file work
- guided builder and preview flows
- advanced artifact, diff, log, and automation use

## 3. Canonical Zones

Usan should use one stable shell with named zones.

### Z1. Title Bar

Purpose:

- window drag region
- app identity
- active workspace or session identity
- global entry points for launcher, history, search, settings, and window controls

Rules:

- height: `40px`
- the drag region must never overlap interactive controls
- global shell actions live here, not inside random page headers
- the title should reflect the active session, workspace, or builder task

### Z2. Primary Navigation

Purpose:

- top-level destinations
- current location
- fast switching between primary product modes

Default shape:

- compact rail: `56px`
- expanded navigation: `224px` to `240px`

Rules:

- keep the number of top-level destinations low
- use icons plus labels when expanded
- if the rail exists, active state must remain visible in both compact and expanded modes
- settings can live in the footer area

### Z3. Work List / Session Surface

Purpose:

- recent work
- pinned work
- resumable sessions
- builder tasks in progress

Default shape:

- default width: `280px`
- minimum width: `240px`
- maximum width: `340px`

Rules:

- searchable
- status visible at a glance
- pin, recent, and resumable states should be visible without opening a detail modal
- if space becomes constrained, this zone collapses later than the context panel but earlier than the main workspace

### Z4. Main Workspace

Purpose:

- dominant reading, editing, planning, or execution surface

Rules:

- minimum width: `640px`
- one dominant content type at a time
- if a preview is the main task, the preview becomes the dominant surface
- if a result artifact is the main task, the artifact surface becomes dominant
- avoid stacked nested cards that make the product feel like a dashboard site

### Z5. Context Panel

Purpose:

- references
- memories
- resources
- model or build parameters
- builder metadata
- structured side information that supports the main task

Default shape:

- default width: `320px`
- minimum width: `280px`
- maximum width: `420px`

Rules:

- dismissible
- resizable
- opens in place without reflowing the entire shell unpredictably
- should be secondary to the main workspace, never visually heavier

### Z6. Utility Panel

Purpose:

- run steps
- terminal output
- logs
- approvals
- artifact provenance
- failure details

Default shape:

- default height: `260px`
- minimum height: `180px`
- maximum height: `420px`

Rules:

- preferably bottom-docked
- preserves open state across related actions
- tabs or segmented switching are allowed inside this panel
- long-running work should prefer this panel over repeated toasts

### Z7. Composer

Purpose:

- task input
- follow-up input
- attachment intake
- model or mode selection
- send, stop, and approval-aware actions

Default shape:

- collapsed height: `76px` to `88px`
- expanded height with attachments: `120px` to `220px`

Rules:

- remains in a consistent position across chat-heavy and builder-heavy workflows
- does not disappear when the user opens logs, artifacts, or previews
- must support both simple prompt entry and guided builder entry

### Z8. Global Overlays

Purpose:

- launcher
- command palette
- guided onboarding
- blocking approvals
- account and secret entry

Rules:

- only high-priority flows should use a true modal overlay
- overlays should not become the default place where product depth lives

## 4. Default Desktop Layout

Primary desktop layout:

- Z1 Title Bar across the top
- left side: Z2 Primary Navigation plus Z3 Work List
- center: Z4 Main Workspace
- right side: optional Z5 Context Panel
- bottom: optional Z6 Utility Panel
- bottom edge of Z4: Z7 Composer when the current workflow is prompt-driven

This means the center of gravity is always the workspace, not the navigation.

## 5. Adaptive Rules

These breakpoints are product rules, not browser breakpoints.

### Large desktop: `1440px and above`

- Z2 expanded
- Z3 visible
- Z5 visible when useful
- Z6 can remain docked without harming the main workspace

### Standard laptop desktop: `1180px to 1439px`

- Z2 expanded or compact depending on context
- Z3 visible
- Z5 collapses first when width becomes tight
- Z6 remains available but may default closed

### Minimum supported desktop width: `1024px to 1179px`

- Z2 compact preferred
- Z3 still available, but may become overlay or narrower
- Z5 closed by default
- Z6 opens on demand

### Below supported desktop width: under `1024px`

- the app may remain usable but is no longer considered layout-complete for production acceptance

## 6. Collapse Order

When horizontal space becomes constrained, collapse in this order:

1. close Z5 Context Panel
2. compact Z2 Primary Navigation
3. narrow Z3 Work List within its minimum width
4. move secondary controls into command surfaces or overflow
5. never collapse Z4 below its minimum supported reading width without explicit responsive design work

When vertical space becomes constrained, collapse in this order:

1. shrink Z6 Utility Panel
2. shrink Z7 Composer to its minimum non-broken state
3. reduce non-essential header spacing
4. never hide critical state visibility for running work, approval requests, or result availability

## 7. Title Bar Specification

The title bar is not branding chrome only. It is a shell control surface.

Required areas:

- left:
  - optional back or pane toggle
  - workspace identity or destination breadcrumb
- center:
  - active session, task, or builder label
- right:
  - launcher or command search
  - history or recent
  - settings
  - window controls

Rules:

- all interactive controls use `no-drag`
- the title bar drag region fills only the unused space between controls
- no decorative gradients behind controls
- state badges should be subtle and operational, not marketing-styled

## 8. State Visibility Contract

These states must be visually distinct without hover:

- idle
- selected
- focused
- running
- paused
- waiting for approval
- succeeded
- partial success
- failed
- disabled

Minimum visual rule:

- selection uses at least two signals
- keyboard focus never relies on color alone
- running work must be identifiable from the shell even if the user is not staring at the transcript

## 9. Preview vs Artifact Contract

Preview and artifact are related, but they are not the same.

### Preview

Use when the user needs to inspect a live or visual result quickly.

Examples:

- generated page preview
- generated form preview
- rendered UI draft
- simulated workflow result

### Artifact

Use when the result must be saved, compared, exported, or audited.

Examples:

- markdown output
- code bundle
- diff
- JSON result
- exported document
- structured plan

Rule:

- preview should optimize for quick visual understanding
- artifact should optimize for durability, comparison, provenance, and export

## 10. Keyboard Model

Required first-class shortcuts:

- command palette
- launcher
- new session or new builder task
- session switching
- search within work list or sessions
- send
- stop
- open artifact
- toggle utility panel
- open settings

Rules:

- shortcuts must be discoverable in the UI
- mouse-only users must still succeed
- the keyboard path should become faster than the mouse path for returning users

## 11. Guided Builder Shell Rules

When the user is building something, the shell changes emphasis but not identity.

Rules:

- the same shell remains in place
- Z4 becomes plan, preview, or revision workspace
- Z5 shows structured builder context
- Z6 shows run steps, install logs, validation, and failure recovery
- Z7 remains the main input surface unless the task enters a blocking approval or secret-entry state

Do not create a separate "builder app inside the app."

## 12. Failure Recovery Surfaces

These failures require first-class UI states, not transcript-only explanations:

- preview failed
- dependency install failed
- build timed out
- generated app is broken
- export failed
- rollback available
- rollback unavailable

Each failure state must expose:

- what failed
- what succeeded
- next safe action
- whether retry is safe
- whether rollback is available

## 13. Acceptance Checklist

- Title bar controls and drag regions do not conflict
- Primary navigation is readable in both compact and expanded states
- Work list remains useful, not decorative
- Main workspace never feels secondary to navigation
- Context panel and utility panel can open without causing shell confusion
- Composer remains spatially stable across core workflows
- Preview and artifact are clearly different surfaces
- Running, failed, and approval-pending states are visible from outside the transcript
- The shell still works with long titles, long file names, large logs, and slow streams

## 14. Research Inputs

External references:

- Microsoft NavigationView:
  - `https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/navigationview`
- Microsoft TeachingTip:
  - `https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/dialogs-and-flyouts/teaching-tip`
- Microsoft CommandBar:
  - `https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/command-bar`

Local references:

- `D:\AI-Apps\_extracted\Linear`
- `D:\AI-Apps\_extracted\Notion`
- `D:\AI-Apps\_extracted\AutoClaw`
- `D:\AI-Apps\_extracted\08-onboarding-tutorial-patterns.tsx`
- `D:\AI-Apps\_extracted\09-dashboard-ui-patterns.tsx`
- `D:\AI-Apps\_extracted\14-framer-effects.css`
- `D:\AI-Apps\_extracted\15-resend-effects.css`
