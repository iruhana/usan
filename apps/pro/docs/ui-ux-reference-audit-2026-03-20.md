# Usan UI/UX Reference Audit

Date: 2026-03-20  
Scope: `C:\Users\admin\Projects\usan\apps\pro`  
Related roadmap: `C:\Users\admin\Projects\usan\apps\pro\ROADMAP.md`

## 1. Purpose

This audit translates the broad UX intent in the roadmap into a concrete desktop-shell reference model.

The goal is not to copy another product. The goal is to decide:

- which desktop patterns should become canonical for Usan
- which extracted references are useful only as implementation hints
- which patterns should stay out of the daily work surface
- what must change in the current `apps/pro` shell before advanced features pile up on top of weak structure

## 2. Audit Method

This document combines four evidence sources:

1. Current `apps/pro` renderer structure and shell files
2. Local extracted desktop and design references under `D:\AI-Apps\_extracted`
3. External product and platform references
4. Baseline quality checks on the current app

## 3. Current `apps/pro` Baseline

### Current shell reality

The current renderer is closer to a styled chat client than to a full desktop workbench.

Observed files:

- `C:\Users\admin\Projects\usan\apps\pro\src\renderer\src\App.tsx`
- `C:\Users\admin\Projects\usan\apps\pro\src\renderer\src\components\sidebar\TitleBar.tsx`
- `C:\Users\admin\Projects\usan\apps\pro\src\renderer\src\components\sidebar\Sidebar.tsx`
- `C:\Users\admin\Projects\usan\apps\pro\src\renderer\src\components\sidebar\IconRail.tsx`
- `C:\Users\admin\Projects\usan\apps\pro\src\renderer\src\components\workspace\ClaudeWorkspace.tsx`
- `C:\Users\admin\Projects\usan\apps\pro\src\renderer\src\styles\globals.css`

What exists today:

- frameless custom title bar
- one fixed-width sidebar
- one single dominant chat workspace
- early design tokens in `globals.css`
- streaming chat and model picker
- inline tool cards inside the transcript

What is still missing at the shell level:

- a distinct session column or resumable work list
- a separate result surface for artifacts and previews
- a dedicated right context panel
- a persistent bottom utility panel for logs, terminal, approvals, and run steps
- a first-class command palette or launcher
- a visible builder flow for non-technical users
- a shell built from reusable primitives rather than mostly inline component styles

### Structural gap summary

The current app already points in the right direction, but it has a common early-product problem:

- too much responsibility lives inside one workspace component
- navigation, skills, history, and settings are still compressed into one left column
- the title bar is present, but not yet doing real desktop-shell work
- the user still experiences the product primarily as a transcript, not as a result-oriented workbench

### Baseline quality signal

Quick baseline run on 2026-03-20:

- `typecheck`: passed
- `build`: passed
- `lint`: missing script
- `test`: missing script

This supports the roadmap decision to keep Phase 0 focused on platform hardening and shell contracts before adding breadth.

## 4. Reference Shortlist

The extracted dataset is broad, but not all references are equally useful for Usan.

### Tier A: canonical desktop workbench references

These should directly influence shell structure and interaction rules.

- `D:\AI-Apps\_extracted\Linear`
- `D:\AI-Apps\_extracted\Notion`
- `D:\AI-Apps\_extracted\AutoClaw`
- `D:\AI-Apps\_extracted\09-dashboard-ui-patterns.tsx`
- `D:\AI-Apps\_extracted\08-onboarding-tutorial-patterns.tsx`

### Tier B: token and motion references

These are useful for polish, density, animation budgeting, and panel behavior.

- `D:\AI-Apps\_extracted\02-linear-grid-animations.css`
- `D:\AI-Apps\_extracted\04-raycast-effects.css`
- `D:\AI-Apps\_extracted\11-vercel-animations.css`
- `D:\AI-Apps\_extracted\13-supabase-animations.css`
- `D:\AI-Apps\_extracted\14-framer-effects.css`
- `D:\AI-Apps\_extracted\15-resend-effects.css`

### Tier C: anti-pattern references

These can be mined for isolated ideas, but should not define the daily desktop work surface.

