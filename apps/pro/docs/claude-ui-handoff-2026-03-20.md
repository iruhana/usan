# Claude UI Handoff for Usan

Date: 2026-03-20
Project: `C:\Users\admin\Projects\usan\apps\pro`
**Status: COMPLETE** — see `docs/claude-ui-handoff-completion-2026-03-20.md` for full handoff report

## 1. Goal ✅

Complete the renderer-side UI for Usan first, using mock data and stable component contracts, without implementing backend plumbing, persistence, provider routing, or IPC integration.

The output should look and behave like a coherent desktop workbench shell, not a transcript-only chat client.

## 2. Source of Truth ✅

Read and follow these documents in this order:

1. `C:\Users\admin\Projects\usan\apps\pro\ROADMAP.md`
2. `C:\Users\admin\Projects\usan\apps\pro\docs\ui-ux-reference-audit-2026-03-20.md`
3. `C:\Users\admin\Projects\usan\apps\pro\docs\shell-spec-2026-03-20.md`
4. `C:\Users\admin\Projects\usan\apps\pro\docs\design-system-contract-2026-03-20.md`
5. `C:\Users\admin\Projects\usan\apps\pro\docs\guided-builder-user-flows-2026-03-20.md`
6. `C:\Users\admin\Projects\usan\apps\pro\docs\progressive-disclosure-matrix-2026-03-20.md`
7. `C:\Users\admin\Projects\usan\apps\pro\docs\preview-artifact-contract-2026-03-20.md`
8. `C:\Users\admin\Projects\usan\apps\pro\docs\failure-recovery-ux-contract-2026-03-20.md`

## 3. Scope Boundary ✅

### Claude owns

- renderer UI structure
- renderer component architecture
- shell layout and shell primitives
- design tokens and shared visual primitives
- motion, spacing, density, and state styling
- mock-data-driven UI states
- onboarding, command palette, preview UI, settings IA, session list UI, context panel UI, utility panel UI

### Claude does not own

- main process logic
- preload logic
- IPC contracts
- provider abstraction
- storage and migrations
- run-state logic
- approval engine
- artifact persistence
- failure recovery plumbing
- tests outside the renderer UI layer unless needed for renderer behavior

## 4. Allowed Write Scope ✅

Allowed paths:

- `C:\Users\admin\Projects\usan\apps\pro\src\renderer\src\**`

Allowed with caution only if absolutely needed for type-safe UI scaffolding:

- `C:\Users\admin\Projects\usan\apps\pro\src\renderer\src\stores\**`

Do not modify unless explicitly coordinated:

- `C:\Users\admin\Projects\usan\apps\pro\src\main\**`
- `C:\Users\admin\Projects\usan\apps\pro\src\preload\**`
- `C:\Users\admin\Projects\usan\apps\pro\src\shared\**`
- package-level runtime architecture files

## 5. Store and State Ownership Rules ✅

Renderer-local UI state is allowed.

Examples:

- panel open or closed state
- selected tab in a local panel
- mock run-state for presentation
- temporary view mode state

Domain-level state shape should not be redefined unless explicitly coordinated.

Do not:

- redesign shared session schema
- invent final run-step schema
- invent final artifact persistence shape
- rename or lock in IPC event names
- create fake backend contracts that backend work would later need to obey

If store changes are necessary for UI scaffolding:

- keep them renderer-local
- isolate them behind view-model helpers or mock fixtures
- prefer additive placeholders over changing domain ownership

## 6. UI Deliverables ✅

Claude should complete these renderer deliverables:

1. Shell layout
- title bar
- primary navigation
- work list or session surface
- main workspace
- context panel
- utility panel
- composer

2. Global UI surfaces
- command palette
- launcher entry UI
- onboarding and first-run discoverability

3. Core work surfaces
- conversation or builder workspace shell
- preview surface
- artifact surface
- diff surface
- terminal or run-output surface

4. Settings IA
- left-nav settings layout
- grouped settings surface
- destructive settings isolation

## 7. UI Constraints ✅

- use mock data, fake state, and placeholder contracts where real backend data is missing
- do not invent a second product mode for beginners and power users
- do not make the transcript the only important surface
- do not collapse all state into one giant workspace component
- do not use landing-page style visual treatment in the main work surface
- keep the shell stable while content changes

## 8. Integration Placeholder Rules ✅

Backend unknowns should be represented with stable UI-facing seams, not guessed backend implementations.

Preferred patterns:

- presentational components with explicit props
- renderer-only adapters or view models
- colocated mock fixtures
- fake repositories or demo data sources inside renderer-only boundaries

Allowed:

- placeholder callbacks such as `onRetry`, `onApprove`, `onOpenArtifact`
- temporary fixture files
- mock session, run, artifact, and preview objects

Not allowed:

- fake preload APIs pretending to be final
- adding new shared backend types just to satisfy current UI assumptions
- reaching into `window` globals with undocumented final contract guesses

