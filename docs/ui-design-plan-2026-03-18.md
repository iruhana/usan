# Usan UI Design Plan

> 2026-03-18 — Based on analysis of 7 Chinese AI super apps
> Reference documents: `usan-superapp-prd-2026-03-18.md`, `Electron_React_Design.txt`

---

## 1. Competitor App Analysis Summary

| App | Framework | Key UI Patterns | Takeaways for Usan |
|---|----------|------------|-----------------|
| **Doubao** | CEF + EdenX + Semi Design + Tailwind v4 | AI-specific gradients, launcher, voice chat, audio translation, 280px sidebar | AI gradient tokens, Launcher pattern, responsive breakpoints |
| **AutoClaw** | Electron + React 19 + antd v5 + Zustand | 3-layer skin system (skin→theme→component), Figma-style session list, xterm terminal, 320px sidebar | Skin system, session avatars, ambient glow dark mode |
| **Yuanbao** | Native + WebView2 + Next.js | 1,283 tokens, LaunchBox quick launcher, Tencent Meeting integration, glassmorphism | LaunchBox → Ambient Entry, systematic token naming |
| **Quark** | Electron + React 17 + Redux + antd | 4 view modes, virtualized lists, skeleton loading, VIP visual differentiation | File view modes, react-window virtualization, skeletons |
| **ChatGLM** | Electron + Vue 3 + Element Plus | Multi-window, floating toolbar, context-aware actions, on-device AI | Floating toolbar → Ambient Entry, context awareness |
| **Qwen** | Electron + React 18 (web wrapper) | MCP proxy, deep links, theme sync | MCP architecture reference (already implemented) |
| **Kimi** | Tauri/Pake (web wrapper) | 10MB ultra-lightweight, keyboard shortcut injection | Lightweight deployment reference (Phase 3 web continuity) |

---

## 2. Usan Tech Stack Confirmation

| Layer | Current | Keep/Change |
|--------|------|----------|
| Runtime | Electron 35 | Keep |
| UI | React 19 + TypeScript | Keep |
| Styling | Tailwind 4 | Keep |
| State | Zustand 5 | Keep |
| Components | lucide-react + cmdk | Extend (see below) |
| Markdown | react-markdown + remark-gfm | Keep |
| Build | electron-vite 5 | Keep |

**Additions under consideration:**
- `allotment` — Resizable split panels (inspired by AutoClaw)
- `xterm.js` — Embedded terminal (for Phase 2 browser operator logs)
- `react-window` — Virtualized lists (inspired by Quark, for file views)
- KaTeX — Math formula rendering (common in Doubao/Yuanbao)

---

## 3. Design Token System

### 3.1 Naming Convention

Referencing Doubao's `--s-color-*` + `--dbx-*` and Yuanbao's `--yb_*` systems, but using Usan's own prefix:

```
--usan-{category}-{role}-{variant}
```

Examples:
```css
--usan-color-brand-primary: #2563eb;
--usan-color-text-primary: #111827;
--usan-color-bg-page: #ffffff;
--usan-color-ai-gradient: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
--usan-radius-sm: 6px;
--usan-shadow-float: 0px 4px 16px rgba(0,0,0,0.08);
```

### 3.2 Color System

| Category | Token | Light | Dark | Notes |
|---------|------|-------|------|------|
| **Brand** | `brand-primary` | `#2563eb` | `#60a5fa` | Tailwind blue-600/400 |
| | `brand-primary-hover` | `#1d4ed8` | `#93bbfd` | |
| | `brand-primary-pressed` | `#1e40af` | `#3b82f6` | |
| **AI** | `ai-gradient` | `linear-gradient(135deg, #2563eb, #7c3aed)` | `linear-gradient(135deg, #60a5fa, #a78bfa)` | Inspired by Doubao |
| | `ai-glow` | `linear-gradient(283deg, #60a5fa, #818cf8)` | Same | AutoClaw ambient glow |
| **Text** | `text-primary` | `#111827` | `#f9fafb` | |
| | `text-secondary` | `#6b7280` | `#d1d5db` | |
| | `text-tertiary` | `#9ca3af` | `#9ca3af` | |
| | `text-disabled` | `#d1d5db` | `#4b5563` | |
| **Background** | `bg-page` | `#f9fafb` | `#0f0f14` | Inspired by Doubao dark |
| | `bg-panel` | `#ffffff` | `#1a1a24` | |
| | `bg-surface` | `#f3f4f6` | `#232330` | |
| | `bg-elevated` | `#ffffff` | `#2a2a3a` | |
| | `bg-float` | `#ffffff` | `#2a2a3a` | |
| **Border** | `border-primary` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.12)` | |
| | `border-secondary` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.06)` | |
| **Status** | `success` | `#22c55e` | `#4ade80` | |
| | `warning` | `#f59e0b` | `#fbbf24` | |
| | `danger` | `#ef4444` | `#f87171` | |
| | `info` | `#2563eb` | `#60a5fa` | = brand |
| **Message** | `msg-user` | `rgba(37,99,235,0.08)` | `rgba(96,165,250,0.12)` | Inspired by AutoClaw |
| | `msg-agent` | `rgba(0,0,0,0.03)` | `rgba(255,255,255,0.04)` | |

