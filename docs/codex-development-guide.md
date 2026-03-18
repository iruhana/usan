# Usan Codex Development Guide

> Technical implementation guide for AI coding agents (Codex, Claude Code, etc.)
> Date: 2026-03-18 (Final consolidated version)
> Status: Research complete ??ready for implementation
> Reference documents: `usan-superapp-prd-2026-03-18.md`, `ui-design-plan-2026-03-18.md`
> Research sources: 7 Chinese AI superapps, Notion, Linear, 900+ OpenClaw skills, Korean market analysis

---

## 0. Project Overview

**Usan (??⑥ろ뀰)** is a desktop-first AI superapp ??not a chatbot, but a unified execution container where users describe what they need and the agent plans, executes, seeks approval, and delivers artifacts.

- **Repo**: `C:\Users\admin\Projects\usan` (monorepo)
- **Desktop app**: `apps/desktop/` (Electron 35 + React 19 + TypeScript + Tailwind 4)
- **Web app**: `apps/web/` (Next.js 16 ??landing page only for now)
- **App ID**: `com.usan.app`
- **IPC bridge**: `window.usan` (preload-based, do NOT modify)
- **Target OS**: Windows first (64-bit only)

### Tech Stack (Confirmed ??Do Not Change)

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 35 |
| Build | electron-vite 5 |
| UI | React 19 + TypeScript |
| Styling | Tailwind 4 + CSS custom properties (`--usan-*`) |
| State | Zustand 5 (18 stores ??do NOT delete any) |
| Icons | lucide-react |
| Command palette | cmdk |
| Markdown | react-markdown + remark-gfm |
| DB | better-sqlite3 |
| Auth | Supabase |
| TTS | node-edge-tts |
| Image | sharp |
| PDF read | pdf-parse |
| Browser automation | playwright-core (CDP) |
| Input hooking | uiohook-napi |
| Auto-update | electron-updater |

---

## 1. UI Rebuild (Complete Overhaul)

The existing UI is being scrapped. Rebuild from scratch following `ui-design-plan-2026-03-18.md`.

### 1.1 Design Token Migration

Replace the current "Warm Clarity" system (`--color-*`) with the new `--usan-*` token system.

**Create these files:**

```
src/renderer/src/styles/
????? tokens.css          ??All --usan-* tokens (light + dark values)
????? theme-light.css     ??:root / [data-theme="light"] overrides
????? theme-dark.css      ??[data-theme="dark"] overrides
????? animations.css      ??All keyframes + transitions
```

**Token naming convention:** `--usan-{category}-{role}-{variant}`

**Bridge aliases required** ??map old `--color-*` to new `--usan-color-*` so existing components don't break during migration:

```css
:root {
  --color-primary: var(--usan-color-brand-primary);
  --color-text: var(--usan-color-text-primary);
  --color-bg: var(--usan-color-bg-page);
  /* ... map all existing tokens */
}
```

**Brand color change:** Purple `#8331f6` ??Blue `#2563eb` (light) / `#60a5fa` (dark)

Full token spec: `ui-design-plan-2026-03-18.md` 筌?

### 1.2 Layout Architecture

```
??????????????????????????????????????????????????????????????????????????????????????????????????????????????? Title Bar (32px, frameless, -webkit-app-region:drag)????????????????????????????????????????????????????????????????????????????????????????????????????????????????     ?? Agent Timeline / Artifact View               ????Side ?? ???????????????????????????????????????????????????????????????????????????????????????????bar  ?? ?? Main Content Area                       ??????64px ?? ?? (agent steps, artifacts, results)       ??????icon ?? ??????????????????????????????????????????????????????????????????????????????????????????? +   ?? ?? Universal Composer (input area)          ??????label?? ?? [chips] [attach] [mode] [send]          ????????????????????????????????????????????????????????????????????????????????????????????????????????????????? Status Bar (24px, task progress, connection status)  ???????????????????????????????????????????????????????????????????????????????????????????????????????????????```

**Navigation (5 items only):**

| Item | Icon (lucide) | Description |
|------|--------------|-------------|
| Home | `Home` | Recent tasks, resume, quick launch |
| Tasks | `ListTodo` | Job list (in-progress / approval / completed / failed) |
| Files | `FolderOpen` | File browsing + action-oriented operations |
| Tools | `Wrench` | Workflow launcher |
| Settings | `Settings` | Policy control surface (includes Account) |

**Sidebar:** 64px wide, frosted glass (`backdrop-filter: blur(20px)`), icons + labels stacked vertically.

**Responsive breakpoints:**

| Width | Layout |
|-------|--------|
| < 680px | Sidebar hidden, hamburger |
| 680-900px | Sidebar 48px icons only |
| 900-1200px | Sidebar 64px + main |
| 1200-1440px | Sidebar 64px + main + side panel |
| > 1440px | Full 3-panel |

**Minimum window:** 480 x 600. Default: 1200 x 800.

### 1.3 New File Structure

```
src/renderer/src/
????? styles/
??  ????? tokens.css
??  ????? theme-light.css
??  ????? theme-dark.css
??  ????? animations.css
????? components/
??  ????? shell/
??  ??  ????? AppShell.tsx        ??Main layout (replaces AppLayout.tsx)
??  ??  ????? Sidebar.tsx         ??64px frosted glass sidebar
??  ??  ????? TitleBar.tsx        ??Reuse + restyle existing
??  ??  ????? StatusBar.tsx       ??Reuse + restyle existing
??  ????? composer/
??  ??  ????? Composer.tsx        ??Universal Composer
??  ??  ????? ModeChips.tsx       ??Task mode selection chips
??  ??  ????? AttachMenu.tsx      ??File/folder/screenshot/voice attach
??  ????? agent/
??  ??  ????? Timeline.tsx        ??Agent execution timeline
??  ??  ????? StepItem.tsx        ??Individual step with status
??  ??  ????? ApprovalCard.tsx    ??Inline approve/reject UI
??  ????? artifact/
??  ??  ????? ArtifactView.tsx    ??Output viewer (markdown/code/table)
??  ??  ????? ArtifactShelf.tsx   ??Output list panel
??  ??  ????? CodeBlock.tsx       ??Syntax-highlighted code
??  ????? files/
??  ??  ????? FileExplorer.tsx    ??File browser
??  ??  ????? ListView.tsx        ??List view (default)
??  ??  ????? ActionBar.tsx       ??Action bar on selection
??  ????? ambient/
??  ??  ????? MiniLauncher.tsx    ??Ctrl+Space spotlight launcher
??  ??  ????? FloatingToolbar.tsx ??Context-aware floating menu
??  ????? settings/
??      ????? SettingsOverlay.tsx ??Full-screen settings (280px nav + content)
????? pages/
??  ????? HomePage.tsx            ??Rewrite: Timeline + Composer
??  ????? TasksPage.tsx           ??NEW: Job list
??  ????? FilesPage.tsx           ??Enhance: view modes + action bar
??  ????? ToolsPage.tsx           ??Minor restyle
??  ????? SettingsPage.tsx        ??Restructure: absorb Account
```

### 1.4 Files to Delete (After Migration)