## 9. Required UX Characteristics ✅

The UI should reflect these product properties:

- easy first-run entry
- clear primary task within a few seconds
- preview-first builder experience
- visible result surfaces
- visible run and approval states
- progressive depth without overwhelming first-time users
- desktop density, not web spaciousness
- keyboard-friendly structure

## 10. Accessibility Contract ✅

The renderer work should already satisfy baseline accessibility expectations even before real backend integration.

Required:

- keyboard-only navigation for the shell
- visible focus order and focus treatment
- `aria-label` on icon-only controls
- `aria-expanded`, `aria-selected`, and `aria-pressed` where appropriate
- reduced-motion support for shell and overlay transitions
- no state that is communicated by color alone

Required keyboard flows:

- open and close command palette
- move through primary navigation
- move through session or work list
- focus composer
- open and close utility surfaces
- navigate onboarding and dismiss it

## 11. Mock Data Rules ✅

Mock data is allowed and expected for:

- recent sessions
- pinned work
- artifacts
- builder templates
- preview states
- run steps
- approvals
- logs
- failure states

Mock data should be realistic:

- long session names
- long file paths
- failed steps
- partial previews
- pending approvals
- large artifacts

Do not use only happy-path demo strings.

## 12. Visual QA Matrix ✅

Claude should validate the UI visually against these scenarios:

- dark theme
- light theme
- reduced motion
- `1440px` width
- `1280px` width
- `1024px` width

Use realistic content for review:

- long session names
- long workspace names
- long file paths
- failed steps
- partial preview
- pending approvals
- dense logs
- multiple artifacts

Expected output:

- at least one screenshot set or equivalent visual capture per major shell surface
- title bar
- navigation
- work list
- main workspace
- context panel
- utility panel
- composer
- command palette
- onboarding

## 13. Avoid These Pitfalls ✅

- do not touch `main`, `preload`, or `shared` to "make the UI work"
- do not hardwire fake IPC names as if they are final contracts
- do not add architecture assumptions that force backend implementation later
- do not let shell state live only in hover behavior
- do not over-animate dense productivity views

## 14. Expected File Direction ✅

Renderer implementation will likely need a structure closer to:

- shell primitives
- layout primitives
- builder surfaces
- artifact surfaces
- panel primitives
- onboarding and command primitives

The exact file structure is flexible, but it should move away from the current shallow shape where `App.tsx`, `TitleBar.tsx`, `Sidebar.tsx`, and `ClaudeWorkspace.tsx` carry too much responsibility.

## 15. Migration Strategy ✅

Claude should prefer staged replacement over a destructive one-shot rewrite.

Recommended approach:

1. introduce new shell primitives and layout layers
2. wrap or replace old surfaces incrementally
3. keep temporary compatibility wrappers if needed
4. delete legacy components only after the new shell mounts cleanly

Do not:

- delete the old shell before the new shell path renders
- rename root files without leaving an obvious replacement path
- create a migration that requires backend work just to restore a basic render

## 16. Renderer Validation Expectations ✅

Renderer-side validation should be part of completion, even before backend integration.

Expected checks:

- renderer render smoke
- keyboard interaction checks for major shell surfaces
- basic accessibility smoke for the shell
- validation that mock states render without layout collapse

If test scaffolding is absent, at minimum provide:

- clear component fixture coverage
- deterministic mock data entry points
- visual evidence of major states

## 17. Completion Criteria ✅

Claude's work should be considered complete when:

- the renderer visually reflects the shell spec
- shell zones are clearly implemented
- preview and artifact are separate concepts in the UI
- beginner flows are understandable without backend knowledge
- power-user depth is reachable through the same shell
- the UI works with mock data and realistic states
- renderer components are structured for later backend integration
- renderer accessibility expectations are met
- visual QA scenarios have been checked
- staged migration leaves an obvious integration path for Codex

## 18. Handoff Output Format ✅

When Claude finishes, the final handoff should include:

- changed file list
- new renderer component tree summary
- mock data or fixture locations
- temporary wrappers or migration shims still present
- unresolved assumptions
- explicit backend integration points Codex must wire later
- screenshots or visual proof references for the main shell states

The handoff should also call out:

- anything intentionally left fake
- any store changes made under caution
- any renderer-only abstractions that Codex should preserve or replace

## 19. Codex Follow-Up Ownership (informational)

After Claude completes the renderer UI, Codex will take over:

- Phase 0 platform hardening
- storage and migrations
- provider normalization
- approvals and capability model
- IPC and preload integration
- artifact persistence
- failure recovery plumbing
- integration testing and hardening

## 20. Coordination Triggers ✅

Claude should stop and document the issue instead of guessing if any of these are required:

- changing shared types
- changing preload contracts
- changing provider event shapes
- changing persistence schema assumptions
- changing package-level architecture or build behavior

## 21. One-Sentence Working Rule ✅

Build the entire renderer UI as if the backend already exists, but do not implement or guess the backend.