- `D:\AI-Apps\_extracted\01-magic-ui-animations.css`
- `D:\AI-Apps\_extracted\03-aceternity-aurora-background.tsx`
- `D:\AI-Apps\_extracted\05-common-landing-effects.css`
- `D:\AI-Apps\_extracted\10-spotlight-effect.css`
- `D:\AI-Apps\_extracted\12-stripe-animations.css`

## 5. What Each Reference Contributes

### Linear

Use for:

- compact left navigation
- command-first interaction model
- dense but readable productivity spacing
- crisp active-state behavior
- restrained motion for panel and indicator changes

Key implication for Usan:

- the command palette should be central, not auxiliary
- the left shell should prioritize navigation clarity over decorative panels
- selection and active state must be legible without hover

### Notion desktop

Use for:

- workspace switch affordance
- show or hide sidebar behavior
- history navigation language
- desktop-level menu naming and command search wording

Key implication for Usan:

- title bar and app menus should own workspace, history, and shell visibility actions
- search should feel like a shell primitive, not a field embedded somewhere deep

### AutoClaw

Use for:

- persistence-oriented desktop architecture
- settings, history, gateway, and auth surface planning
- evidence that a desktop AI shell quickly accumulates operational complexity

Key implication for Usan:

- shell simplification must not hide the fact that history, settings, and state persistence become first-class product surfaces early

### Raycast-inspired patterns

Use for:

- shared commands
- quicklinks
- snippets
- day-one usefulness before advanced extensibility

Key implication for Usan:

- Usan should give non-technical users immediately useful starter actions and templates before asking them to understand deeper systems

### Dashboard, onboarding, drawer, and token extracts

Use for:

- sidebar collapse and expand rhythm
- command palette presentation
- onboarding checklist and guided-tour patterns
- drawer and collapsible panel animation
- tokenized shadows, borders, and surface hierarchy

Key implication for Usan:

- the app should feel like one controlled desktop shell, not a collection of unrelated animated widgets

## 6. Surface-by-Surface Audit

| Surface | Current `apps/pro` state | Best reference direction | Adopt for Usan | Avoid |
| --- | --- | --- | --- | --- |
| Title bar | Minimal identity + window controls | Notion desktop top bar, Windows desktop conventions | Active workspace, launcher/search entry, history, settings, clear drag zones | Decorative gradients, dead center branding with no shell utility |
| Left navigation | One 240px column mixing nav, skills, settings | Linear nav + Notion shell toggles | Separate rail and structured navigation or keep one sidebar but with named subzones | Endless mixed actions in one undifferentiated column |
| Session list | Not yet a first-class surface | Notion history thinking, Raycast fast search model | Searchable recent and pinned sessions, visible status | Hiding history behind secondary tabs |
| Main workspace | Transcript-centric | Result-first workbench layouts | One dominant reading or execution surface with clear context | Nested card stacks and web-like dashboard clutter |
| Result surface | Tool output is mostly inline in chat | Artifact, preview, and diff as separate surfaces | Dedicated artifact and preview area with provenance | Transcript-only artifacts |
| Context panel | Missing | Desktop split-pane tools, AutoClaw complexity hints | Right-side context for references, parameters, memories, build metadata | Modal-only context access |
| Utility panel | Missing | Resend drawer and collapsible motion, dashboard panel patterns | Stable bottom panel for logs, terminal, approvals, run steps | Toast-only status for long work |
| Command layer | Missing | Linear command menu, Raycast launcher mental model | Global palette and launcher with consistent ranking and shortcuts | Hidden one-off search fields everywhere |
| Onboarding | Missing | Checklist + one short guided tour | Lightweight, dismissible, task-oriented onboarding | Long modal tutorial walls, repeated blocking popups |
| Motion | Early tokens exist, but no unified system | Framer/Resend/Supabase motion budgeting | Short, hierarchy-revealing motion with reduced-motion fallback | Landing-page parallax, glow, or heavy blur around work content |
| Tokens | Seed token set exists | Framer/Vercel/Supabase token discipline | Semantic tokens shared across shell primitives | Inline colors and ad hoc shadows in every component |

## 7. Adopt, Adapt, Avoid

### Adopt