### 3.3 Spacing & Radius

```css
/* Spacing (4px base) */
--usan-space-xs: 4px;
--usan-space-sm: 8px;
--usan-space-md: 12px;
--usan-space-lg: 16px;
--usan-space-xl: 24px;
--usan-space-2xl: 32px;

/* Border Radius */
--usan-radius-xs: 4px;
--usan-radius-sm: 6px;
--usan-radius-md: 8px;
--usan-radius-lg: 12px;
--usan-radius-xl: 16px;
--usan-radius-pill: 9999px;

/* Shadows (5 levels, inspired by Doubao) */
--usan-shadow-xs: 0px 1px 2px rgba(0,0,0,0.05);
--usan-shadow-sm: 0px 2px 4px rgba(0,0,0,0.05), 0px 4px 10px rgba(0,0,0,0.03);
--usan-shadow-md: 0px 4px 8px rgba(0,0,0,0.06), 0px 8px 16px rgba(0,0,0,0.04);
--usan-shadow-lg: 0px 8px 16px rgba(0,0,0,0.08), 0px 16px 32px rgba(0,0,0,0.06);
--usan-shadow-float: 0px 12px 24px rgba(0,0,0,0.12);
```

### 3.4 Typography

```css
/* Font Family */
--usan-font-sans: 'Pretendard Variable', -apple-system, BlinkMacSystemFont,
  'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
--usan-font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code',
  ui-monospace, monospace;

/* Font Scale (beginner-friendly — base 16px, scaling supported) */
--usan-text-xs: 0.75rem;    /* 12px — captions, meta */
--usan-text-sm: 0.875rem;   /* 14px — secondary text */
--usan-text-base: 1rem;     /* 16px — body (PRD default) */
--usan-text-lg: 1.125rem;   /* 18px — emphasis */
--usan-text-xl: 1.25rem;    /* 20px — section heading */
--usan-text-2xl: 1.5rem;    /* 24px — page heading */
--usan-text-3xl: 1.75rem;   /* 28px — hero */

/* Line Height */
--usan-leading-tight: 1.35;
--usan-leading-normal: 1.6;
--usan-leading-relaxed: 1.8;  /* beginner mode */
```

**Note**: PRD section 5 designates non-technical users as the primary target. Default font is 16px; beginner mode uses 20px with 1.8 line spacing.

---

## 4. Layout Architecture

### 4.1 Main Shell Structure

```
┌─────────────────────────────────────────────────────┐
│  Title Bar (32px, frameless, -webkit-app-region:drag)│
├──────┬──────────────────────────────────────────────┤
│      │  Agent Timeline / Artifact View               │
│ Side │  ┌──────────────────────────────────────────┐ │
│ bar  │  │                                          │ │
│      │  │  Main Content Area                       │ │
│ 64px │  │  (agent steps, artifacts, results)       │ │
│      │  │                                          │ │
│ icon │  │                                          │ │
│ +    │  ├──────────────────────────────────────────┤ │
│ label│  │  Universal Composer (input area)          │ │
│      │  │  [chips] [attach] [mode] [send]          │ │
├──────┴──┴──────────────────────────────────────────┘ │
│  Status Bar (24px, task progress, connection status)  │
└─────────────────────────────────────────────────────┘
```

