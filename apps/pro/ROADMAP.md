# Usan Roadmap (apps/pro)

Date: 2026-03-19  
Scope: `C:\Users\admin\Projects\usan\apps\pro`  
Current version: `0.1.0`  
Status: Early internal MVP

Naming note:

- internal codebase path remains `apps/pro`
- the public product described by this roadmap should ship as `Usan`
- when this roadmap says `Usan`, it refers to the current `apps/pro` product line

## 1. Purpose

Usan should become a desktop-first AI workbench for focused knowledge work and guided vibe coding.

The product should not try to be "every AI app in one window" in its first serious release. The near-term goal is a trustworthy, restart-safe, artifact-producing assistant for document, file, research, and app-building workflows on Windows.

## 2. Strategic Wedge

### Primary wedge

Start with a **document, file, and guided vibe coding copilot with visible execution**.

This means:

- users can ask for summaries, rewrites, diffs, exports, and structured outputs
- users can attach files, images, and screenshots
- users can describe an app, internal tool, or workflow in natural language and get a concrete starting point
- the app shows what the agent is doing, what tools it called, and what changed
- sessions survive restarts
- high-risk actions require explicit approval

### Secondary bets

These are important, but they should not define the first stable release:

- browser operator workflows
- embedded third-party AI websites
- large plugin ecosystem
- deep automations
- voice-first workflows

### Explicit non-goals for the first stable release

- full browser automation as the default product identity
- arbitrary remote code execution without approval
- shipping an open plugin marketplace before capability controls exist
- treating WebContents-embedded third-party AI sites as the main UX

### Launch naming and future edition strategy

This repository lives under `apps/pro`, but the shipping product described in this roadmap should be presented to users simply as `Usan`.

For the near and medium term:

- the public product name should be `Usan`
- the shipped experience should combine guided beginner-friendly flows with deeper power-user depth
- there should not be a separate mass-market `Usan` product constraining the main roadmap today

A future simplified edition may exist later, but it should be treated as a follow-on product decision, not as a current roadmap constraint.

That means the shipping `Usan` product is explicitly in-bounds for:

- guided vibe coding for non-experts
- advanced context control
- visible tool execution
- artifact and diff workflows
- local model support
- MCP integration
- advanced approvals and automation later

The main UX challenge is therefore not product-line separation. It is progressive disclosure:

- the first hour should feel approachable
- the first week should feel productive
- the long-term ceiling should still satisfy power users

### Broader product aim

The broader aim should be:

- ordinary users can describe what they want to build in plain language
- the system can plan, scaffold, preview, revise, and version the result
- the user does not need to understand framework setup, deployment plumbing, or file layout to get first value
- advanced users can drop down into code, logs, diffs, resources, and tools when needed

In other words, the product should feel like an AI assistant for making software and automations, not only for chatting about them.

### Beginner-to-power progression model

The intended learning curve should be closer to learning a desktop operating system than learning a developer tool from scratch.

The product should therefore follow this progression:

- first impression:
  - simple GUI
  - obvious starting actions
  - low vocabulary burden
  - visible examples and starter paths
- early use:
  - guided builder templates
  - preview-first feedback
  - plain-language edits
  - safe rollback when things go wrong
- deeper use:
  - reusable commands
  - resources, context, and memory
  - diff, logs, and approvals
  - keyboard speed paths
- advanced use:
  - local models
  - MCP servers
  - automations
  - code-level control

The product should not force users to choose between a beginner mode and a power-user mode. It should reveal depth progressively inside one coherent interface.

This direction also aligns with Windows design guidance:

- effortless: easy to do what I want with focus and precision
- familiar: low relearning cost and approachable defaults
- complete and coherent: one product should still feel internally consistent as the user goes deeper

## 2.5 Conditions For Must-Have Status

Usan should not be considered a must-have product just because it has many models, tools, or integrations. Research on sticky productivity products suggests a narrower test:

- Superhuman tied product-market fit to the percentage of active users who would be **very disappointed** without the product, using the now widely cited `40%` threshold as the leading indicator for fit.
- Superhuman also found that their strongest users valued **speed, focus, and keyboard shortcuts**, not product breadth.
- Linear treats the command menu as one of its **core components**, because a fast command layer becomes central once the product has many actions.
- Raycast shows that sticky desktop products combine:
  - instant search and launch
  - reusable quicklinks and snippets
  - low-code or no-code productivity gains on day one
  - deeper extensibility later
- Cursor shows that a product becomes significantly more valuable when it **collapses code, logs, knowledge, and past conversations into one working session** instead of making the user gather context across tools.

For Usan, that means must-have status depends on the following conditions.

### 1. A narrow high-expectation customer

The target user should not be "anyone who wants AI." The high-expectation customer for Usan should be closer to:

- ordinary users with a specific app, tool, or workflow they want to create
- technical or knowledge workers
- people who repeatedly work with files, documents, logs, screenshots, code, or research material
- users who need answers plus artifacts, diffs, exports, or decisions
- users who feel real pain from context switching across chat, files, docs, terminals, and browser tabs

If the roadmap starts serving too many weakly related personas, the product will likely become impressive but non-essential.

### 2. A repeated high-frequency painkiller

Must-have products solve a frequent, painful workflow, not an occasional curiosity.

Usan should win one or two repeated daily or near-daily workflows before expanding:

- "Take a messy set of files, notes, screenshots, or logs and produce a trustworthy result."
- "Investigate a task or problem without manually gathering context from five tools first."
- "Generate a draft, diff, export, or decision with visible execution and review."
- "Describe a small app, internal tool, or automation in plain language and get a usable starting point without setup pain."

If the main user value depends on occasional novelty, broad experimentation, or one-off demos, the product is not yet must-have.

### 3. Measurable time saved, not just delight

Research-backed productivity products consistently emphasize speed and hours saved.

For Usan, the roadmap should assume that must-have status requires evidence that the product:

- completes a core workflow materially faster than the user's current stack
- reduces context gathering and task switching
- turns repeated operational work into reusable flows

Research-informed internal planning targets for the core wedge:

- the user can reach a first meaningful artifact in the first session
- the product should save meaningful time per week for the target user, not just minutes once in a while
- at least one core workflow should feel dramatically faster than using generic chat plus manual file handling

These thresholds are product planning inferences, not external benchmarks, but they should be made explicit and measured.

### 4. One session must collapse the whole job

The strongest research pattern across modern AI work tools is context collapse.

Usan should feel qualitatively better than generic chat only if one session can hold:

- the prompt
- files and attachments
- prior messages
- run steps
- logs
- artifacts
- approvals
- linked references or MCP resources

If users still need to bounce between terminal, explorer, docs, chat tabs, and note apps to understand what happened, the product will remain replaceable.

### 5. The fast path must be keyboard-native

Research from Linear, Raycast, and Superhuman supports the same lesson: the fast path becomes the sticky path.

Usan therefore needs:

- a command palette that is central, not decorative
- search and jump surfaces that work from anywhere
- saved quick actions, templates, or shortcuts for repeated work
- keyboard-first execution for the most common flows
- guided controls for non-experts who are not yet keyboard-native

If the only efficient path is clicking around dense UI, the product will lose power users even if the AI quality is good.

### 6. Day-one usefulness, deeper power later

Raycast's team product is a useful example: quicklinks and snippets give immediate value before developers build deeper commands.

Usan should follow the same adoption ladder:

- day one:
  - file attach
  - ask
  - choose a template or starter path for app creation when relevant
  - get artifact
  - get preview
  - review diff
  - export
  - resume later
- week one:
  - saved commands
  - reusable prompt templates
  - recent resources
  - quick navigation
  - checkpoints and rollback
  - simple visual edits
- after trust is earned:
  - automations
  - MCP expansion
  - plugins
  - more autonomy

If the roadmap assumes users will tolerate setup cost before getting immediate value, it will weaken adoption.

### 7. Trust must be a product feature, not infrastructure hidden underneath

For Usan, must-have status depends on users trusting the product with real work.

That means the product must make these visible:

- what the agent is doing
- what tool was called
- what changed
- what is still running
- what is blocked on approval
- what final artifact was produced

If safety exists only in architecture diagrams and not in the user-facing UX, users will still hesitate to rely on the product.

### 8. Value must compound with continued use

Must-have products get better the more they are used.

Usan should compound through:

- searchable history
- reusable artifacts
- saved instructions and rules
- remembered resources and recent files
- faster future tasks because prior context is already organized

If every session starts from zero, the product will feel like a nicer wrapper around commodity models rather than a must-have workbench.

## 2.6 Must-Have Scorecard

The roadmap should include explicit go / no-go criteria for whether the product is becoming essential.

### Leading indicator: product-market fit score

Following the Superhuman approach, survey users who have experienced the core wedge enough to judge it. For Usan that should mean users who completed the core workflow at least twice in the last two weeks.

Ask:

- How would you feel if you could no longer use Usan?
  - Very disappointed
  - Somewhat disappointed
  - Not disappointed
- What type of person would most benefit from Usan?
- What is the main benefit you receive from Usan?
- How can we improve Usan?

Research-backed threshold:

- `40%+ very disappointed` in the target segment is the minimum must-have threshold

Suggested internal interpretation:

- `<25%`: interesting tool, not must-have
- `25%-39%`: promising but not ready to widen scope
- `40%-49%`: must-have territory for the target segment
- `50%+`: strong fit, appropriate time to scale distribution and adjacent features

### Supporting product signals

These are proposed planning thresholds for Usan and should be treated as internal targets:

- activation:
  - user reaches a meaningful artifact, export, or reviewed diff in the first serious session
  - first serious session should not require heavy setup before value appears
- habit:
  - target users return for repeated real work each week, not just exploration
  - the product is used before generic chat for at least one core workflow
- speed:
  - users can start and complete the core workflow faster than with their current stack
- trust:
  - side-effecting flows are used, not avoided, because approvals and logs make them legible
- compounding value:
  - returning users benefit from history, saved context, and reusable commands

### Must-have moment and disqualifiers

The product should be treated as entering must-have territory only when the target user instinctively opens Usan first for the core wedge.

For this roadmap, the must-have moment is closer to:

- "I have a messy document, file set, log dump, or research task. Open Usan."
- "I need a result I can review, export, or apply. Open Usan."
- "I do not want to gather context manually across five tools. Open Usan."
- "I want to build a small app, internal tool, or workflow without wrestling with setup. Open Usan."

The product is not yet must-have if the dominant pattern is:

- users gather context elsewhere and only paste the final question into Usan
- users treat it as a generic model switcher or novelty playground
- users avoid approvals, artifacts, or side-effecting flows because they do not trust the system
- users get one good answer, but do not return because the next task starts from zero
- non-technical users cannot reach a preview or usable first version without touching raw code

### Roadmap gating rule

Do not aggressively expand into broad plugin ecosystems, public marketplaces, or complex automations until the must-have scorecard shows real strength in the core wedge.

If the product has not crossed the must-have threshold in the target segment, the correct move is not to add more breadth. The correct move is to:

- narrow the high-expectation customer further
- improve the core workflow speed
- reduce context-switching overhead
- make the result surface more trustworthy
- sharpen the command and keyboard layer
- remove setup friction that delays first value
- improve the guided builder flow for non-experts instead of exposing more raw complexity

## 3. Current Baseline

Based on the current code in `apps/pro`, the app already has:

- Electron + React 19 + Zustand shell
- custom frameless window and custom title bar
- a sidebar plus workspace layout
- direct multi-provider chat for Anthropic, OpenAI, and Google
- streaming IPC from main to renderer
- a minimal tool loop with `bash`, `web_fetch`, and `read_file`
- a SQLite-backed OpenClaw skill index with FTS
- WebContentsView-based embedded tabs for third-party AI sites

The current baseline does **not** yet provide:

- durable conversation history
- markdown-safe artifact rendering
- attachments and multimodal prompt assembly
- a run log / approval model
- MCP client support
- a stable artifact panel / diff viewer
- local model routing
- proper QA gates, smoke tests, accessibility tests, or CI standards

### Current renderer UX reality

The current renderer shell is still structurally shallow:

- `App.tsx` is effectively title bar plus one sidebar plus one workspace
- `TitleBar.tsx` handles branding and window controls, but not yet real shell actions such as workspace, history, launcher, or settings ownership
- `Sidebar.tsx` mixes navigation, skills, search, and settings in one fixed-width column
- `ClaudeWorkspace.tsx` still carries too much product responsibility inside one transcript-centric surface
- `globals.css` already contains early tokens, but much of the shell remains expressed through inline component styles instead of shared primitives

In practice, this means the current UI is ahead of a raw prototype, but not yet at the level of a result-first desktop workbench.

### Baseline verification signal

A quick baseline check on 2026-03-20 showed:

- `typecheck`: passed
- `build`: passed
- `lint`: missing
- `test`: missing

This validates the roadmap decision to keep Phase 0 focused on platform hardening and shell contracts before expanding feature breadth.

## 4. Research-Informed Technical Decisions

This roadmap is intentionally adjusted based on current official platform guidance and implementation risk.

### Electron

- Keep `contextIsolation: true` and expose a narrow preload API only.
- Use `globalShortcut` only after `app.whenReady()`.
- If tray support is added on Windows, use a proper `.ico` asset and a native tray menu.
- Avoid making embedded third-party sites a core dependency. Their framing, CSP, sign-in, and policy behavior are brittle.

### OpenAI

- New agentic work should target the **Responses API** rather than building deeper around legacy chat-completions-only abstractions.
- Structured output and tool calling should share one typed response pipeline.

### Anthropic