- command palette as a core shell primitive
- one stable shell with named zones
- compact productivity density
- visible active, selected, focused, running, and approval-pending states
- searchable history and recent work as a first-class surface
- preview-first builder flows
- checklist-style onboarding plus one short spotlight tour
- semantic token discipline
- drawer and split-panel interaction for context, logs, and artifacts

### Adapt

- Notion-style workspace switch and history language
- Raycast-style quick actions and quicklinks, but adapted for builder and workbench workflows
- Linear-like navigation density, but with more beginner-friendly labeling
- AutoClaw-like operational depth, but surfaced more progressively

### Avoid

- marketing-page animation patterns in daily work surfaces
- transcript-first UX once results, previews, or diffs exist
- modal-heavy onboarding
- large glowing backgrounds behind dense work
- hiding shell state inside hover-only affordances
- shipping advanced ecosystem features before the shell can clearly explain what is active, running, risky, and resumable

## 8. What This Means For Usan

### The real shell target

Usan should not aim for "chat app with extra panels."

It should aim for:

- approachable first-run GUI
- one obvious place to start
- one visible place where work is happening
- one reliable place where results appear
- one faster command path that becomes more valuable over time

### Beginner-to-power implication

The easiest path and the deepest path should live inside the same shell.

That means:

- beginner users start with templates, examples, and previews
- returning users graduate into palette, history, resources, diffs, logs, and approvals
- power users reach depth by going deeper into the same screen grammar, not by entering a separate mode that abandons the simple path

### Immediate product-level correction

Before more major feature expansion, the shell should be decomposed into these product surfaces:

- title bar
- navigation rail or structured sidebar
- recent work or session surface
- main workspace
- context panel
- utility panel
- composer
- command palette and launcher

This is the minimum shell maturity required before the product can convincingly become a must-have workbench.

## 9. Roadmap Implications

The roadmap should therefore reinforce the following priorities.

### Phase 0 must lock

- shell zone contract
- semantic tokens and motion rules
- title bar behavior
- command palette ownership
- context and utility panel contracts
- baseline quality gates

### Phase 1 must deliver

- durable session list and recent work
- artifact and preview-first result surfaces
- command palette and launcher discovery
- first-run onboarding and starter templates
- clear progression from ordinary-user flows to deeper power-user controls

### What should wait

These should not pull attention before the shell and result model are stable:

- broad plugin marketplace behavior
- heavy browser embedding work
- advanced multi-agent abstractions
- flashy visual treatment that does not improve task clarity

## 10. Recommended Canonical Model

If Usan wants one coherent direction, the best composite model is:

- shell clarity from Linear
- desktop command and quick-action philosophy from Raycast
- workspace and history affordances from Notion desktop
- persistence and operational realism from AutoClaw
- restrained token and motion discipline from Framer, Vercel, Supabase, and Resend extracts
- guided builder and onboarding patterns from the onboarding and dashboard extracts

This composite is stronger than choosing any one product as the single north star.

## 11. Sources

Local extracted references:

- `D:\AI-Apps\_extracted\README.md`
- `D:\AI-Apps\_extracted\02-linear-grid-animations.css`
- `D:\AI-Apps\_extracted\04-raycast-effects.css`
- `D:\AI-Apps\_extracted\08-onboarding-tutorial-patterns.tsx`
- `D:\AI-Apps\_extracted\09-dashboard-ui-patterns.tsx`
- `D:\AI-Apps\_extracted\11-vercel-animations.css`
- `D:\AI-Apps\_extracted\13-supabase-animations.css`
- `D:\AI-Apps\_extracted\14-framer-effects.css`
- `D:\AI-Apps\_extracted\15-resend-effects.css`
- `D:\AI-Apps\_extracted\AutoClaw`
- `D:\AI-Apps\_extracted\Linear`
- `D:\AI-Apps\_extracted\Notion`

External references:

- Microsoft Windows app design:
  - `https://learn.microsoft.com/windows/apps/design/`
- Linear command menu:
  - `https://linear.app/changelog/2019-12-18-new-command-menu`
- Raycast for Teams:
  - `https://www.raycast.com/blog/bringing-raycast-to-teams`
- v0 docs:
  - `https://v0.app/docs`
- Replit build-with-AI guidance:
  - `https://docs.replit.com/getting-started/quickstarts/build-with-ai`