### 4.2 Sidebar (PRD §9 Global Navigation)

| Item | Icon | Description |
|------|--------|------|
| **Home** | `Home` | Recent tasks, resume work, quick launch |
| **Tasks** | `ListTodo` | Jobs list (in progress / approval needed / completed / failed) |
| **Files** | `FolderOpen` | File browsing + read/convert/organize |
| **Tools** | `Wrench` | Workflow launcher |
| **Settings** | `Settings` | Policy control surface |

**Width: 64px** (referencing Quark's 60px, icons + labels stacked vertically)
**Responsive**: Below 1080px → 48px icons only
**Style**: Frosted glass (`backdrop-filter: blur(20px)`)

### 4.3 Responsive Breakpoints (inspired by Doubao)

```css
--usan-bp-xs: 480px;   /* mini launcher */
--usan-bp-sm: 680px;   /* sidebar collapsed */
--usan-bp-md: 900px;   /* default */
--usan-bp-lg: 1200px;  /* split view */
--usan-bp-xl: 1440px;  /* full 3-panel */
```

| Width | Layout |
|------|---------|
| < 680px | Sidebar hidden, hamburger menu |
| 680-900px | Sidebar 48px (icons only) |
| 900-1200px | Sidebar 64px + main |
| 1200-1440px | Sidebar 64px + main + side panel |
| > 1440px | Sidebar 64px + main + wide side panel |

### 4.4 Minimum Window Size

- **Minimum**: 480 x 600 (referencing Qwen's 400x600)
- **Default**: 1200 x 800 (same as Doubao/Kimi)
- **Title bar**: 32px, frameless, 20px padding for macOS traffic lights

---

## 5. Key Screen Designs

### 5.1 Universal Composer (PRD §8.A)

**Reference apps**: Doubao launcher, Yuanbao LaunchBox, AutoClaw chat-input-area

```
┌─────────────────────────────────────────────┐
│ [@ context chip] [📎 attach] [🔍 mode chip]  │
│                                             │
│ Type anything here...                       │
│                                             │
│ [Recent prompt 1] [Recent prompt 2] [+]     │
│                                   [Send ▶]  │
└─────────────────────────────────────────────┘
```

| Element | Spec |
|------|------|
| Container | `border-radius: 16px`, `shadow-md`, `bg-panel` |
| Min height | 80px, max 300px (auto-expand) |
| Mode chips | Search, deep research, files, browser, documents — selected state uses `brand-primary` background |
| Attach | File, folder, screenshot, selected text, voice |
| Shortcuts | `Ctrl+Enter` send, `Ctrl+K` mode switch, `Ctrl+/` recent prompts |
| Accessibility | `min-height: 56px` touch area (beginner mode) |

### 5.2 Agent Timeline (PRD §8.B + §15)

**Reference apps**: AutoClaw tool-calls-list, Doubao agent execution view

While a task is running, the **agent timeline becomes the main content** (PRD §15).

```
┌─────────────────────────────────────────────┐
│ 📋 Task: "Write March sales report"    [···] │
├─────────────────────────────────────────────┤
│ ✅ 1. Read 3 files completed            2.1s │
│ ✅ 2. Researched industry trends online 12.4s │
│ 🔄 3. Drafting report...                     │
│ ⏸  4. Send email (awaiting approval)         │
│ ⬚  5. Final review                           │
├─────────────────────────────────────────────┤
│ 📄 Output: March_Sales_Report.md [Open] [Save]│
└─────────────────────────────────────────────┘
```

| Element | Spec |
|------|------|
| Step item | Left status icon + description + right elapsed time |
| Status | ✅ Completed (green), 🔄 In progress (blue, pulse), ⏸ Awaiting approval (amber), ❌ Failed (red), ⬚ Pending (gray) |
| Approval UI | Inline approve/reject buttons, `danger` background highlight (PRD §7 Principle 7) |
| Output | Bottom card, click to switch to Artifact View |
| Animation | Slide-in on new step (AutoClaw `transition-fast: 0.15s ease`) |

### 5.3 Artifact Layer (PRD §8.C)

**Reference apps**: Quark's 4 view modes, Doubao AI side panel

```
┌──────────────────────────────────────────────┐
│ 📄 March_Sales_Report.md        [Edit] [Copy] │
│ ─────────────────────────────────────────── │
│                                              │
│  (Markdown-rendered document content)        │
│  - Tables, charts, checklists, etc.          │
│                                              │
│ ──────────────────────────────────────────── │
│ Version: v2  |  2026-03-18 14:32  |  12.4KB  │
└──────────────────────────────────────────────┘
```

| Type | Rendering | Library |
|------|--------|----------|
| Markdown | react-markdown + remark-gfm | Keep existing |
| Table/CSV | Interactive table | react-window (virtualized) |
| Code | Syntax highlighting + copy | rehype-highlight |
| Math | KaTeX rendering | rehype-katex (new) |
| Checklist | Interactive toggle | GFM task list |

### 5.4 Ambient Entry (PRD §8.F)

**Reference apps**: ChatGLM floating toolbar, Yuanbao LaunchBox, Doubao launcher

#### A. Mini Launcher (`Ctrl+Space` or `Alt+U`)

```
┌───────────────────────────────────┐
│ 🌂 Ask Usan anything...            │
│                                   │
│ [Recent] [Files] [Browser] [Screenshot] │
└───────────────────────────────────┘
```

- Spotlight/Raycast-style popup at top center of screen
- `backdrop-filter: blur(24px)`, `border-radius: 16px`
- Auto-complete on input + recent tasks display
- `Esc` to close

#### B. Floating Toolbar (inspired by ChatGLM)

- **Context-aware** floating menu on text selection
- Different actions depending on active app: browser → translate/summarize, document → organize/compare, messenger → draft reply
- Separate BrowserWindow (transparent, always-on-top)
- `backdrop-filter: blur(30px)`, `border-radius: 8px`
- Maximum 4 icons, overflow goes to "more" menu

#### C. Tray Icon

- Left-click: Toggle mini launcher
- Right-click: Quick menu (new task, recent tasks, settings, quit)

### 5.5 Files Screen (PRD §9 Files)

**Reference apps**: Quark's 4 view modes, virtualized lists

```
┌─────────────────────────────────────────────┐
│ 🔍 Search files... [List│Grid│Column] [Sort]  │
├─────────────────────────────────────────────┤
│                                             │
│ 📄 report.docx              12KB   3m ago    │
│ 📊 sales-data.xlsx          45KB   1h ago    │
│ 📁 projects/                --     yesterday  │
│                                             │
│ ─ Actions for selected file ─               │
│ [Summarize] [Compare] [Convert] [Organize] [Create new doc] │
└─────────────────────────────────────────────┘
```

- 3 view modes: List (default), Grid, Column (referencing Quark's Miller Column)
- `react-window` virtualization (1000+ file performance)
- Drag-and-drop attach → passes to Composer
- On file selection, bottom **action-oriented action bar** appears (PRD §15: action-oriented, not a file explorer clone)

### 5.6 Settings Screen

**Reference apps**: AutoClaw settings-overlay (Grid 320px nav + content)

```
┌───────────┬──────────────────────────────────┐
│           │                                  │
│ General   │  Theme: [Light│Dark│System]       │
│ Account   │  Font size: [Small│Normal│Large│XL]│
│ Connect   │  Language: [Korean│English]       │
│ Security  │  ...                             │
│ About     │                                  │
│           │                                  │
└───────────┴──────────────────────────────────┘
```

- Full-screen overlay (`border-radius: 16px`)
- Left nav 280px + right content
- PRD §14: "Settings is a policy control surface, not a feature warehouse"
- Sections: General, Account, Connectors, Security/Permissions, AI Models, About/Legal

---

## 6. Theme System

### 6.1 Light/Dark + System Sync

- `<html data-theme="light|dark">` (Doubao approach)
- `prefers-color-scheme` media query integration
- IPC for main↔renderer theme sync (referencing Qwen)

### 6.2 Dark Mode Special Handling (inspired by AutoClaw)

- **Ambient Glow**: Subtle radial gradient overlay on background in dark mode
- **Brand Color Shift**: Light `#2563eb` → Dark `#60a5fa` (brighter variant)
- **AI Gradient**: Shifts to softer tones in dark mode

### 6.3 Beginner Mode → Separated into a Standalone Product

> Beginner-friendly UX (20px font, 56px touch targets, 2-level navigation, high contrast) **will not be included in the main Usan app.**
> It will be released later as a separate sub-product such as "Usan Lite."
> The main app is designed for power users and office workers, maintaining only baseline accessibility (WCAG AA).

---

## 7. Animations & Transitions

| Purpose | Value | Reference |
|------|---|------|
| Quick transitions (hover, fade) | `0.15s ease` | AutoClaw |
| Sidebar collapse/expand | `0.25s cubic-bezier(0.25, 0.8, 0.25, 1)` | AutoClaw |
| Modal/overlay entrance | `0.2s ease-out` | |
| Skeleton shimmer | `1.4s ease-out infinite` | Quark |
| Agent step addition | `0.3s ease` slide-in | |
| Launcher entrance | `0.15s ease-out` scale + fade | Doubao |

---

## 8. Accessibility Requirements

| Item | Spec |
|------|------|
| Full keyboard navigation | Tab/Shift+Tab, Arrow keys |
| Focus ring | `2px solid var(--usan-color-brand-primary)`, `offset: 2px` |
| ARIA roles | role/aria-label on all interactive components |
| High contrast mode | `forced-colors: active` support |
| Screen reader | `aria-live` announcements on state changes |
| Minimum touch target | 40px (beginner mode 56px) |
| Color contrast | WCAG AA (4.5:1 text, 3:1 UI) |

---

## 9. Code Syntax Rendering (inspired by Doubao + AutoClaw)

```css
/* Language-specific code block accent colors */
--usan-code-python: #3572a5;
--usan-code-javascript: #f7df1e;
--usan-code-typescript: #3178c6;
--usan-code-rust: #dea584;
--usan-code-go: #00add8;
--usan-code-shell: #89e051;
```

- Code blocks: `border-radius: 12px`, language badge at top
- Copy button: Shown on hover
- Syntax highlighting: rehype-highlight (keep existing)

---

## 10. MCP Routing Architecture (App Automation Layer)

Core execution layer for PRD §8.B Agent Runtime + §8.E Connector Hub.
When a user says "do X in this app," the agent automatically detects the target app's framework and routes to the appropriate MCP.

### 10.1 Routing Flow

```
User Request → Agent Runtime → App Detector → MCP Router
                                                │
                  ┌──────────┬──────────┬────────┼──────────┐
                  ▼          ▼          ▼        ▼          ▼
             playwright  chrome-devtools  windows-mcp   qt-bridge
             (browser)   (CDP)           (Win32/WPF)   (Qt)
                  │          │              │            │
             Web automation  Electron/CEF  Native apps  Qt apps
                         WebView2 apps  UWP apps
```

### 10.2 App Detector Detection Rules

| Detection Condition | Routing Target | Notes |
|----------|-----------|------|
| `electron.exe` / `*.asar` present | chrome-devtools (CDP) | Inject `--remote-debugging-port` |
| `WebView2Loader.dll` / `EBWebView/` | chrome-devtools (CDP) | Edge WebView2 runtime |
| `libcef.dll` | chrome-devtools (CDP) | CEF apps (e.g., Doubao) |
| Chrome / Edge / Firefox process | playwright | Leverages existing browser module |
| `Qt*.dll` / `qml*.exe` | qt-bridge | Native Qt bridge via injector + named pipe |
| Other (Win32/WPF/UWP/MFC) | windows-mcp | UI Automation tree |

### 10.3 Implementation Location

```
apps/desktop/src/main/
├── mcp/                    ← Existing MCP integration module
│   ├── router.ts           ← MCP Router (new)
│   ├── app-detector.ts     ← App Detector (new)
│   ├── providers/
│   │   ├── playwright.ts   ← Existing browser/ integration
│   │   ├── cdp.ts          ← chrome-devtools-mcp integration
│   │   ├── windows.ts      ← windows-mcp integration
│   │   └── qt-bridge.ts    ← native Qt bridge provider
│   └── index.ts
```

### 10.4 Agent Timeline Integration (PRD Principle 6: Trust By Visibility)

Display routing results in the Timeline:

```
🔍 1. Target app detected: "Doubao.exe" → CEF app (libcef.dll)    0.3s
🔌 2. chrome-devtools MCP connected (CDP port 9222)                1.2s
🔄 3. Searching DOM for chat input field...
```

### 10.5 Phase 1 Scope

| MCP | Status | Priority |
|-----|------|---------|
| playwright | Already implemented (`src/main/browser/`) | P0 — integration only |
| chrome-devtools | MCP server installed | P0 — reuse existing CDP code |
| windows-mcp | MCP server installed | P1 — native app automation |
| qt-bridge | Initial implementation completed | P1 — runtime validation on live Qt apps |

---

## 11. Phase 1 UI Implementation Priorities

Mapped to PRD Phase 1:

| Priority | Component | PRD Mapping | Difficulty |
|---------|---------|---------|--------|
| **P0** | Design token CSS variables | Overall foundation | Low |
| **P0** | Main shell layout (sidebar + main) | §8, §9 | Medium |
| **P0** | Universal Composer | §8.A | Medium |
| **P0** | Agent Timeline | §8.B | High |
| **P0** | Artifact Shelf (basic markdown) | §8.C | Medium |
| **P1** | Light/Dark theme | §15 | Medium |
| **P1** | Files screen (list view) | §9 Files | Medium |
| **P1** | Approval UI | §7 Principle 7 | Medium |
| **P1** | Mini Launcher (Ambient Entry) | §8.F | Medium |
| **P2** | Floating toolbar | §8.F | High |
| **P2** | Beginner mode | §5 Primary | Low |
| **P2** | Skeleton loading | UX improvement | Low |
| **P2** | File grid/column view | §9 Files | Medium |

---

## 12. Proposed File Structure

```
apps/desktop/src/renderer/
├── styles/
│   ├── tokens.css           ← Design tokens (§3)
│   ├── theme-light.css      ← Light theme
│   ├── theme-dark.css       ← Dark theme
│   └── animations.css       ← Shared animations
├── components/
│   ├── shell/
│   │   ├── AppShell.tsx     ← Main layout
│   │   ├── Sidebar.tsx      ← 64px sidebar
│   │   ├── TitleBar.tsx     ← Frameless title bar
│   │   └── StatusBar.tsx    ← Bottom status bar
│   ├── composer/
│   │   ├── Composer.tsx     ← Universal Composer
│   │   ├── ModeChips.tsx    ← Task mode chips
│   │   └── AttachMenu.tsx   ← Attachment menu
│   ├── agent/
│   │   ├── Timeline.tsx     ← Agent Timeline
│   │   ├── StepItem.tsx     ← Individual step
│   │   └── ApprovalCard.tsx ← Approval UI
│   ├── artifact/
│   │   ├── ArtifactShelf.tsx ← Output list
│   │   ├── ArtifactView.tsx  ← Output viewer
│   │   └── CodeBlock.tsx     ← Code rendering
│   ├── files/
│   │   ├── FileExplorer.tsx ← File browser
│   │   ├── ListView.tsx     ← List view
│   │   └── ActionBar.tsx    ← Action bar
│   ├── ambient/
│   │   ├── MiniLauncher.tsx ← Mini launcher
│   │   └── FloatingToolbar.tsx ← Floating toolbar
│   └── settings/
│       └── SettingsOverlay.tsx ← Settings overlay
```

---

## 13. Key Design Decisions Summary

| Decision | Rationale |
|------|------|
| **64px icon sidebar** | Balance between Quark's 60px and beginner mode's 56px touch targets |
| **Composer-centric layout** | PRD Principle 1 "Composer First" |
| **Agent Timeline = main content** | PRD §15, execution-state focused rather than a chat panel |
| **Frosted glass sidebar** | ChatGLM/Yuanbao trend, native desktop feel |
| **AI-specific gradient** | Inspired by Doubao, visual differentiation of AI output |
| **Pretendard font** | Optimized for Korean, variable weight, open source |
| **react-window virtualization** | Inspired by Quark, handles 1000+ files |
| **Context-aware floating toolbar** | Inspired by ChatGLM, core to the "all-in-one assistant" concept |
| **LaunchBox-style mini launcher** | Inspired by Yuanbao/Doubao, Ambient Entry implementation |
| **No 3-layer theming (2-layer instead)** | AutoClaw's skin layer is overkill — light/dark + beginner mode is sufficient |