- Tool use should stay aligned with the Messages API flow:
  - assistant emits `tool_use`
  - client executes tool
  - client returns `tool_result`
- If multimodal input is core, image support must be treated as a first-class content block path, not a string-only extension.

### MCP

- Start with **stdio** transports for local tools and process-managed servers.
- Add remote transports only after local lifecycle management is stable.
- Resources and tools should be separate concepts in the product model, not just "more tools".

### Voice

- Browser speech APIs are acceptable as a fallback, not as the core reliability path.
- If voice becomes a headline feature, add a local-first STT strategy and explicit device/error handling.

### Guided app creation

- Vibe coding for ordinary users requires more than code generation. The product must combine:
  - natural-language intent capture
  - planning before action when scope is unclear
  - visual preview
  - iterative edits without forcing raw code edits
  - versioning, checkpoints, and rollback
  - a safe path to sharing, exporting, or deployment
- v0 demonstrates a strong pattern here:
  - describe the idea in plain language
  - create high-fidelity UI
  - connect backend and data
  - deploy with one click
  - review code when needed
- Replit demonstrates a second important pattern:
  - plan mode before build
  - checkpoints and rollback
  - different effort modes for quick edits versus full autonomous work
  - low setup friction for non-experts
- If Usan wants to serve ordinary users, it needs these guided flows and safety nets, not just a stronger model picker.

### Local models

- `Ollama` is the right first local-model target because it minimizes integration and support cost.
- Deeper local runtimes such as `llama.cpp` should stay optional until the app has a stable provider abstraction.

### Terminal and artifacts

- Use `xterm.js` for terminal output and `FitAddon` for layout correctness.
- Treat artifacts as stored entities with metadata, not transient UI fragments.

### Desktop visual system

- Build the renderer around a **semantic token system**, not one-off Tailwind values or inline colors.
- The minimum token contract should include:
  - surfaces: `bg-base`, `bg-surface`, `bg-elevated`, `bg-overlay`
  - text: `text-primary`, `text-secondary`, `text-tertiary`, `text-muted`
  - borders: `border-subtle`, `border-default`, `border-strong`
  - action: `accent`, `accent-soft`, `focus-ring`, `danger`, `success`, `warning`
  - shape and depth: `radius-sm`, `radius-md`, `radius-lg`, `shadow-1` through `shadow-4`
  - layout constants: title bar height, sidebar widths, utility panel heights, composer min/max heights
- Use the same token contract across the title bar, sidebar, command palette, composer, artifact panel, diff viewer, terminal, settings, launcher, and approval cards.
- Prefer low-chroma neutrals plus one brand accent over multiple unrelated gradients.
- Keep information density at a desktop level. The visual target is closer to Linear, Raycast, and desktop Notion than to a marketing landing page.

### Motion system

- Use motion to communicate state change, hierarchy, and continuity, not to decorate empty space.
- Define three motion bands and keep them consistent:
  - micro interaction: `80ms` to `140ms`
  - panel and list transitions: `160ms` to `220ms`
  - overlay, modal, command palette, launcher: `180ms` to `260ms`
- Default transitions should be built from opacity, `translateY(4px-12px)`, `translateX`, and subtle scale (`0.96` to `0.99`).
- Prefer one or two easing curves globally:
  - swift entry for panels and overlays
  - symmetric ease for tab indicators, selection movement, and layout state changes
- Respect reduced motion from the first implementation. Every animated surface must have a reduced-motion fallback.
- Long-running decorative loops should be limited to:
  - empty states
  - loading indicators
  - first-run onboarding moments
  They should never dominate the main work surface.

### Desktop workbench patterns

- Sidebar behavior should be explicit:
  - compact rail around `56px`
  - expanded navigation around `220px` to `248px`
  - label reveal should lag slightly behind width expansion rather than appear instantly
- Command palette should be treated as a first-class shell primitive, not an afterthought.
- Utility surfaces such as artifact viewers, diff panels, terminals, and approval drawers should slide or resize predictably instead of causing abrupt full-layout jumps.
- First-run onboarding should be lightweight:
  - one short multi-step onboarding sequence
  - one guided spotlight tour for the core workflow only
  - permanently dismissible
- Settings should use a stable left-nav plus detail-pane pattern rather than a long undifferentiated form page.

### Information architecture and shell hierarchy

The app should use a stable desktop shell with named zones. These zones should not drift from screen to screen.

- Title bar:
  - app identity
  - active workspace title
  - global actions such as search, launcher, settings, profile, and window controls
- Navigation rail / sidebar:
  - session and workspace navigation
  - context switching
  - recent and pinned destinations
- Main workspace:
  - the current conversation, document, search result, or execution view
  - this is the visual center of gravity
- Context panel:
  - optional right-side surface for memories, references, resources, parameters, and preview metadata
  - must be dismissible and resizable
- Utility panel:
  - bottom or side panel for terminal, logs, run steps, approvals, and artifacts
  - should preserve open state between related actions
- Composer:
  - pinned to the workflow where prompting happens
  - should remain spatially consistent across chat-heavy screens
- Global overlays:
  - launcher
  - command palette
  - onboarding steps
  - modal approvals

The shell should answer these questions at all times without requiring discovery:

- where am I
- what is active
- what is running
- what changed
- what needs approval
- where is the result

### Interaction model

- Hover is supportive only. Selection, focus, active execution, and disabled states must remain visually distinct without hover.
- The app should prefer persistent state indication over ephemeral animation.
- Row selection should use at least two signals:
  - background or surface change
  - border, indicator bar, or accent treatment
- Keyboard focus should never rely on color change alone.
- Dangerous actions should require one extra interaction step and explicit copy.
- Reversible actions should prefer inline undo over modal interruption where possible.
- Resize interactions for panels should feel native:
  - visible handle on hover or near edge
  - stable drag target
  - minimum widths and heights that prevent layout collapse

### State and feedback system

Every primary screen should define explicit treatment for:

- empty
- loading
- streaming
- partial success
- success
- warning
- error
- offline or unavailable dependency
- approval pending
- paused or resumable

The UX rules for state handling should be:

- skeletons should resemble the final layout, not generic placeholders
- streaming should feel stable and legible rather than jittery
- inline status beats toast spam for long-running tasks
- errors should explain recovery action, not only failure cause
- approvals should expose:
  - what will happen
  - why it is risky
  - which capability is being requested
  - what alternative exists if denied

### Copy and labeling system

- Primary labels should be short, verb-led, and operational.
- Navigation labels should map to user intent rather than internal implementation terms.
- The same action should never have multiple names across title bar, menu, command palette, and settings.
- Empty states should explain the next useful action in one sentence.
- Error copy should include:
  - what failed
  - what the user can do next
  - whether retry is safe
- Shortcut hints should appear where power users expect them:
  - command palette
  - launcher
  - session switching
  - search
  - send / stop / apply / reject flows

### Screen-level UX contracts

The roadmap should treat these as named product surfaces, not loose components:

- Title bar:
  - compact, high-clarity, no marketing visuals
  - drag regions must never overlap interactive controls
- Sidebar:
  - dense navigation with clear active context
  - support pinned, recent, and contextual destinations
- Session list:
  - searchable, sortable, resumable
  - status and recency visible at a glance
- Workspace:
  - one dominant reading or execution surface
  - avoid nested card stacks that make the screen feel web-like
- Composer:
  - file and image attachment affordances
  - model or mode selector
  - clear send, stop, and approval-related affordances
- Artifact viewer:
  - document, code, table, and JSON presentations with fit-for-format controls
  - artifact provenance and generation timestamp
- Diff viewer:
  - readable additions and deletions
  - sticky file header when needed
  - explicit apply and reject actions
- Terminal and logs:
  - monospace clarity
  - copy support
  - truncation strategy for extremely long output
- Settings:
  - left-nav information architecture
  - summary state for providers, storage, tools, privacy, and appearance
  - destructive settings clearly isolated
- Launcher / command palette:
  - zero-learning discovery of commands, sessions, files, models, and settings
  - consistent ranking and keyboard behavior

### Screen transition policy

- Switching between sessions should preserve shell continuity and only update the workspace and linked context surfaces.
- Expanding artifacts, logs, and approvals should not fully recompose the screen when a panel animation is sufficient.
- Modal usage should be limited to:
  - destructive confirmations
  - blocking approvals
  - first-run onboarding
  - account or secret entry that requires focused completion
- Prefer drawers, utility panels, and inline cards for everything else.

### Visual anti-patterns

The extracted references include many useful effects, but most marketing-page patterns should stay out of the daily workspace. Avoid:

- hero-style parallax and oversized entrance choreography in core work views
- always-on aurora backgrounds behind dense productivity surfaces
- mouse-follow glow and 3D tilt for primary controls
- heavy glassmorphism that reduces text contrast
- large animated gradients in the title bar, sidebar, or diff viewer
- motion that competes with terminal output, streaming text, or approval states

### Canonical reference blend

The strongest product direction is not to imitate one product literally. It is to combine a few references intentionally:

- Linear for compact shell density, active-state clarity, and command-first workflow
- Raycast for easy-to-start quick actions, quicklinks, snippets, and power that grows with reuse
- Notion desktop for workspace, sidebar, and history affordances that feel like real desktop shell behavior
- AutoClaw for persistence, settings, and operational depth planning in an Electron AI app
- Framer, Vercel, Supabase, and Resend extracts for token discipline, drawer transitions, elevation, and restrained overlay behavior

From that blend, the roadmap should adopt these rules:

- the shell must stay stable while the workspace content changes
- the command layer must be first-class
- results, previews, diffs, and logs must be separated from the transcript when the task becomes substantive
- onboarding should be lightweight, dismissible, and task-oriented
- token and motion systems must stay consistent across beginner and power-user flows

## 5. Product Principles

- Composer first: every workflow starts from one clear input surface.
- Action over chat: output should be a result, file, diff, preview, or decision, not just a message.
- Trust through visibility: users should see plan, tool calls, approvals, logs, and results.
- Approval before side effects: file deletion, network posting, automation triggers, and system actions must be gated.
- Local-first trust: secrets, approvals, history, and attachments are local by default.
- Progressive power: simple tasks should feel immediate; advanced power should unlock without breaking the basic flow.
- Progressive disclosure: the UI should begin with easy GUI affordances and reveal deeper control only when the user needs it.
- Desktop density over web spaciousness: prefer crisp, compact, keyboard-friendly surfaces over oversized cards and landing-page spacing.
- Stable shells over flashy transitions: the user should always know where the active session, artifact, tools, and approval states live.

## 6. Missing Foundation That Must Be Added First

The current roadmap started directly from feature work. That is too risky for the current `apps/pro` baseline.

Before expanding features aggressively, the app needs:

- a testable app contract
- a durable storage schema
- a unified streaming event model
- a capability and approval model
- a provider abstraction that can support direct APIs, local models, and MCP tools without branching everywhere

For that reason, this roadmap adds a new **Phase 0**.

## 7. Delivery Plan

### Required supporting implementation docs

These documents should be treated as required companions to the roadmap, not optional notes:

- `C:\Users\admin\Projects\usan\apps\pro\docs\ui-ux-reference-audit-2026-03-20.md`
- `C:\Users\admin\Projects\usan\apps\pro\docs\shell-spec-2026-03-20.md`
- `C:\Users\admin\Projects\usan\apps\pro\docs\guided-builder-user-flows-2026-03-20.md`
- `C:\Users\admin\Projects\usan\apps\pro\docs\progressive-disclosure-matrix-2026-03-20.md`
- `C:\Users\admin\Projects\usan\apps\pro\docs\preview-artifact-contract-2026-03-20.md`
- `C:\Users\admin\Projects\usan\apps\pro\docs\failure-recovery-ux-contract-2026-03-20.md`
- `C:\Users\admin\Projects\usan\apps\pro\docs\design-system-contract-2026-03-20.md`

The roadmap defines sequencing and product intent. These documents define the shell contract, builder flow contract, and disclosure rules needed to implement that intent without drift.

### Phase dependency map

The roadmap should be executed against this dependency order:

- Phase 0 is required before any durable feature expansion
- Phase 1 depends on Phase 0 storage, provider, and QA baselines
- Phase 2 depends on Phase 1 history, artifacts, and attachment flows
- Phase 3 depends on Phase 2 run-state integrity and provider abstraction
- Phase 4 depends on the trust boundaries and observability added in Phases 0 to 3

The following feature dependencies are especially important:

- branching depends on durable session history
- model comparison depends on normalized streaming events
- plugins depend on capability controls
- automations depend on audit logging and failure recovery
- Gateway integration depends on local fallback routing
- voice should not outrun history, approvals, or artifact stability

## Phase 0 - Platform Hardening

Goal: make the current MVP safe to build on.

### In scope

- engineering safety rails
- storage and migration baseline
- provider and stream normalization
- approval and capability model
- repeatable verification scripts

### Out of scope

- new end-user differentiator features
- plugin marketplace work
- browser operator workflows
- collaboration and team features

### Workstreams

1. Quality gates
- Add `lint`, `test:unit`, `test:a11y`, and `test:e2e:electron` scripts.
- Add a single `verify:strict` script that blocks unstable releases.
- Add CI for build, typecheck, tests, and smoke.

2. Storage model
- Introduce SQLite migrations.
- Create initial tables for:
  - `sessions`
  - `messages`
  - `attachments`
  - `artifacts`
  - `runs`
  - `run_steps`
  - `approvals`
  - `memories`
- Keep append-friendly event history for debugging and trust review.

3. Provider abstraction
- Split provider logic into adapters:
  - `anthropic`
  - `openai`
  - `google`
  - `ollama` later