```
DELETE: pages/WorkflowsPage.tsx
DELETE: pages/KnowledgePage.tsx
DELETE: pages/DashboardPage.tsx
DELETE: pages/MarketplacePage.tsx
DELETE: pages/AccountPage.tsx
DELETE: pages/NotesPage.tsx
DELETE: components/layout/AppLayout.tsx    (replaced by shell/AppShell)
DELETE: components/layout/Sidebar.tsx      (replaced by shell/Sidebar)
DELETE: components/chat/MessageBubble.tsx  (replaced by agent/Timeline)
DELETE: components/chat/ConversationList.tsx (absorbed into TasksPage)
DELETE: components/calendar/*
DELETE: components/email/*
DELETE: components/macro/*
DELETE: components/clipboard/*
DELETE: components/file-org/*
DELETE: components/image/*
DELETE: components/monitors/*
DELETE: components/proactive/*
DELETE: components/marketplace/*
DELETE: components/knowledge/*
DELETE: components/workflow/*
DELETE: components/hotkeys/*
DELETE: components/orchestration/*
DELETE: components/context/*
DELETE: components/vision/*
```

**DO NOT DELETE:** Any Zustand store file (`src/stores/*.store.ts`), any main process file, preload files, accessibility components, voice components, ui primitives, ErrorBoundary, NotificationToast, UndoToast, OfflineBanner, SkillRunner, SafetyConfirmationModal, MCP components, OnboardingWizard, i18n files, lib utilities.

### 1.5 Implementation Order

| Phase | What | Depends On |
|-------|------|-----------|
| 0 | Design tokens + CSS files + directory scaffold | Nothing |
| 1 | AppShell + Sidebar + navigation constants | Phase 0 |
| 2 | Composer + Timeline + HomePage rewrite + TasksPage | Phase 1 |
| 3 | ArtifactView + ArtifactShelf + Files enhancement | Phase 2 |
| 4 | Settings restructure + Account absorption + dead code deletion | Phase 1 |
| 5 | MiniLauncher (Ambient Entry) | Phase 2 |
| 6 | Polish: react-window virtualization, skeletons, a11y, i18n | All above |

### 1.6 Animation Philosophy & Spec

#### Core Principle: "Minimal Daily, Impressive First Impression"

Inspired by **Notion** (ultra-restrained, 1 keyframe total) and **Linear** (buttery smooth onboarding).

- **Daily use**: Almost no animation. Subtle opacity transitions only (Notion approach).
- **First launch / onboarding**: Smooth, premium entrance animations that hook users (Linear approach).
- **Rule**: If a user sees it 100 times, it should be near-invisible. If they see it once, make it memorable.

#### Tier 1: Hook Moments (Rich Animation ??First-Time Only)

These play ONCE per user lifecycle. Smooth, cinematic, premium.

| Moment | Animation | Duration |
|--------|-----------|----------|
| **App first launch** | Logo scale-in + fade, background gradient reveal | 1.2s ease-out |
| **Onboarding wizard** | Step slides with spring easing, content stagger-in | 0.4s per step |
| **First conversation** | Composer rises from bottom with slight bounce | 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) |
| **First agent task complete** | Timeline steps cascade checkmarks, artifact card scales in | 0.3s stagger |
| **First theme switch** | Cross-fade with subtle scale pulse | 0.6s ease |
| **Ambient Entry first use** | MiniLauncher drops in with backdrop blur reveal | 0.3s ease-out |

Implementation: Track `firstRunFlags` in settings store. After first play, these degrade to Tier 2.

#### Tier 2: Daily Transitions (Minimal ??Notion Style)

These are seen constantly. Must be near-invisible.

```css
/* Quick state changes (hover, focus, active) */
--usan-transition-fast: opacity 0.15s ease;

/* Sidebar collapse/expand */
--usan-transition-sidebar: width 0.2s ease, opacity 0.15s ease;

/* Page switch */
--usan-transition-page: opacity 0.12s ease;

/* Modal/overlay entrance */
--usan-transition-overlay: opacity 0.15s ease-out;

/* Agent step appear */
--usan-transition-step: opacity 0.2s ease;

/* Launcher open */
--usan-transition-launcher: opacity 0.12s ease-out, transform 0.12s ease-out;
```

#### Tier 3: Ambient Polish (Barely Perceptible)

Borrowed directly from Notion's premium patterns:

```css
/* Shimmer loading ??ultra-subtle (Notion: 0.03 alpha) */
@keyframes usan-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.usan-shimmer::before {
  content: "";
  position: absolute;
  width: 100%; height: 100%;
  z-index: 1;
  animation: usan-shimmer 1s linear infinite;
}
[data-theme="light"] .usan-shimmer::before {
  background: linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.03) 50%, rgba(0,0,0,0) 100%);
}
[data-theme="dark"] .usan-shimmer::before {
  background: linear-gradient(90deg, rgba(86,86,86,0) 0%, rgba(86,86,86,0.1) 50%, rgba(86,86,86,0) 100%);
}

/* Hover opacity micro-steps (Notion pattern) */
/* Instead of 0 ??0.1, use 0 ??0.025 ??0.04 for "whispered" interactions */
--usan-hover-subtle: 0.04;
--usan-hover-medium: 0.08;
--usan-hover-strong: 0.12;

/* Near-invisible scrollbar (Notion: 0.05 alpha) */
::-webkit-scrollbar { width: 8px; background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}
[data-theme="dark"] ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
}

/* Dark mode inner-glow shadows (Notion premium technique) */
--usan-shadow-dark-glow: 0 0.5px 0 0 rgba(255,255,255,0.12) inset,
                          0 0 1px 1px rgba(255,255,255,0.04);

/* Sidebar dividers ??box-shadow based, not border (smoother) */
--usan-divider-sidebar: inset -1px 0 0 0 var(--usan-color-border-secondary);
```

#### Tier 4: Window-Level Polish (Electron Main Process)

```typescript
// Prevent white flash on startup (Linear pattern)
new BrowserWindow({
  show: false,                    // Hidden until ready
  backgroundColor: '#00000000',   // Transparent initial
  // ...
});
win.once('ready-to-show', () => {
  win.show();
  win.focus();
});

// Dynamic background on theme change (Linear pattern)
function updateWindowTheme(isDark: boolean) {
  win.setBackgroundColor(isDark ? '#0f0f14' : '#f9fafb');
}
```

#### What NOT to Animate

- Page-to-page navigation (just opacity crossfade, 120ms max)
- List item hover states (opacity change only, no scale/translate)
- Button clicks (color transition only, 150ms)
- Repeated toast notifications (fade in/out only)
- Settings toggles (instant state change, no transition)
- Any element the user sees more than 10 times per session

#### Linear Motion System Reference (Extracted from linear.app)

Linear uses **Framer Motion** (`vendor-motion.D5e2X2Ti.js`, 141KB). Apply these patterns to Tier 1 Hook moments:

**Spring presets (from Linear's production code):**

```typescript
// Framer Motion spring configs extracted from Linear
const LINEAR_SPRINGS = {
  // Default ??smooth, no bounce (used most frequently)
  default: { type: "spring", stiffness: 100, damping: 18, mass: 1, bounce: 0 },

  // Quick snap ??instant feel
  snap: { type: "spring", stiffness: 500, damping: 30, bounce: 0 },

  // Gentle elastic ??subtle overshoot for delightful moments
  elastic: { type: "spring", stiffness: 200, damping: 18, bounce: 0.15 },

  // Bouncy ??eye-catching, use ONLY for first-run hooks
  bouncy: { type: "spring", stiffness: 550, damping: 10, bounce: 0.3 },
};

// Duration-based transitions (for non-spring animations)
const LINEAR_DURATIONS = {
  instant: 0,
  micro: 0.1,    // CSS token equivalent
  fast: 0.15,    // Most common ??hover, small reveals
  medium: 0.2,   // Settings transitions, panel switches
  slow: 0.3,     // Page transitions, dialogs
  hero: 0.5,     // Main content reveals
  cinematic: 1.5, // Hero/onboarding animations
};
```

**Linear Framer Motion usage stats:**
- `layoutId`: 73 instances ??layout animation is Linear's core motion pattern
- `whileTap`: 16 ??tactile press feedback
- `whileHover`: 15 ??hover reveals
- `AnimatePresence`: enter/exit orchestration
- `bounce: 0` used 34 times vs `bounce: 0.15` used 22 times ??**no-bounce spring is the default**

**CSS transition tokens (from Linear's stylesheets):**

```css
--usan-duration-instant: 0s;
--usan-duration-micro: 0.1s;
--usan-duration-fast: 0.15s;    /* Linear's most-used */
--usan-duration-medium: 0.25s;
--usan-duration-slow: 0.35s;
```

**New dependency for Tier 1 animations:**

```bash
npm install motion    # Framer Motion v12+ (renamed to "motion")
```

Use `motion` ONLY for Tier 1 Hook moments (onboarding, first-run). All Tier 2/3 daily animations use pure CSS transitions.

### 1.7 Competitive Intelligence (Integrated into Design)

#### What competitors are doing (2026)

| Competitor | Key Feature | Usan Takeaway |
|-----------|------------|---------------|
| **Doubao 2.0** (155M WAU) | Multi-step workflow execution, not just Q&A | Validate our Agent Timeline approach |
| **Kimi Claw** | Persistent browser agent + 5000 community skills + 40GB cloud | MCP skill marketplace + cloud storage for artifacts |
| **Quark** | Voice + photo multimodal input, MCP integration with Alibaba ecosystem | Multimodal Composer input, ecosystem connectors |
| **ChatGPT Desktop** | Alt+Space hotkey, screenshot sharing, Canvas for code/writing collaboration | Ambient Entry (Ctrl+Space), Artifact Layer editing |
| **Claude Desktop** | Cowork (file read/edit/create), browser control, workflow recording | Our Agent Runtime already covers this |
| **Cursor** | Subagents in parallel, background tasks, PR review | Multi-agent orchestration (swarm skill) |

#### Industry trends to incorporate

1. **Agentic commerce**: Users complete transactions inside AI chat (Alibaba, Doubao) ??Connector Hub must support e-commerce actions
2. **40% enterprise apps will have AI agents by 2026** (Gartner) ??Enterprise tier with team features
3. **MCP is becoming the standard** (Linux Foundation) ??Already implemented, keep extending
4. **Computer-use agents** are mainstream ??Screen understanding via accessibility tree (P2)
5. **Glassmorphism for AI interfaces** is the 2026 design trend ??Already in our frosted glass sidebar

### 1.8 Premium UX Patterns (Extracted from Notion + Linear)

Apply these patterns throughout the UI for a polished, native desktop feel:

```css
/* === NOTION PATTERNS === */

/* 1. Ultra-subtle shimmer (already in Tier 3 above) */

/* 2. Warm neutral palette ??NOT pure gray */
--usan-color-text-warm: rgba(55, 53, 47, 0.85);  /* Notion light text base */

/* 3. Antialiased text rendering (apply globally) */
* { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

/* 4. Sidebar dividers ??use box-shadow, NOT border */
.sidebar-divider { box-shadow: inset -1px 0 0 0 var(--usan-color-border-secondary); }

/* 5. RTL-ready logical properties */
/* Use paddingInlineStart/End instead of paddingLeft/Right */

/* === LINEAR PATTERNS === */

/* 6. cursor: default on buttons (native desktop feel, NOT pointer) */
.usan-btn { cursor: default; }

/* 7. Font weight 450 (optical medium ??between regular and medium) */
--usan-font-weight-body: 450;

/* 8. Button shadow system */
--usan-shadow-btn: rgba(0,0,0,0.02) 0px 3px 6px -2px, rgba(0,0,0,0.043) 0px 1px 1px;

/* 9. Theme colors (reference) */
/* Linear dark: #090909 | Linear light: #ffffff */
/* Linear accent dark: #7282ff | Linear accent light: #3e5fd8 */
```

### 1.9 Key Constraints

- **DO NOT use React Router** ??keep the existing `useState<AppPage>` pattern in AppShell
- **DO NOT modify any Zustand store interfaces** ??only change how stores are consumed in components
- **DO NOT modify `window.usan` IPC bridge** ??renderer reads from it, never writes to it
- **Reinterpret `useChatStore`** ??`ChatChunk` types (tool_call, tool_result, text, done, error) render as Timeline steps, not chat bubbles. Store interface stays the same.
- **Unknown page names** in navigation events ??fallback to `'home'`
- **Theme toggle**: support both `data-theme="light|dark"` attribute AND `.dark` class (for backward compat during migration)
- **Use `motion` library ONLY for Tier 1 Hook animations** ??all daily transitions must be pure CSS
- **`cursor: default`** on all buttons (Linear pattern ??native desktop feel)
- **`-webkit-font-smoothing: antialiased`** globally (Notion pattern)

---

## 2. New Dependencies to Add

### 2.1 P0 ??Required for UI Rebuild

```bash
npm install allotment          # Resizable split panels (Artifact + Timeline)
npm install react-window       # Virtualized lists (Files, Tasks)
npm install rehype-highlight   # Code syntax highlighting
npm install motion             # Framer Motion v12+ (Tier 1 hook animations ONLY)
```

### 2.2 P1 ??Infrastructure

```bash
# Multi-model routing
npm install ai @ai-sdk/anthropic @ai-sdk/openai @ai-sdk/google

# Document processing (all pure JS, no native deps)
npm install pdf-lib            # PDF create/edit/merge
npm install docx               # Word document generation
npm install exceljs            # Excel read/write
npm install pptxgenjs          # PowerPoint creation

# RAG enhancement
npm install sqlite-vec         # Vector search (extends existing better-sqlite3)

# Voice STT
npm install whisper-node-addon # Local Whisper STT (native addon)
```

### 2.3 P2 ??Extended Features

```bash
# Local AI
npm install node-llama-cpp     # Local LLM inference (GGUF models)

# Math rendering
npm install rehype-katex katex # KaTeX for math formulas

# Diagram generation
npm install mermaid            # Mermaid diagram rendering
```

---

## 3. Technical Infrastructure Tasks

### 3.1 Multi-Model Routing (P0)

**Location:** `src/main/ai/`

Replace direct Anthropic SDK usage with Vercel AI SDK 6 for unified model routing.

```typescript
// Model routing strategy
const ROUTING_TABLE = {
  'complex-reasoning': { primary: 'claude-opus-4', fallback: 'gpt-4o' },
  'code-generation':   { primary: 'claude-sonnet-4', fallback: 'gpt-4o-mini' },
  'quick-chat':        { primary: 'claude-haiku-4', fallback: 'gemini-flash' },
  'summarization':     { primary: 'claude-sonnet-4', fallback: 'gemini-pro' },
  'vision':            { primary: 'claude-sonnet-4', fallback: 'gpt-4o' },
  'embeddings':        { primary: 'local-onnx', fallback: 'openai-embeddings' },
  'offline':           { primary: 'ollama-qwen3', fallback: 'node-llama-cpp' },
};
```

**Fallback chain:** Primary cloud ??secondary cloud ??local model (Ollama/node-llama-cpp)

### 3.2 RAG Enhancement (P0)

**Location:** `src/main/rag/`

Extend existing better-sqlite3 with:
1. **sqlite-vec** for vector similarity search
2. **FTS5** for full-text keyword search
3. **Hybrid search**: combine BM25 (FTS5) + vector similarity, re-rank with reciprocal rank fusion

```sql
-- Vector table
CREATE VIRTUAL TABLE vec_documents USING vec0(
  embedding float[384]  -- all-MiniLM-L6-v2 dimension
);

-- Full-text table
CREATE VIRTUAL TABLE fts_documents USING fts5(
  title, content, tokenize='unicode61'
);
```

### 3.3 Security & Agent Governance (P0)

**Location:** `src/main/security/`

Implement 4-tier privilege ring system:

| Ring | Access Level | Approval |
|------|-------------|----------|
| 0 | Read-only queries (search, read file metadata) | None |
| 1 | File read, web fetch | None |
| 2 | File write, send message (user-approved dirs) | First-time per directory |
| 3 | System commands, delete, install, admin ops | Every time (PRD 筌? Principle 7) |

Additional requirements:
- Append-only audit log (SQLite table) for every tool call
- Ed25519 cryptographic identity per agent session
- Prompt injection defense (port `security-sentinel` + `input-guard` skills)
- Time-bound capability tokens per agent session

### 3.4 Document Processing Engine (P1)

**Location:** `src/main/documents/`

```
documents/
????? pdf-engine.ts       ??pdf-lib (create/edit) + pdf-parse (read)
????? docx-engine.ts      ??docx (create) + officeparser (read)
????? xlsx-engine.ts      ??exceljs (read/write)
????? pptx-engine.ts      ??pptxgenjs (create)
????? hwpx-engine.ts      ??Custom XML/ZIP parser (Korean gov docs)
????? converter.ts        ??Cross-format conversion orchestrator
```

**HWPX parsing** (Korean government document format):
- HWPX is XML inside a ZIP file (KS X 6101 standard)
- Use `adm-zip` or Node.js `zlib` to unzip, then parse XML
- This is a significant competitive moat ??no global AI app supports HWP/HWPX

### 3.5 Voice STT Integration (P1)

**Location:** `src/main/voice/`

- Implemented on 2026-03-19 with local-first Whisper STT in `src/main/voice/`
- Uses `@kutalia/whisper-node-addon` (Electron-friendly `whisper-node-addon` fork) with multilingual `ggml-base.bin`
- Composer now tries preload voice IPC first and falls back to browser Web Speech only when the desktop bridge cannot start
- Korean language priority remains the default model choice rationale

### 3.6 Local AI / Offline Mode (P1)

**Location:** `src/main/ai/local/`

- Detect user-installed Ollama (`http://localhost:11434/api/tags`)
- If no Ollama, use `node-llama-cpp` with bundled small model (Phi-3-mini or Qwen2-0.5B, ~500MB)
- Offline-capable features: file summarization, text editing, code explanation
- Embedding generation via local ONNX model (all-MiniLM-L6-v2) for offline RAG

### 3.7 Screen Understanding (P2)

**Location:** `src/main/computer/`

Primary approach: **Accessibility Tree** (10x more efficient than screenshots)
- Windows: UI Automation API via PowerShell or native addon
- Read window element tree ??structured JSON ??agent can interact

Secondary approach: **Vision model** fallback
- For apps without accessibility support
- Send screenshot to Claude/GPT vision model

### 3.8 MCP Routing Architecture (P1)

**Location:** `src/main/mcp/`

Implemented on 2026-03-19 with:

- `app-detector.ts` + `router.ts` returning route plus provider readiness
- internal adapters for `playwright` and `qt-bridge`
- MCP-backed adapters for `chrome-devtools` and `windows-mcp`
- central `src/main/mcp/index.ts` orchestration entry point
- generic routing tools for provider status, provider tool listing, and routed provider calls

```
mcp/
????? router.ts           ??MCP Router (new)
????? app-detector.ts     ??Framework detection (new)
????? providers/
??  ????? playwright.ts   ??Browser automation (existing)
??  ????? cdp.ts          ??Chrome DevTools Protocol (new)
??  ????? windows.ts      ??Windows UI Automation (new)
??  ????? qt-bridge.ts    ??UBridge-Qt (new, see UBridge-Qt-guide.md)
????? index.ts
```

**Detection rules:**

| Condition | Route To |
|-----------|----------|
| `electron.exe` / `*.asar` | CDP |
| `WebView2Loader.dll` | CDP |
| `libcef.dll` | CDP |
| Chrome / Edge / Firefox | Playwright |
| `Qt*.dll` / `qml*.exe` | UBridge-Qt |
| Other (Win32/WPF/UWP) | windows-mcp |

---

## 4. Skills Porting Guide

### 4.1 Skill Architecture

**Location:** `src/main/skills/built-in/`

Each skill is a directory with:
```
skill-name/
????? skill.json          ??Metadata, triggers, description
????? index.ts            ??Main implementation
????? scripts/            ??Helper scripts (PowerShell, Python) if needed
```

### 4.2 Priority Porting List

#### MUST-PORT (Sprint 1)

| Skill | Source | Purpose | Notes |
|-------|--------|---------|-------|
| **security-sentinel** | `openclaw/Skill/security-sentinel-skill` | Prompt injection defense | Multi-layer detection, penalty scoring, 15+ languages |
| **input-guard** | `openclaw/Skill/input-guard` | External data injection defense | Complements security-sentinel, Korean/Japanese/Chinese patterns |
| **naver-news** | `openclaw/Skill/naver-news` | Korean news search | Naver API, auto-pagination, time filtering |
| **deep-research-pro** | `openclaw/Skill/deep-research-pro` | Multi-source research | DuckDuckGo (no API key), citations, multi-cycle |
| **tavily-search-pro** | `openclaw/Skill/tavily-search-pro` | 5-in-1 search API | Search, extract, crawl, map, research |

#### HIGH-VALUE (Sprint 2)

| Skill | Source | Purpose | Notes |
|-------|--------|---------|-------|
| **proactive-agent** | `openclaw/Skill/proactive-agent` | WAL Protocol, proactive behavior | Context loss prevention, self-improvement |
| **swarm** | `openclaw/Skill/swarm` | Cost-saving parallel execution | Gemini Flash workers, 200x cost reduction |
| **agent-orchestrator** | `openclaw/Skill/agent-orchestrator` | Multi-agent decomposition | File-based agent communication |
| **agent-team-orchestration** | `openclaw/Skill/agent-team-orchestration` | Role-based agent teams | Orchestrator/Builder/Reviewer/Ops roles |
| **causal-inference** | `openclaw/Skill/causal-inference` | Action logging + outcome prediction | Causal graphs from historical data |
| **proactive-tasks** | `openclaw/Skill/proactive-tasks` | Autonomous task execution | Dependency-aware queue + heartbeat |
| **translate** | `openclaw/Skill/translate` | Translation with formatting preservation | Cultural adaptation, formality handling |

#### OFFICE SUITE (Sprint 3)

| Skill | Source | Purpose | Notes |
|-------|--------|---------|-------|
| **pdf** | `openclaw/Skill/pdf` | PDF toolkit | Extract, merge, split, create, fill forms |
| **word-docx** | `openclaw/Skill/word-docx` | Word document generation | Full DOCX structure knowledge |
| **excel-xlsx** | `openclaw/Skill/excel-xlsx` | Excel manipulation | Date handling, formula support |
| **powerpoint-pptx** | `openclaw/Skill/powerpoint-pptx` | PowerPoint creation | python-pptx reference |
| **diagram-generator** | `openclaw/Skill/diagram-generator` | Diagram generation | Mermaid, draw.io, Excalidraw |
| **table-image-generator** | `openclaw/Skill/table-image-generator` | PNG table generation | Uses sharp (already in stack) |
| **summarize** | `openclaw/Skill/summarize` | URL/file summarization | Multi-format, length control |
| **image-ocr** | `openclaw/Skill/image-ocr` | OCR text extraction | Tesseract, multi-language |

#### THINKING TOOLS (Sprint 3)

| Skill | Source | Purpose |
|-------|--------|---------|
| **first-principles-decomposer** | `openclaw/Skill/first-principles-decomposer` | Break problems to fundamentals |
| **decision-trees** | `openclaw/Skill/decision-trees` | EV-based decision analysis |
| **pre-mortem-analyst** | `openclaw/Skill/pre-mortem-analyst` | Failure analysis before execution |
| **business-model-canvas** | `openclaw/Skill/business-model-canvas` | BMC with solopreneur adaptations |
| **plan-my-day** | `openclaw/Skill/plan-my-day` | Energy-optimized daily planning |
| **daily-briefing** | `openclaw/Skill/daily-briefing` | Morning briefing (weather+calendar+email) |

#### BROWSER & DESKTOP AUTOMATION (Sprint 4)

| Skill | Source | Purpose |
|-------|--------|---------|
| **agent-browser** | `openclaw/Skill/agent-browser` | Rust-based fast browser automation |
| **stealth-browser** | `openclaw/Skill/stealth-browser` | Anti-detection, Cloudflare bypass |
| **windows-control** | `openclaw/Skill/windows-control` | Full Windows desktop automation |
| **windows-ui-automation** | `openclaw/Skill/windows-ui-automation` | PowerShell UI Automation |

#### COMMUNICATION (Sprint 4)

| Skill | Source | Purpose |
|-------|--------|---------|
| **imap-smtp-email** | `openclaw/Skill/imap-smtp-email` | Full email protocol support |
| **google-calendar** | `openclaw/Skill/google-calendar` | Google Calendar API |
| **caldav-calendar** | `openclaw/Skill/caldav-calendar` | Generic calendar sync |
| **language-learning** | `openclaw/Skill/language-learning` | AI language tutor |

### 4.3 Porting Rules

1. **Rebrand**: Replace all OpenClaw references with Usan
2. **Korean-first**: All user-facing strings in Korean, with i18n support
3. **IPC compliance**: Skills run in main process, expose via `window.usan` IPC
4. **Security**: Skills must declare required privilege ring (0-3)
5. **NOTICE file**: Maintain Apache 2.0 attribution for OpenClaw-derived skills

---

## 5. Korean Market Integrations

### 5.1 API Integrations (P1)

| Service | API | Priority | Notes |
|---------|-----|----------|-------|
| **Naver Search** | Naver Open API (client ID + secret) | P0 | News, blog, cafe, shopping, encyclopedia |
| **Naver Login** | OAuth 2.0 | P1 | Access token for user-specific APIs |
| **Kakao Login** | OAuth 2.0 (developers.kakao.com) | P1 | Required for KakaoTalk integration |
| **KakaoTalk Message** | Kakao Messaging API | P1 | Send messages (already have skill) |
| **Kakao Calendar** | TalkCalendar REST API | P2 | Schedule management |
| **KakaoMap** | Kakao Maps API | P2 | Location services |
| **Open Banking** | ?ル??戮⑹물?⑥ъ젷??API (developers.kftc.or.kr) | P2 | Account info, payments |
| **Government24** | data.go.kr Open API | P2 | Public service queries |
| **Hometax** | Via intermediary (Barobill) | P3 | Tax invoice queries |
| **Coupang** | Coupang Open API | P3 | Shopping integration |

### 5.2 HWPX Parser (P1)

**This is a competitive moat** ??no global AI app handles Korean government documents.

```typescript
// src/main/documents/hwpx-engine.ts
// HWPX = ZIP containing XML files following KS X 6101 (OWPML)
//
// Structure:
// document.hwpx (ZIP)
// ????? META-INF/manifest.xml
// ????? Contents/
// ??  ????? header.xml      ??Document metadata
// ??  ????? section0.xml    ??Main content (paragraphs, tables)
// ??  ????? section1.xml    ??Additional sections
// ????? BinData/            ??Embedded images
// ????? Preview/            ??Thumbnail
//
// Use adm-zip to unzip, then xml2js or fast-xml-parser to parse sections.
// Extract text from <hp:t> elements within <hp:run> within <hp:p> elements.
```

### 5.3 Korean Honorific Handling (P0)

**Critical** ??getting ?브퀡??濡녹춹??꾩룇瑗뜹퐲?wrong is socially unacceptable in Korea.

```typescript
// src/main/ai/korean-honorifics.ts

type HonorificLevel = 'formal' | 'polite' | 'casual';

// Default: 'polite' (??怨몃뭵嶺? ??safe for all contexts
// User setting: allow override to 'formal' (??諛몃떔嶺? or 'casual' (??怨댄뜢/?꾩룇瑗뜹퐲?
// Business context: always 'formal'
// System prompts must include honorific instruction based on user preference
```

### 5.4 Korean Regulatory Compliance (P0 ??Before Launch)

| Requirement | Law | Implementation |
|------------|-----|---------------|
| Privacy policy | PIPA | Separate document, always accessible in-app |
| Consent UI | PIPA | First-run: mandatory/optional consent separation |
| AI API third-party transfer consent | PIPA | First-run: explicit AI API data transfer notice |
| AI-generated content label | AI Basic Act (2026-01-22) | Default ON label on all AI outputs, user toggle OFF |
| Domestic representative | PIPA + AI Basic Act | Celovin (??蹂λ윟 ?뺢퀡踰?? acts as representative |
| Connector-level consent | PIPA | Per-connector permission popup (first connect) |
| Data portability | PIPA (2025-03) | Export user data in machine-readable format |
| Audit trail | AI Basic Act | Log all AI decisions for high-impact actions |

---

## 6. Proactive & Agent Intelligence

### 6.1 WAL Protocol (from proactive-agent)

**Location:** `src/main/ai/wal/`

Write-Ahead Logging to survive context loss:
- Before any multi-step task, write plan to WAL file
- On context truncation/crash, recover from WAL
- Session state persisted in `SESSION-STATE.md` format

### 6.2 Causal Inference Engine (from causal-inference)

**Location:** `src/main/ai/causal/`

- Log all agent actions with pre/post state + outcome
- Build causal graphs per domain (email, calendar, files, web)
- Backfill from existing email/calendar/message history
- Enable "what happens if I do X?" predictions

### 6.3 Cost Optimization (from swarm)

**Location:** `src/main/ai/swarm/`

- Offload parallel/batch tasks to cheaper models (Gemini Flash)
- Chain pipeline with depth presets (quick/standard/deep/exhaustive)
- Perspectives: extractor, analyst, critic, synthesizer
- Target: 200x cost reduction for research-type tasks

---

## 7. Testing Requirements

### 7.1 Existing Tests

- 123 unit tests passing (vitest + @testing-library/react + axe-core)
- E2E test infrastructure exists (`data-action`, `data-page-id` attributes)

### 7.2 New Test Requirements

- Every new component must have at least one vitest unit test
- Accessibility: all new components must pass axe-core checks
- All new components must support `data-testid` attributes
- Timeline component: test all 5 step states (completed, running, awaiting, failed, pending)
- Composer: test mode switching, attachment, send flow
- Settings: test all sections render correctly

---

## 8. Performance Targets

| Metric | Target |
|--------|--------|
| App cold start | < 3 seconds |
| Page navigation | < 100ms |
| Timeline step render | < 50ms |
| File list (1000 items) | < 200ms (virtualized) |
| Composer input latency | < 16ms (60fps) |
| Theme switch | < 100ms |
| Mini launcher open | < 150ms |

---

## 9. Coding Standards

- **Language**: TypeScript strict mode
- **Components**: Functional components with hooks only (no class components)
- **Styling**: Tailwind utility classes + `--usan-*` CSS custom properties
- **State**: Zustand stores for shared state, `useState` for local state
- **Imports**: Absolute imports from `@renderer/` prefix
- **Naming**: PascalCase for components, camelCase for functions/variables, kebab-case for files
- **i18n**: All user-facing strings via `t()` function from `src/i18n/`
- **Accessibility**: ARIA labels on all interactive elements, focus management for modals
- **Error handling**: Try-catch on all IPC calls, user-facing error formatting via `lib/user-facing-errors.ts`

---

## 10. Phase Plan (Master Schedule)

### Work Assignment Labels

Tasks are labeled for routing between agents:

| Label | Assignee | Criteria |
|-------|----------|----------|
| **[Claude]** | Claude Code (main session) | Structure, CSS, config, skill porting, docs |
| **[Codex]** | Codex (parallel agent) | Complex coding, architecture changes, new engines |

**Backend tasks [Codex I/J/K/M/N] can start immediately (no frontend dependency).**
**Frontend tasks [Codex A-H, L] require Phase 0 completion first.**

### Phase 0: Foundation ????COMPLETED

| # | Task | Label | Status |
|---|------|-------|--------|
| 0.1 | Design tokens CSS (`styles/tokens.css`) | [Claude] | ??Done |
| 0.2 | Theme files (`theme-light.css`, `theme-dark.css`) | [Claude] | ??Done |
| 0.3 | Animation system (`animations.css`) | [Claude] | ??Done |
| 0.4 | `globals.css` refactor (import structure) | [Claude] | ??Done |
| 0.5 | Navigation constants (5 items) | [Claude] | ??Done |
| 0.6 | Directory scaffold (7 barrel files) | [Claude] | ??Done |

### Phase 1: Foundation (UI Rebuild + Core Infra)

| # | Task | Label | Priority |
|---|------|-------|----------|
| 1.1 | **[x] [Codex-A]** AppShell.tsx (implemented on 2026-03-18; main layout, overlay wiring, keyboard) | [Codex] | P0 |
| 1.2 | **[x] [Codex-B]** Sidebar.tsx (implemented on 2026-03-18; 64px frosted glass, responsive 3-stage) | [Codex] | P0 |
| 1.3 | **[x] [Codex-C]** Universal Composer (implemented on 2026-03-18; mode chips, attach menu, prompt shaping, file picker IPC) | [Codex] | P0 |
| 1.4 | **[x] [Codex-D]** Agent Timeline (implemented on 2026-03-18; execution-step timeline, approval card, streaming mapping, accessibility + tests) | [Codex] | P0 |
| 1.5 | **[x] [Codex-E]** HomePage rewrite (implemented on 2026-03-18; timeline-first layout, quick launch panel, recent work rail, composer integration) | [Codex] | P0 |
| 1.6 | **[x] [Codex-F]** TasksPage (implemented on 2026-03-18; jobs list, status filters, detail timeline, resume/retry/delete actions, accessibility + tests) | [Codex] | P0 |
| 1.7 | **[Codex-I]** Multi-model routing (OpenRouter-first implementation complete; Vercel AI SDK deferred) | [Codex] | P0 |
| 1.8 | **[Codex-K]** Security: prompt injection defense + 4-tier rings (implemented on 2026-03-18; staged ring 3 approvals + append-only audit log) | [Codex] | P0 |
| 1.9 | **[x]** Korean honorific system + agent-loop integration | [Claude] | P0 |
| 1.10 | **[x]** Port: security-sentinel, input-guard | [Claude] | P0 |
| 1.11 | **[x]** Port: naver-news, deep-research-pro, tavily-search-pro | [Claude] | P0 |
| 1.12 | **[x]** Light/Dark theme + high contrast finalization | [Claude] | P1 |
| 1.13 | **[Codex-J]** RAG enhancement (SQLite hybrid retrieval implementation complete) | [Codex] | P1 |
| 1.14 | **[Codex-H]** Settings restructure (implemented on 2026-03-18; policy-surface layout + Account absorbed) | [Codex] | P1 |

### Phase 2: Expansion (Documents + Skills + Automation)

| # | Task | Label | Priority |
|---|------|-------|----------|
| 2.1 | **[Codex-N]** HWPX parser (implemented on 2026-03-18; ZIP/XML parser + RAG extraction path complete) | [Codex] | P1 |
| 2.2 | **[x]** Document engine: PDF/DOCX/XLSX/PPTX wrappers | [Claude] | P1 |
| 2.3 | **[Codex-G]** ArtifactView + ArtifactShelf (implemented on 2026-03-18; artifact workspace + multi-renderer shipped) | [Codex] | P1 |
| 2.4 | **[x] [Codex]** Files page enhancement (implemented on 2026-03-18; list/grid/column views, action bar, virtualization, Windows path fix) | [Codex] | P1 |
| 2.5 | **[x] [Codex]** Voice STT (`@kutalia/whisper-node-addon` local-first path completed on 2026-03-19) | [Codex] | P1 |
| 2.6 | **[x] [Codex]** MCP routing (app-detector + router + provider adapters completed on 2026-03-19) | [Codex] | P1 |
| 2.7 | **[x]** Port: proactive-agent, swarm, agent-orchestrator, causal-inference | [Claude] | P1 |
| 2.8 | **[x]** Port: Office suite + thinking + automation + translate + summarize (28 skills) | [Claude] | P1 |
| 2.9 | **[x] [Codex]** Naver/Kakao API integration (Naver Search + Naver/Kakao OAuth + KakaoTalk send-to-me completed on 2026-03-19) | [Codex] | P1 |

### Phase 3: Intelligence (Local AI + Ambient + Polish)

| # | Task | Label | Priority |
|---|------|-------|----------|
| 3.1 | **[x] [Codex]** Local AI (implemented on 2026-03-19; Ollama auto-detect + optional `node-llama-cpp` GGUF fallback + settings model surface update) | [Codex] | P2 |
| 3.2 | **[x] [Codex-L]** MiniLauncher (implemented on 2026-03-18; Ctrl+Space / Alt+U ambient overlay, quick actions, recent tasks, accessibility + tests) | [Codex] | P2 |
| 3.3 | FloatingToolbar (context-aware) | [Codex] | P2 |
| 3.4 | Screen understanding (accessibility tree) | [Codex] | P2 |
| 3.5 | Proactive features (context monitors) | [Codex] | P2 |
| 3.6 | **[x]** Port: thinking tools (first-principles, decision-trees, pre-mortem, BMC) | [Claude] | P2 |
| 3.7 | **[x]** Port: browser/desktop automation skills (agent-browser, stealth, windows-control, ui-automation) | [Claude] | P2 |
| 3.8 | **[x]** Skeleton loading components (Notion shimmer, Timeline/Tasks/Files skeletons) | [Claude] | P2 |
| 3.9 | **[x]** i18n update + Codex a11y fixes (ApprovalCard aria, missing keys) | [Claude] | P2 |

### Phase 4: Superapp Layer

| # | Task | Label | Priority |
|---|------|-------|----------|
| 4.1 | Email integration (IMAP/SMTP) | [Codex] | P2 |
| 4.2 | Calendar integration (Google + CalDAV) | [Codex] | P2 |
| 4.3 | Open Banking / MyData API | [Codex] | P3 |
| 4.4 | Government24 / Hometax API | [Codex] | P3 |
| 4.5 | Plugin/extension marketplace (MCP-based) | [Codex] | P3 |
| 4.6 | Real-time collaboration (Supabase Realtime) | [Codex] | P3 |
| 4.7 | **[Codex-M]** Qt Bridge runtime validation (implemented on 2026-03-18; QWidget + Quick fixture validation passed) | [Codex] | P3 |

### Codex Quick Reference: Label ??Task Map

| Label | Task | Can Start Now? |
|-------|------|---------------|
| **I** | Multi-model routing (OpenRouter-first implementation complete) ??`src/main/ai/` | Implemented on 2026-03-18 |
| **J** | RAG enhancement (SQLite hybrid retrieval implementation complete) ??`src/main/rag/` | Implemented on 2026-03-18 |
| **K** | Security architecture (4-tier rings + sentinel) ??`src/main/security/` | Implemented on 2026-03-18 |
| **M** | Qt Bridge runtime validation ??`native/qt-bridge/` | Implemented on 2026-03-18 |
| **N** | HWPX parser ??`src/main/documents/hwpx-engine.ts` | Implemented on 2026-03-18 |
| **A** | AppShell.tsx ??`src/renderer/src/components/shell/` | [x] Implemented on 2026-03-18 |
| **B** | Sidebar.tsx ??`src/renderer/src/components/shell/` | [x] Implemented on 2026-03-18 |
| **C** | Composer ??`src/renderer/src/components/composer/` | [x] Implemented on 2026-03-18 |
| **D** | Timeline ??`src/renderer/src/components/agent/` | [x] Implemented on 2026-03-18 |
| **E** | HomePage rewrite ??`src/renderer/src/pages/HomePage.tsx` | [x] Implemented on 2026-03-18 |
| **F** | TasksPage ??`src/renderer/src/pages/TasksPage.tsx` | [x] Implemented on 2026-03-18 |
| **G** | ArtifactView ??`src/renderer/src/components/artifact/` | [x] Implemented on 2026-03-18 |
| **H** | SettingsPage restructure ??`src/renderer/src/pages/SettingsPage.tsx` | [x] Implemented on 2026-03-18 |
| **L** | MiniLauncher ??`src/renderer/src/components/ambient/` | [x] Implemented on 2026-03-18 |

---

## 11. ChatChunk ??Agent Timeline Mapping

### 11.1 Type Definitions

```typescript
// @shared/types/ipc.ts
interface ChatChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error'
  content: string
  toolCall?: { id: string; name: string; args: Record<string, unknown> }
  toolResult?: { id: string; name: string; result: unknown; error?: string; duration: number }
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>
  toolResults?: Array<{ id: string; name: string; result: unknown; error?: string; duration: number }>
  modelId?: string
  timestamp: number
  isError?: boolean
}
```

### 11.2 Stream Flow

```
User types in Composer
  ??useChatStore.sendMessage(text)
    ??window.usan.ai.chat({ conversationId, message })
      ??Main process: AgentLoop.chat() (up to 10 tool rounds)
        ??Provider streams chunks via IPC: 'ai:chat-stream'
          ??Renderer: useChatStore.handleChunk(chunk)
```

### 11.3 Chunk ??Timeline Step Mapping

The Timeline component must interpret chunks as execution steps, NOT as chat bubbles:

| ChatChunk.type | Timeline Step | Visual | State |
|---------------|--------------|--------|-------|
| `text` (during tool round) | "Thinking..." | Blue pulse, streaming text preview | `running` |
| `tool_call` | Step: "{toolCall.name}" | Tool icon + name + args summary | `running` |
| `tool_result` (no error) | Update previous step | Green checkmark + duration | `completed` |
| `tool_result` (with error) | Update previous step | Red X + error message | `failed` |
| `text` (after all tools) | "Writing response..." | Streaming text in Artifact area | `running` |
| `done` | Final step | Completion indicator | `completed` |
| `error` | Error step | Red banner + retry button | `failed` |

### 11.4 Store State for Timeline

```typescript
// Existing chat store fields to consume (DO NOT MODIFY)
const {
  isStreaming,              // boolean ??show running indicator
  streamingPhase,           // 'idle' | 'waiting' | 'tool' | 'generating'
  streamingText,            // string ??accumulated text (show in artifact area)
  activeToolName,           // string | null ??currently executing tool
  conversations,            // Conversation[] ??history
  activeConversationId,     // string | null ??current
} = useChatStore()
```

### 11.5 Timeline Step Construction

```typescript
// Derive timeline steps from conversation messages
function messagesToSteps(messages: ChatMessage[]): TimelineStep[] {
  const steps: TimelineStep[] = []
  for (const msg of messages) {
    if (msg.role === 'user') continue // User messages go to Composer history

    if (msg.toolCalls?.length) {
      for (const tc of msg.toolCalls) {
        steps.push({
          id: tc.id,
          type: 'tool',
          name: tc.name,
          args: tc.args,
          status: 'completed', // If in message history, already done
        })
      }
    }
    if (msg.role === 'tool' && msg.toolResults?.length) {
      for (const tr of msg.toolResults) {
        // Update matching step with result
        const step = steps.find(s => s.id === tr.id)
        if (step) {
          step.result = tr.result
          step.error = tr.error
          step.duration = tr.duration
          step.status = tr.error ? 'failed' : 'completed'
        }
      }
    }
    if (msg.role === 'assistant' && msg.content && !msg.toolCalls?.length) {
      steps.push({
        id: msg.id,
        type: 'response',
        content: msg.content,
        status: 'completed',
      })
    }
    if (msg.isError) {
      steps.push({
        id: msg.id,
        type: 'error',
        content: msg.content,
        status: 'failed',
      })
    }
  }
  return steps
}
```

---

## 12. IPC API Quick Reference (window.usan)

Full API: ~150+ methods across 33 namespaces. Key namespaces for UI rebuild:

| Namespace | Key Methods | Used By |
|-----------|------------|---------|
| `ai` | `chat()`, `onChatStream()`, `stop()`, `models()` | Composer, Timeline |
| `settings` | `get()`, `set()` | Settings, Theme, Sidebar |
| `conversations` | `load()`, `save()`, `softDelete()` | TasksPage |
| `fs` | `read()`, `write()`, `list()`, `delete()` | FilesPage |
| `computer` | `screenshot()` | Composer attach |
| `window` | `minimize()`, `maximize()`, `close()` | TitleBar |
| `permissions` | `get()`, `grant()`, `revoke()` | Onboarding, ApprovalCard |
| `system` | `detectLocale()`, `desktopPath()` | App boot |
| `notifications` | `onNotification()` | Toast system |
| `voice` | `listenStart()`, `listenStop()`, `onStatus()` | Composer voice |
| `workflow` | `list()`, `execute()`, `onProgress()` | ToolsPage |
| `mcp` | `listServers()`, `listTools()`, `callTool()` | Settings > Connectors |
| `rag` | `search()`, `indexFile()`, `indexFolder()` | Knowledge features |
| `context` | `getSnapshot()`, `onChanged()` | Proactive, FloatingToolbar |
| `hotkey` | `list()`, `set()`, `onTriggered()` | MiniLauncher, shortcuts |
| `appControl` | `launch()`, `close()`, `sendKeys()` | Agent actions |

**Full API source:** `apps/desktop/src/preload/index.ts`

---

## 13. Build & Dev Commands

```bash
# Development
cd C:\Users\admin\Projects\usan
npm run dev:desktop          # Start desktop app in dev mode
npm run dev:web              # Start web app in dev mode

# Build
npm run build:desktop        # Production build
npm run build:qt-bridge      # Build Qt native bridge
npm run validate:qt-bridge   # Run Qt bridge runtime validation fixtures

# Type checking
npm run typecheck            # Renderer type check
npm run typecheck:node       # Main process type check

# Testing
npx vitest run               # Run all unit tests
npx vitest run tests/unit/app-detector.test.ts  # Single test

# Linting
npx eslint apps/desktop/src/main/mcp/  # Lint specific directory
```

---

## 14. Keyboard Shortcuts (Complete Map)

### Global (AppShell level)
| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `Cmd+K` | Open command palette |
| `Ctrl+Space` / `Alt+U` | Open MiniLauncher (Phase 5) |
| `Ctrl+N` / `Cmd+N` | New conversation |
| `Ctrl+1` through `Ctrl+5` | Navigate to page (Home/Tasks/Files/Tools/Settings) |
| `Escape` | Close overlay / cancel |

### Composer
| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Send message |
| `Ctrl+/` | Toggle recent prompts |
| `Ctrl+Shift+V` | Paste as plain text |

### Timeline
| Shortcut | Action |
|----------|--------|
| `Ctrl+.` | Stop current agent task |

### Files
| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+F` | Focus file search |
| `Delete` | Delete selected (with confirmation) |

---

## 15. StatusBar Content Spec

```
?????????????????????????????????????????????????????????????????????????????????????????????????????????????????[???Agent: running step 3/5]  [Model: claude-sonnet-4]  [???Connected]  [14:32] ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????```

| Slot | Content | When |
|------|---------|------|
| Left | Agent progress: "Step 3/5: Reading files..." | During agent execution |
| Left | "Ready" | Idle |
| Center | Active model name | Always |
| Right | Connection status (???Online / ???Local / ???Offline) | Always |
| Right | Current time | Always |

---

## 16. Source File Locations

| Resource | Path |
|----------|------|
| OpenClaw skills source | `D:\AI-Apps\_extracted\Skills\openclaw\Skill\` |
| Extracted competitor apps | `D:\AI-Apps\_extracted\` (Notion, AutoClaw, ChatGLM, Quark, Qwen, Yuanbao) |
| Linear web extraction | `D:\AI-Apps\linear\` |
| Qt SDK | `C:\Qt\` |
| Qt examples (for bridge testing) | `C:\Qt\Examples\Qt-6.10.2\` |

---

## 17. Reference Documents

| Document | Location | Purpose |
|----------|----------|---------|
| PRD | `usan-superapp-prd-2026-03-18.md` | Product requirements |
| UI Design Plan | `docs/ui-design-plan-2026-03-18.md` | Visual design spec |
| Codex Guide | `docs/codex-development-guide.md` | This file ??technical implementation spec |
| Local AI Status | `docs/local-ai-implementation-status-2026-03-19.md` | OpenRouter-first local fallback, Ollama detection, and GGUF runtime state |
| MCP Routing Status | `docs/mcp-routing-implementation-status-2026-03-19.md` | Implementation & validation state |
| Naver/Kakao Integration Status | `docs/naver-kakao-integration-status-2026-03-19.md` | OAuth, Naver Search, and KakaoTalk integration state |
| Qt Bridge Status | `docs/qt-bridge-implementation-status-2026-03-18.md` | Implementation & validation state |
| HWPX Parser Status | `docs/hwpx-parser-implementation-status-2026-03-18.md` | Implementation & validation state |
| UBridge-Qt Guide | `Desktop/UBridge-Qt-嶺뚯솘??곸굹維곮땻?md` | Qt automation bridge spec |
| Electron Design Rules | `~/Dendron/notes/Electron_React_Design.txt` | Desktop UX guidelines |

---

## 18. Critical Warnings

1. **NEVER modify main process IPC handlers** without explicit approval
2. **NEVER delete Zustand stores** even if they appear unused ??they connect to main process
3. **NEVER hardcode Korean strings** ??always use i18n `t()` function
4. **NEVER skip accessibility** ??all components need ARIA labels and keyboard navigation
5. **NEVER commit API keys** ??use environment variables or `~/.env.litheon`
6. **ALWAYS test with minimum window size** (480x600) after layout changes
7. **ALWAYS maintain bridge aliases** in tokens.css until all old `--color-*` references are removed
8. **Korean honorific default is ??怨몃뭵嶺?(polite)** ??never output ?꾩룇瑗뜹퐲?unless user explicitly configured it