- Normalize stream events into one typed schema:
  - `text_delta`
  - `tool_call`
  - `tool_result`
  - `artifact`
  - `error`
  - `done`

4. Security and trust boundaries
- Define capability tiers for tools.
- Add approval checkpoints for side effects.
- Move secrets to a secure local storage path.
- Add audit logging for risky actions.

5. UX contract
- Freeze the layout contract for:
  - sidebar
  - session list
  - workspace
  - composer
  - artifact area
  - bottom utility panel
- Treat `shell-spec-2026-03-20.md` as the implementation source of truth for zone ownership, widths, collapse rules, and preview versus artifact behavior.

6. Design system contract
- Freeze the first semantic token set for color, spacing, radius, elevation, focus, and motion.
- Define shell primitives before broader feature work:
  - title bar
  - icon rail / sidebar row
  - command palette
  - composer
  - artifact card
  - diff block
  - terminal pane
  - approval card
  - run-step timeline item
  - settings section row
- Extract the current inline-styled shell into reusable primitives instead of letting `App.tsx`, `TitleBar.tsx`, `Sidebar.tsx`, and `ClaudeWorkspace.tsx` keep growing as one-off surfaces.
- Treat `design-system-contract-2026-03-20.md` as the source of truth for tokens, primitives, spacing, motion, and state vocabulary.
- Define reduced-motion behavior for overlays, panels, toasts, and loading indicators.
- Define desktop empty, loading, error, and success state patterns once and reuse them.
- Write a shell spec that names each zone, its purpose, ownership, min/max sizes, and collapse behavior.
- Capture the keyboard model for shell navigation before adding many new panes and overlays.

### Phase 0 implementation sequence

Execute Phase 0 in this order so the beginner-friendly UX and power-user depth do not drift apart later:

1. Shell and token foundation
- define semantic tokens
- define shell zones
- define min widths, collapse rules, and resize behavior
- define reduced-motion and focus behavior
- break the current monolithic shell into stable primitives for title bar, navigation, workspace, context, utility, and composer layers

2. Storage and migrations
- create session, artifact, run, approval, and memory tables
- add forward-only migration runner
- add backup-before-destructive-migration rules

3. Event and provider normalization
- normalize streaming events
- separate provider adapters
- add durable run-state persistence

4. Trust model
- capability tiers
- approval states
- audit logging
- visible side-effect boundaries in UI contracts

5. Verification harness
- strict verification command
- smoke tests
- accessibility checks
- screenshot-based visual QA for the shell

6. Guided builder baseline contract
- define intake schema for non-technical builder prompts
- define preview surface contract
- define checkpoint and rollback semantics before build features begin
- define the first three canonical builder flows from `guided-builder-user-flows-2026-03-20.md`
- define visibility rules from `progressive-disclosure-matrix-2026-03-20.md` so beginner and power-user UX do not diverge into separate products
- define preview versus artifact behavior from `preview-artifact-contract-2026-03-20.md`
- define failure recovery behavior from `failure-recovery-ux-contract-2026-03-20.md`

### Dependencies

- current Electron shell remains the host app
- SQLite remains the local persistence baseline
- existing direct provider integrations are refactored, not replaced all at once

### Acceptance tests

- startup succeeds with no external provider credentials present
- app restart preserves settings and at least one test session
- a simulated risky tool action enters an approval state instead of executing immediately
- malformed provider stream data does not crash the renderer
- smoke validation can run from one documented script
- dark and light themes resolve the same semantic tokens without broken contrast
- reduced-motion mode disables non-essential animation without breaking layout or discoverability
- the shell contract documents fixed heights and widths for title bar, sidebar, composer, and utility panels
- supporting docs exist for shell spec, guided builder flows, and progressive disclosure rules before Phase 1 feature breadth expands
- supporting docs also exist for preview and artifact rules, failure recovery UX, and the design-system contract before Phase 1 feature breadth expands

### Exit criteria

- `npm run build` passes
- `npm run typecheck` passes
- unit tests exist and pass
- Electron smoke test exists and passes
- local persistence survives app restart
- no destructive tool action runs without an approval state

## Phase 1 - Trustworthy Workspace Core

Goal: make the app feel like a serious work tool rather than a raw chat shell.

### In scope

- markdown rendering
- durable session history
- attachments and multimodal input
- terminal panel
- artifact and diff presentation

### Out of scope

- multi-agent planning
- plugin execution
- remote automation triggers
- deep collaboration features

### 1.1 Markdown and artifact rendering

Deliver:

- markdown rendering with code fences, tables, task lists, and math
- safe HTML handling
- syntax highlighting matched to the app theme
- artifact cards for:
  - markdown
  - code
  - table
  - JSON
  - plain text
- rendering and storage behavior must follow `preview-artifact-contract-2026-03-20.md`

Recommendation:

- Start with `react-markdown`, `remark-gfm`, `rehype-highlight`, `remark-math`, `rehype-katex`
- Keep raw HTML disabled by default unless a clearly sanitized pipeline is required

### 1.2 Session history

Deliver:

- session list with search
- recent and pinned work affordances
- restore-on-launch behavior
- session rename and delete
- full-text search over messages
- automatic save during and after streams

### 1.3 Attachments and multimodal input

Deliver:

- drag and drop files
- paste image from clipboard
- screenshot attach flow
- attachment preview in composer
- provider-aware prompt assembly for text + files + images

### 1.3b Guided builder intake

Deliver:

- starter prompts and templates for:
  - simple websites
  - internal tools
  - dashboards
  - forms
  - lightweight automations
- plain-language intake that helps the user specify:
  - what they want to build
  - who it is for
  - what actions it must support
  - whether they need preview, export, share, or deployment
- an intake path that feels usable for non-technical users without hiding the advanced path from power users
- the first release should explicitly support the three canonical builder flows defined in `guided-builder-user-flows-2026-03-20.md`

### 1.4 Artifact panel, diff view, and terminal panel

Deliver:

- bottom or side utility panel with terminal output
- artifact viewer separate from the chat transcript
- diff renderer for file changes
- clear apply / reject flow for generated changes
- failure and recovery states aligned with `failure-recovery-ux-contract-2026-03-20.md`

### 1.5 Command palette, settings, and first-run discoverability

Deliver:

- command palette for navigation, quick actions, and recent sessions
- keyboard shortcut hints on core actions
- settings information architecture for providers, storage, tools, and appearance
- first-run onboarding that explains:
  - composer
  - attachments
  - artifacts
  - approvals
  - shortcuts
  - builder templates
  - preview and rollback
- disclosure behavior aligned with `progressive-disclosure-matrix-2026-03-20.md`

Recommendation:

- keep onboarding short and skippable
- prefer spotlight and progressive disclosure patterns over long static tours
- treat settings as a desktop control surface, not a generic web form
- avoid exposing advanced terminology too early; first-run language should be plain and task-oriented

### 1.6 Shell UX completion

Deliver:

- named shell zones implemented consistently across the main workspace
- title bar ownership for workspace identity, launcher or search entry, history access, settings, and safe drag regions
- persistent active-state treatment for navigation, selections, and running tasks
- explicit empty, loading, streaming, error, and approval states for core screens
- keyboard model for:
  - launcher
  - command palette
  - session switching
  - composer submission and stop
  - artifact open and close
  - utility panel focus
- screen-level resizing behavior for sidebar, context panel, and utility panel
- preview-first flow for generated apps, pages, or tools so non-experts see progress visually instead of through logs alone

Recommendation:

- prototype the shell with realistic long content, not short demo strings
- test dense data and slow streams early so the UI contract does not optimize only for ideal states
- keep the workspace readable at normal laptop widths before adding more panels

### Phase 1 implementation sequence

Execute Phase 1 in this order to preserve a shallow learning curve while building toward depth:

1. Session and composer reliability
- durable session restore
- attachment handling
- multimodal prompt assembly
- basic artifact persistence

2. Guided builder intake
- starter templates
- plain-language builder forms
- first-run examples for ordinary users
- preview-first entry path

3. Result surfaces
- artifact viewer
- diff viewer
- terminal and run output panel
- explicit apply or reject controls

4. Discoverability layer
- command palette
- quick actions
- onboarding
- keyboard hints

5. Progressive depth layer
- expose logs, diffs, approvals, and resources without forcing them on first-use users
- keep advanced controls reachable from the same screen
- ensure non-technical users can ignore depth until needed

6. Acceptance pass with realistic users
- test a first-time non-technical builder flow
- test a returning power-user flow
- verify both can succeed in the same product without separate mode switching

### Dependencies

- Phase 0 storage schema for sessions, attachments, and artifacts
- normalized provider stream events
- baseline QA scripts from Phase 0

### Acceptance tests

- markdown renders fenced code, tables, and math correctly in both themes
- a pasted image attachment survives prompt submission and app restart
- a generated diff can be reviewed and either applied or rejected
- terminal output remains readable during long-running tool execution
- a reopened session restores both transcript and linked artifacts
- the command palette opens in under the performance budget and is fully keyboard operable
- onboarding can be completed, skipped, and permanently dismissed
- settings remain scannable and usable at normal desktop widths without turning into a long-scroll page
- each named shell zone remains legible and functional at the minimum supported window width
- title bar controls, drag regions, and global shell actions do not conflict
- selection, focus, running, and approval-pending states are visually distinguishable in the same screen
- artifact, diff, and terminal panels can open without disorienting full-layout jumps
- a non-technical user can start from a guided template and reach a preview without touching raw code
- an advanced user can still reach logs, diffs, resources, and deeper controls from the same product without switching to a separate edition
- first-run, returning-user, and power-user disclosure behavior matches the progressive disclosure matrix instead of ad hoc feature exposure
- preview and artifact behavior follows the preview-artifact contract rather than transcript-only output
- failure recovery follows the failure-recovery UX contract rather than raw error dumping

### Exit criteria

- a user can attach a file, ask for work, see a rendered result, and reopen it after restart
- code blocks and tables render correctly
- diffs can be reviewed before applying changes
- tool output is visible outside the chat transcript

## Phase 2 - Context and Agent Runtime

Goal: move from "good chat UI" to "visible, reliable work execution".

### In scope

- project rules
- explicit memory
- mention-driven context
- agent runtime state machine
- MCP client for curated local servers

### Out of scope

- public plugin marketplace
- broad webhook automation
- browser operator as default workflow
- cross-user collaboration

### 2.1 Project rules and memory

Deliver:

- workspace-level `RULES.md` detection
- memory records for facts, preferences, and instructions
- explicit user review for saved memory
- memory lookup integrated into prompt assembly

### 2.2 Mention-driven context system

Deliver:

- `@file`
- `@folder`
- `@history`
- `@skill`
- `@web`
- `@resource`

Recommendation:

- Start with local resources first
- Add remote fetch contexts only when cancellation, timeout, and caching rules exist

### 2.3 Agent runtime v1

Deliver:

- plan generation
- step execution
- step state transitions
- approval checkpoints
- run log persistence
- retry and resume behavior
- checkpoints for meaningful state changes
- rollback entry points for user-visible milestones

### 2.4 MCP client v1

Deliver:

- stdio-managed MCP servers
- server lifecycle controls
- tool discovery
- resource listing
- read-only default policy for initial curated servers

Recommended first-party supported servers:

- filesystem
- GitHub
- web fetch / search
- playwright

### Dependencies

- Phase 1 durable history and artifacts
- approval model from Phase 0
- provider event normalization from Phase 0

### Acceptance tests

- a workspace `RULES.md` changes prompt assembly on the next run
- a saved memory record is visible, editable, and removable
- `@file` and `@history` mentions resolve deterministically
- a multi-step run can pause on approval and resume after user confirmation
- a curated MCP server can connect, list tools, and execute a read-only action successfully

### Exit criteria

- a user can run a multi-step task and see the plan, execution steps, approvals, and final artifact
- MCP servers can be connected, listed, and safely invoked
- memory and rules materially improve task continuity between sessions

## Phase 3 - Desktop Leverage and Local AI

Goal: make the app habit-forming on the desktop.

### In scope

- launcher
- tray presence
- local AI
- branching
- compare mode
- optional voice enhancement

### Out of scope

- enterprise collaboration
- public plugin marketplace
- browser operator as the main product surface

### 3.1 Global launcher and tray

Deliver:

- configurable global shortcut
- quick launcher overlay
- short-answer inline result mode
- route longer jobs back into the main window
- tray menu with recent tasks and reopen action
- quick-start creation entry points for "build a page", "build a tool", and "build a workflow"

### 3.2 Local AI

Deliver:

- `Ollama` model discovery
- chat and streaming support
- local model section in the picker
- local-first preference for privacy-sensitive tasks when configured

### 3.3 Conversation branching and model comparison

Deliver:

- branch from any message
- compare responses from multiple models
- promote one branch result back into the main thread

This should come **after** durable history is stable.

### 3.3b Visual edits and builder revision loop

Deliver:

- visual edit mode for copy, spacing, layout, and simple styling changes
- fast deterministic edits for straightforward visual adjustments
- version markers or checkpoints the user can name or revisit
- comparison between current result and prior versions

This is important if the product wants to support ordinary users who think in terms of "make this card bigger" rather than "edit component props."

### 3.4 Voice

Deliver:

- push-to-talk input
- explicit recording state
- local-first STT path
- optional TTS readback

Voice is useful, but it should not outrank history, artifacts, approvals, or local model routing.

### Dependencies

- Phase 2 run-state integrity
- stable provider abstraction
- background-safe app lifecycle handling in Electron

### Acceptance tests

- the launcher can open and close repeatedly without leaving orphan windows
- `Ollama` detection fails gracefully when not installed
- compare mode can stream two or more providers without corrupting the active session
- branching from a prior message preserves parent linkage and replay context
- voice failures surface explicit UI state rather than silent failure

### Exit criteria

- launcher actions are reliable even when the main window is not focused
- local model routing works without destabilizing remote providers
- branch and compare flows do not corrupt session history

## Phase 4 - Ecosystem and Automation

Goal: grow the product without turning the core into a security problem.

### In scope

- controlled plugin system
- observable automations
- export paths
- optional Gateway connector

### Out of scope

- anonymous community marketplace with broad install permissions
- unattended destructive automations
- mandatory Gateway dependency

### 4.1 Plugin system

Deliver:

- signed or trust-declared plugin manifests
- explicit capability requests
- install, disable, remove lifecycle
- renderer extensions only through controlled surfaces

Do not ship a "marketplace first" story before the plugin trust model exists.

### 4.2 Event-driven automations

Deliver:

- file change triggers
- schedule triggers
- webhook triggers
- MCP event triggers
- automation logs and last-run visibility

### 4.3 Export

Deliver:

- markdown
- HTML
- PDF
- code file bundles
- CSV where relevant
- preview links or shareable builds where relevant

### 4.4 Optional OpenClaw Gateway integration

Deliver:

- optional WebSocket connector
- capability discovery
- tool routing with local fallback
- visible gateway connection state

This stays optional until the standalone app is strong on its own.

### Dependencies

- capability model from Phase 0
- run logs and approval flow from Phase 2
- stable artifact model from Phase 1

### Acceptance tests

- a plugin install declares capabilities before activation
- a disabled plugin no longer contributes tools or UI
- an automation run leaves a queryable execution record
- exporting the same artifact twice yields deterministic output
- Gateway disconnection falls back to local routing without crashing the active run

### Exit criteria

- plugins cannot silently gain broad system access
- automations are observable, disable-able, and replayable
- export paths are deterministic and testable

## 8. Resolved Product Decisions

These were previously open. This roadmap resolves them.

1. Wedge
- Choose **document and file copilot** first.
- Browser operator stays experimental until the trust model is mature.

2. Artifact placement
- Use a dedicated artifact area or panel, not transcript-only rendering.
- Keep a compact inline summary in the transcript if helpful, but the artifact should be first-class.

3. MCP distribution
- Start with user-managed or curated local servers.
- Do not bundle a large remote catalog in the first serious release.

4. Collaboration timing
- Defer team collaboration until after single-user history, artifacts, and approvals are stable.

5. Browser operator policy risk
- Treat browser automation as opt-in, policy-reviewed, and non-core until service and ToS boundaries are clearer.

## 9. Package Plan

### Add in Phase 0

```bash
npm install -D eslint @eslint/js typescript-eslint globals
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom axe-core
```

### Add in Phase 1

```bash
npm install react-markdown remark-gfm remark-math rehype-highlight rehype-katex katex
npm install dompurify
npm install xterm @xterm/addon-fit
npm install allotment
npm install diff
npm install cmdk
```

### Add in Phase 2

```bash
npm install @modelcontextprotocol/sdk
npm install chokidar
npm install zod
```

### Add in Phase 3

```bash
# Ollama can use plain fetch
# Add local STT packages only if voice becomes a committed feature
```

## 10. Major Risks and Mitigations

### Embedded web AI tabs

Risk:

- fragile framing behavior
- CSP and login instability
- possible policy and maintenance issues

Mitigation:

- keep them experimental
- do not make them the primary workflow path

### Unsafe tool execution

Risk:

- accidental file damage
- unbounded shell behavior
- hidden side effects

Mitigation:

- approval model
- tool capability classes
- audit log
- path constraints

### Provider divergence

Risk:

- each provider grows its own message format and stream parser

Mitigation:

- provider adapter boundary
- one internal run event schema

### Plugin and MCP blast radius

Risk:

- third-party capabilities exceed user expectations

Mitigation:

- capability manifests
- least-privilege defaults
- visible server and plugin state

### Voice reliability

Risk:

- browser APIs behave inconsistently
- desktop permissions and devices vary

Mitigation:

- make voice optional
- prefer local STT if it becomes core

## 11. Operational Policies

### Observability

The app should emit structured local logs for:

- app startup and shutdown
- provider request start, completion, cancellation, and failure
- tool call start, completion, rejection, and timeout
- approval requested, approved, and denied
- MCP server connect, disconnect, and invocation failure
- plugin load, unload, and crash
- automation trigger, success, retry, and failure

Minimum observability outputs:

- local rolling log file
- developer console output in development
- a lightweight internal event viewer later if logs become too opaque

### Performance budgets

The roadmap should optimize for these baseline targets:

- cold start to visible shell: under 3 seconds on a normal dev machine
- session restore: under 1 second for recent history
- first token after submit: under 2 seconds for healthy remote providers
- local artifact switch: under 100 ms
- compare mode start: under 500 ms before first visual response state
- launcher open: under 150 ms
- guided builder first preview should be fast enough that non-expert users do not feel the system stalled before first visible output

These are budgets, not guarantees, but every phase should measure against them.

### Accessibility and motion policy

- keyboard-only navigation is required for:
  - sidebar navigation
  - session selection
  - command palette
  - settings
  - approvals
  - artifact review
- focus indication must be visually distinct from hover and selection.
- default hit targets should remain desktop-appropriate and consistent, especially in the title bar, sidebar, and context menus.
- reduced motion should disable decorative animation while preserving:
  - loading visibility
  - selection state changes
  - overlay entry and exit clarity
- contrast checks should be part of normal verification for both themes.

### Visual QA gate

- Each phase that changes the shell should keep an updated screenshot set for:
  - title bar
  - sidebar
  - workspace
  - artifact panel
  - settings
  - launcher or command palette if present
- Review the screenshot set in:
  - dark theme
  - light theme
  - reduced-motion mode where applicable
  - compact and normal desktop widths
- At least one review pass should use realistic content:
  - long session titles
  - large code blocks
  - long file paths
  - dense logs
  - multiple pending approvals
- Visual QA should explicitly reject:
  - token drift between screens
  - mismatched border, radius, or shadow usage
  - inconsistent selection and focus states
  - motion styles that feel like landing pages instead of desktop work surfaces

### UX review checklist

Every major UI milestone should be reviewed against these questions:

- Is the primary task obvious within five seconds?
- Is the active workspace unambiguous?
- Can the user tell what is running without reading a transcript line by line?
- Does every long-running action have visible progress, pause, or stop affordances?
- Are the result surface and the conversation surface clearly separated?
- Are settings grouped by user goal rather than by technical subsystem?
- Can a keyboard-oriented user complete the main flow faster than a mouse-only user?
- Does the app still feel composed with realistic, messy data instead of ideal demo content?

### Data migration policy

- schema changes must use explicit migrations
- migrations should be forward-only
- destructive migrations require a local backup step
- incompatible artifact schema changes require a version bump
- release notes should mention data-affecting changes

### Backup and recovery

- users should be able to export sessions and artifacts in machine-readable form
- the app should keep enough local data to recover from an interrupted run
- crash recovery should prefer replaying persisted run state instead of silently discarding it

### Release strategy

- `internal`: unstable features allowed behind flags
- `alpha`: core flows working, limited trusted users
- `beta`: upgrade and migration paths exercised, telemetry and logs reviewed
- `stable`: only features that meet the Definition of Done and have rollback plans

## 12. Milestone Mapping

| Milestone | Scope |
| --- | --- |
| `v0.2` | Phase 0 complete |
| `v0.3` | Phase 1 complete |
| `v0.4` | Phase 2 complete |
| `v0.5` | Phase 3 complete |
| `v1.0` | Phase 4 complete with hardened plugin and automation boundaries |

## 13. Definition of Done

A phase is not complete until all of the following are true:

- implementation is merged
- storage migrations are in place if schema changed
- typecheck passes
- unit tests cover the new feature path
- smoke or Electron runtime verification exists for user-critical flows
- permissions and failure states are visible in the UI
- the roadmap document is updated

## 14. Research Inputs

The roadmap above was strengthened using current official guidance and platform documentation, including:

- Electron `globalShortcut`:
  - `https://www.electronjs.org/docs/latest/api/global-shortcut`
- Electron `Tray`:
  - `https://www.electronjs.org/docs/latest/api/tray`
- Electron `contextBridge`:
  - `https://www.electronjs.org/docs/latest/api/context-bridge`
- Electron context isolation:
  - `https://www.electronjs.org/docs/latest/tutorial/context-isolation`
- Electron keyboard shortcuts:
  - `https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts`
- Windows design principles:
  - `https://learn.microsoft.com/windows/apps/design/`
- OpenAI Node SDK and current API guidance:
  - `https://www.npmjs.com/package/openai`
  - `https://platform.openai.com/docs/guides/structured-outputs/function-calling-vs-response-format`
- Anthropic MCP and Messages/API patterns:
  - `https://docs.anthropic.com/en/docs/mcp`
- Model Context Protocol architecture:
  - `https://modelcontextprotocol.io/legacy/concepts/architecture`
- MCP TypeScript SDK:
  - `https://www.npmjs.com/package/@modelcontextprotocol/sdk`
- MDN Web Speech API:
  - `https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API`
- Ollama official API docs in the official repository:
  - `https://github.com/ollama/ollama/blob/main/docs/api.md`
- Superhuman product-market-fit framework:
  - `https://review.firstround.com/how-superhuman-built-an-engine-to-find-product-market-fit/`
- Linear command menu:
  - `https://linear.app/changelog/2019-12-18-new-command-menu`
- Raycast Teams and day-one productivity model:
  - `https://www.raycast.com/blog/bringing-raycast-to-teams`
- Cursor company post index referencing context-collapsed support workflows:
  - `https://cursor.com/blog/topic/company`
- v0 docs:
  - `https://v0.app/docs`
  - `https://community.vercel.com/t/introducing-design-mode-on-v0/13225`
- Replit AI app builder and beginner flow:
  - `https://replit.com/usecases/ai-app-builder`
  - `https://docs.replit.com/getting-started/quickstarts/ask-ai`
  - `https://docs.replit.com/replitai/checkpoints-and-rollbacks`
  - `https://docs.replit.com/replitai/design-mode`
  - `https://docs.replit.com/getting-started/quickstarts/build-with-ai`
- Lovable publish model:
  - `https://docs.lovable.dev/features/publish`

It was also strengthened using local extracted design and motion references under `D:\\AI-Apps\\_extracted`, especially:

- `D:\\AI-Apps\\_extracted\\README.md`
- `D:\\AI-Apps\\_extracted\\02-linear-grid-animations.css`
- `D:\\AI-Apps\\_extracted\\04-raycast-effects.css`
- `D:\\AI-Apps\\_extracted\\06-framer-motion-patterns.tsx`
- `D:\\AI-Apps\\_extracted\\08-onboarding-tutorial-patterns.tsx`
- `D:\\AI-Apps\\_extracted\\09-dashboard-ui-patterns.tsx`
- `D:\\AI-Apps\\_extracted\\11-vercel-animations.css`
- `D:\\AI-Apps\\_extracted\\13-supabase-animations.css`
- `D:\\AI-Apps\\_extracted\\14-framer-effects.css`
- `D:\\AI-Apps\\_extracted\\15-resend-effects.css`
- `D:\\AI-Apps\\_extracted\\AutoClaw`
- `D:\\AI-Apps\\_extracted\\Linear`

These sources support the roadmap changes that prioritize:

- secure preload boundaries
- explicit tool approval
- stdio-first MCP client design
- local-first trust for desktop workflows
- treating browser embedding as optional rather than foundational
- semantic design tokens shared across the entire shell
- restrained desktop-grade motion instead of marketing-page animation
- command palette, sidebar, settings, and onboarding patterns that fit a power-user workbench
- drawer, overlay, collapsible, and shell-transition rules that remain stable under dense productivity use
- guided builder patterns such as plain-language creation, visual iteration, checkpoints, rollback, and preview-first feedback for non-experts

The roadmap was also sharpened using:

- `C:\\Users\\admin\\Projects\\usan\\apps\\pro\\docs\\ui-ux-reference-audit-2026-03-20.md`
- `C:\\Users\\admin\\Projects\\usan\\apps\\pro\\docs\\shell-spec-2026-03-20.md`
- `C:\\Users\\admin\\Projects\\usan\\apps\\pro\\docs\\guided-builder-user-flows-2026-03-20.md`
- `C:\\Users\\admin\\Projects\\usan\\apps\\pro\\docs\\progressive-disclosure-matrix-2026-03-20.md`
- `C:\\Users\\admin\\Projects\\usan\\apps\\pro\\docs\\preview-artifact-contract-2026-03-20.md`
- `C:\\Users\\admin\\Projects\\usan\\apps\\pro\\docs\\failure-recovery-ux-contract-2026-03-20.md`
- `C:\\Users\\admin\\Projects\\usan\\apps\\pro\\docs\\design-system-contract-2026-03-20.md`

## 15. Deferred Backlog

The following items are intentionally deferred until the core roadmap is stable:

- browser operator as a primary workflow
- public plugin marketplace
- team collaboration and shared live sessions
- hosted sync service
- broad voice-first product positioning
- large-scale web AI tab investment

## 16. Summary

The old roadmap had the right ambition but the wrong order.

The new order is:

1. harden the platform
2. make the core workspace trustworthy
3. add context and agent execution
4. add desktop leverage and local AI
5. open the ecosystem only after trust boundaries exist

That sequencing matches the current `apps/pro` baseline much better and materially reduces rework risk.
