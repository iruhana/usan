# UI Copy Consistency + Improvement Roadmap (2026-03-05)

## 1) What was implemented now

- Expanded beginner-mode copy branching to:
  - `DashboardPage`
  - `KnowledgePage`
  - `WorkflowsPage`
  - `MarketplacePage`
- Simplified English copy broadly for consistency and beginner readability:
  - Navigation, dashboard, knowledge, workflows, marketplace, clipboard, macro, hotkey, email, calendar.
- Added Korean and Japanese overrides for newly simplified high-traffic keys.
- Fixed locale loading bug in i18n:
  - `ko`/`ja` now load their actual locale maps (not accidental `en` mapping).

## 2) Verification

- Quick quality gate: PASS
  - lint, typecheck, test, build
- Full quality gate: PASS
  - lint, typecheck, test, build, e2e
  - e2e summary: 2 passed, 1 skipped

## 3) Next improvements (priority)

## P0 (Immediate)
1. Plain-language QA pipeline for all UI strings (ko/en/ja)
- Add glossary + anti-jargon rules + short-sentence checks.

2. Accessibility regression tests on key pages
- Add Playwright + axe checks to CI for Home/Settings/Tools/Knowledge/Workflow.

3. Electron security regression guard
- CI assertions for context isolation, sandbox, IPC sender validation, permission policy.

## P1 (Short term)
1. i18n quality upgrade (ICU + plural/select)
- Use FormatJS/i18next patterns for better multilingual sentence quality.

2. Observability unification
- OpenTelemetry spans + Sentry events across main/renderer/preload.

3. Feature flags for risky UX changes
- Roll out beginner-copy experiments and auto-import behavior safely.

## P2 (Mid term)
1. Staged updater rollout policy
- Reduce update risk for first-run and environment-specific failures.

2. Beginner comprehension feedback loop
- In-product lightweight feedback on "easy to understand" copy.

## 4) Research references

- Electron security checklist: https://www.electronjs.org/docs/latest/tutorial/security
- Electron context isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron auto updates: https://www.electronjs.org/docs/latest/tutorial/updates
- Electron accessibility: https://www.electronjs.org/docs/latest/tutorial/accessibility
- Playwright accessibility: https://playwright.dev/docs/next/accessibility-testing
- Playwright locators: https://playwright.dev/docs/locators
- W3C understandable principle: https://www.w3.org/WAI/fundamentals/accessibility-principles/
- WCAG readable: https://www.w3.org/WAI/WCAG21/Understanding/readable
- Plain language (Digital.gov): https://digital.gov/guides/plain-language
- Plain language archive (GSA): https://github.com/GSA/plainlanguage.gov/tree/main/_pages/guidelines
- i18next best practices: https://www.i18next.com/principles/best-practices
- i18next interpolation: https://www.i18next.com/translation-function/interpolation
- i18next plurals: https://www.i18next.com/translation-function/plurals
- FormatJS ICU syntax: https://formatjs.github.io/docs/core-concepts/icu-syntax/
- OpenTelemetry JS getting started: https://opentelemetry.io/docs/languages/js/getting-started/
- OpenTelemetry signals: https://opentelemetry.io/docs/concepts/signals/
- Sentry Electron guide: https://docs.sentry.io/platforms/javascript/guides/electron/
- Sentry Electron tracing: https://docs.sentry.io/platforms/javascript/guides/electron/tracing/
- Unleash feature flag concepts: https://docs.getunleash.io/concepts/feature-flags
- Unleash activation strategies: https://docs.getunleash.io/reference/activation-strategies
- Unleash best practices: https://docs.getunleash.io/guides/best-practices-using-feature-flags-at-scale

## 5) Additional hardening done in follow-up pass (2026-03-05)

- Beginner-mode complexity reduction on Dashboard
  - In beginner mode, advanced panels are hidden:
    - Email, Macro, Hotkey, AppLauncher, File organization, Duplicate finder, Vision, Image editor.
  - Added guidance text explaining how to see all tools.

- Workflow run status consistency
  - Step-level status badges now use localized labels (including `skipped`) instead of raw enum strings.
  - Added `workflow.status.skipped` locale entries in en/ko/ja.

- Regression verification after changes
  - quick gate: PASS (`lint`, `typecheck`, `test`, `build`)
  - full gate: PASS (`lint`, `typecheck`, `test`, `build`, `test:e2e`)
- Dashboard advanced panel lazy-loading added
  - `DashboardPage` now lazy-loads advanced widgets (Email/Macro/Hotkey/AppLauncher/FileOrg/Duplicate/Vision/Image).
  - Build evidence: `DashboardPage` chunk dropped from ~92.6 kB to ~44.8 kB in latest quick build output.

## 6) Additional improvements done (2026-03-06)

- Settings beginner UX cleanup
  - Removed API key input/validation UI from Settings advanced tab so non-technical users do not need to handle API concepts.
  - Backend key-loading capability remains intact for future admin/internal flows.
  - Reorganized Settings so everyday controls stay in `General` and technical controls move into `Developer`.
  - Moved updater controls, permission profile, password-vault tools, and AI model diagnostics out of the beginner-facing area.
  - Added stable `data-settings-*` selectors to make automation resilient across locale changes.
  - Added visible Developer subgroups so advanced controls are no longer mixed into one long panel:
    - `Updates`
    - `Access`
    - `Passwords`
    - `Diagnostics`

- Accessibility hardening in Settings
  - Added missing accessible names (`aria-label`) on all switch-style toggle buttons:
    - High Contrast, Enter-to-Send, Voice Read Aloud, Auto Start, Simple Mode, Auto Update Download, Auto Password Import.
  - Added automated accessibility checks for Settings page:
    - `tests/a11y/settings-page.a11y.test.tsx`
    - Coverage: axe serious/critical scan, keyboard tab navigation, API key field non-exposure verification, developer-only control grouping verification.

- Accessibility coverage expanded (Home/Tools)
  - Added:
    - `tests/a11y/home-page.a11y.test.tsx`
    - `tests/a11y/tools-page.a11y.test.tsx`
  - Coverage:
    - Home empty-state axe scan, Enter-key send behavior check
    - Tools page axe scan, beginner section label rendering check

- Conversation list semantic fix (Home sidebar)
  - Removed nested interactive structure (`button` inside `button`) in conversation rows.
  - Conversation row root changed to non-button option container with explicit option semantics.
  - Empty list state no longer advertises `listbox` role without `option` children.
  - Added missing `aria-label` for trash action icon buttons (restore/permanent delete).

- Test infrastructure extension
  - Added jsdom accessibility test lane in Vitest:
    - `vitest.config.ts` include `*.test.tsx`
    - `environmentMatchGlobs` for `tests/a11y/**`
  - Added dedicated script:
    - `npm run test:a11y`
  - Added dev dependencies:
    - `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `axe-core`

- Regression verification
  - `npm run lint`: PASS
  - `npm run typecheck`: PASS
  - `npm run test:all`: PASS (23 passed, 2 skipped)
  - `npm run test:a11y`: PASS (10 passed)
  - `npm run test:e2e`: PASS (2 passed, 1 skipped)
  - `npm run test:e2e:electron`: PASS
  - `npm run test:e2e:electron:a11y`: PASS
  - `npm run verify:strict`: PASS
  - `npm run build`: PASS
  - `npm audit --json` -> high 1 (`tar`) detected, then `npm audit fix` applied
  - post-fix `npm audit`: 0 vulnerabilities

- Electron real-browser accessibility lane: implemented
  - Added `scripts/run-electron-a11y.mjs`
  - Added `tests/e2e/electron-a11y.e2e.test.ts`
  - Added `npm run test:e2e:electron:a11y`
  - Runner now loads `axe` as a same-origin runtime file from `out/renderer/__a11y__/axe.min.js`
    so CSP stays strict (`script-src 'self'`) without inline-script exceptions.
  - Verified:
    - direct runtime: PASS (`npm run test:e2e:electron:a11y`)
    - Vitest wrapper: PASS (`USAN_E2E_ELECTRON=1 npx vitest run tests/e2e/electron-a11y.e2e.test.ts`)
  - Coverage now includes:
    - `home`
    - `tools`
    - `notes`
    - `account`
    - `settings`
    - `dashboard`
    - `marketplace`
    - `knowledge`
    - `workflows`
    - `workflow-builder-modal`
    - `safety-confirmation-modal`
    - `onboarding`
    - `error-boundary`
  - Runner handles beginner mode automatically by switching to full navigation before scanning hidden advanced pages.
  - Onboarding is scanned in a separate Electron session using an E2E-only forced onboarding flag, so the normal app path stays unchanged.

- Workflow builder modal accessibility hardening
  - Added proper dialog semantics (`role="dialog"`, `aria-modal`, `aria-labelledby`)
  - Added focus handoff to the workflow name field on open
  - Added explicit labels for description textarea, `onError` select, and `toolArgs (JSON)` textarea
  - Added stable automation hooks:
    - `data-action="create-workflow"`
    - `data-dialog-id="workflow-builder"`

- CI visibility improved
  - `.github/workflows/desktop-quality.yml`
    - Ubuntu job now runs `npm run test:a11y`
    - Windows strict gate step explicitly documents Electron smoke + accessibility coverage

- Source-launch bootstrap added
  - Added `bootstrap.cjs`
  - `package.json#main` now points to bootstrap instead of `out/main/index.js`
  - Added `npm run start`
  - Purpose:
    - avoid raw Electron \"Unable to find Electron app\" launch errors from source-folder execution
    - hand off `electron .` launches to the built main entry when available
    - show a controlled guidance dialog when build output is missing
  - Bootstrap guidance dialog is now localized for Korean, English, and Japanese with simpler wording.

- Electron wrapper reliability hardening
  - `tests/e2e/electron-smoke.e2e.test.ts`
  - `tests/e2e/electron-a11y.e2e.test.ts`
  - Both wrappers now shell out through `npm run ...` instead of assuming prebuilt output already exists.
  - This removes false skips when the test script itself is responsible for building first.

- External app launching safety hardening
  - `src/main/orchestration/app-launcher.ts`
  - Replaced loose shell-style launch execution with direct `spawn(...)` process launch.
  - Added validation so risky bare command names such as `assistant` are rejected with a full-path requirement.
  - Safe bare app names are first resolved to absolute application paths before execution.
  - Launch arguments now support both `string` and `string[]`, with quoted-string tokenization and unit coverage.

- Beginner UX cleanup extended to Account and Notes
  - `AccountPage.tsx`
    - Added clearer login/signup guidance, signed-in state hints, explicit form labels, and autocomplete metadata.
  - `NotesPage.tsx`
    - Added beginner subtitle, clearer empty-state guidance, visible editor labels, and removed nested interactive rows.
  - `tests/a11y/notes-page.a11y.test.tsx`
    - Added regression coverage for empty-state accessibility and nested-button prevention.

- Recovery surface hardening
  - `ErrorBoundary.tsx`
  - Error fallback now keeps the title bar visible, uses a clear recovery card, and explains that saved data is still on the PC.
  - Added stable recovery hook:
    - `data-view="error-boundary"`
    - `data-action="error-reload"`
  - Added renderer E2E-only forced error path:
    - `USAN_E2E_FORCE_RENDER_ERROR=1`
    - `usan_e2e_force_error=1`
  - Added automated accessibility regression:
    - `tests/a11y/error-boundary.a11y.test.tsx`

- Locale safety restoration
  - `src/renderer/src/i18n/locales/ko.ts`
  - `src/renderer/src/i18n/locales/ja.ts`
  - Restored both locale files to a safe `...en` fallback shape and re-applied focused plain-language overrides for Settings, Account, Notes, and recovery copy.

- Shared progress UI + simpler status copy
  - Added a shared `ProgressSummary.tsx` component so long-running experiences no longer invent separate status cards.
  - `SkillRunner.tsx` now uses the shared progress surface with:
    - progress metric
    - current step hint
    - pause/resume/cancel/close actions
    - accessible progressbar semantics
  - `WorkflowRunLog.tsx` now uses the same surface with:
    - progress, duration, completed, failed, skipped metrics
    - current running step hint
    - accessible progressbar semantics
  - `chat.store.ts`, `StatusBar.tsx`, `SkeletonLoader.tsx`, and `HomePage.tsx`
    - now surface the active tool name instead of a generic “tool running” state when possible
  - `VoiceOverlay.tsx`
    - simplified visible controls to short beginner-oriented labels (`Speak`, `Stop`, `Hide`)

- Settings failure notices normalized
  - `SettingsPage.tsx`
  - Updater status now shows one summary notice at a time with clearer titles for:
    - checking
    - problem found
    - ready to install
    - update available
    - already current
  - Password import / vault clear actions now use titled success/error notices instead of raw inline text.
  - Technical details remain available only in an explicit disclosure area.

- Runtime markdown loading reduced for plain chat replies
  - Added `components/chat/markdown-heuristics.ts`
  - `MessageBubble.tsx` and `StreamingText.tsx` now load `MarkdownContent` only when the text actually looks like markdown.
  - Result:
    - plain assistant replies keep using simple text rendering
    - the large `markdown-vendor` chunk still exists for rich replies, but it is no longer fetched for ordinary plain-text conversations

- Settings destructive confirmation aligned with app safety UI
  - Replaced the browser-native `window.confirm(...)` flow in `SettingsPage.tsx`
  - Password vault wipe now goes through the existing in-app safety confirmation modal with:
    - clear title
    - what will happen
    - what stays unchanged
    - how to recover later
  - This keeps destructive confirmations visually consistent with the rest of the app.

- Global overlay runtime cost reduced
  - `AppLayout.tsx`
  - `SkillRunner`, `VoiceOverlay`, and `SafetyConfirmationModal` now mount only when related state is active.
  - This keeps idle overlay UI out of the default startup path.

- Email / Calendar / MCP / File-organization notices normalized
  - `EmailInbox.tsx`, `EmailCompose.tsx`, `CalendarView.tsx`, `McpServerList.tsx`, `McpToolPanel.tsx`
  - `DuplicateList.tsx`, `OrganizationPreview.tsx`
  - These surfaces now use titled `InlineNotice` messages for setup guidance, failures, and successful actions.
  - File-organization panels also moved the remaining hardcoded labels into `files.*` locale keys.

- Electron real-browser notice-state accessibility coverage expanded
  - Added E2E-only forced notice states for:
    - `EmailInbox`
    - `CalendarView`
    - `DuplicateList`
    - `OrganizationPreview`
    - `McpServerList`
  - Added stable `data-view` hooks so Playwright can wait for these panels directly.
  - `scripts/run-electron-a11y.mjs` now scans:
    - `dashboard-advanced-notices`
    - `marketplace-mcp-notice`
  - Result:
    - important success and failure notice surfaces are now covered in real Electron, not only jsdom/unit lanes.

- Performance finding from this pass
  - The remaining biggest renderer chunk is still `react-core` (~556 kB).
  - This chunk is mostly framework runtime and is not a safe next split target by itself.
  - The safer next performance target remains startup-path app code and message payload size rather than forcing React internals into smaller chunks.

- Runtime locale fallback centralized
  - `src/renderer/src/i18n/index.ts`
  - English now acts as the shared base message map at runtime.
  - `ko.ts` and `ja.ts` were reduced to locale override maps instead of copying `...en` into each file.
  - Result:
    - fallback behavior stays correct
    - locale files are structurally simpler
    - duplicated message payload in locale source files is removed

- Forced-notice jsdom accessibility lane added
  - Added `tests/a11y/forced-notices.a11y.test.tsx`
  - Coverage:
    - dashboard forced notice surfaces for Email / Calendar / File organization
    - marketplace forced MCP notice surface
  - These tests complement the real Electron a11y lane so notice regressions are caught in both fast jsdom and full-browser runs.

- Toast UI moved further off the startup path
  - Added `src/renderer/src/stores/notification.store.ts`
  - `NotificationToast.tsx` now renders from a zustand-backed queue instead of owning the preload subscription directly.
  - `AppLayout.tsx` now lazy-loads:
    - `NotificationToast`
    - `UndoToast`
  - Result:
    - notification events are still captured immediately
    - toast UI code loads only when a toast is actually visible
  - Latest build evidence:
    - `NotificationToast` split into its own chunk (~2.33 kB)
    - `UndoToast` split into its own chunk (~1.84 kB)
    - `AppLayout` dropped to ~58.14 kB from the previous ~59.57 kB

## 7) Research-based next improvements (new plan)

### P0
1. Expand real-browser accessibility CI lane
- Base Playwright + axe Electron lane is now implemented for:
  - `home`, `tools`, `notes`, `account`, `settings`, `dashboard`, `marketplace`, `knowledge`, `workflows`
  - `workflow-builder-modal`, `safety-confirmation-modal`, `onboarding`, `error-boundary`
- Next step is coverage expansion to remaining recovery and interruption flows such as updater failures, import failures, and destructive-action confirmations beyond the current safety modal.

2. Clear visible labels/instructions audit (not only aria)
- Ensure instructions are visible to all users, not just AT users.
- Audit all form controls to satisfy both Name/Role/Value and user-visible instruction quality.

3. Password-vault security review pass
- Re-validate encryption-at-rest strategy and key material lifecycle for imported browser credentials.
- Add explicit threat-model checklist and retention policy in docs/UI.

### P1
1. Power-aware profile expansion
- Extend battery/AC tuning to include suspend/resume and thermal-state events for safer background behavior on laptops.

2. Plain-language QA gate
- Add automated copy linting rules:
  - sentence length cap
  - jargon blacklist
  - consistency glossary checks per locale

3. MessageFormat migration pilot
- Pilot ICU MessageFormat on high-traffic keys with count/selection logic to reduce localization awkwardness.

## 8) Additional research references used in this pass

- Electron `powerMonitor` API: https://www.electronjs.org/docs/latest/api/power-monitor/
- Electron `safeStorage` API: https://www.electronjs.org/docs/latest/api/safe-storage/
- Electron security tutorial: https://www.electronjs.org/docs/tutorial/security/
- Playwright accessibility testing: https://playwright.dev/docs/next/accessibility-testing
- Playwright accessibility class note (axe recommended): https://playwright.dev/docs/api/class-accessibility
- WCAG 2.2 understanding index: https://www.w3.org/WAI/WCAG22/understanding/
- WCAG labels/instructions (SC 3.3.2): https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html
- Microsoft plain-language UX guidance: https://learn.microsoft.com/en-us/power-platform/well-architected/experience-optimization/user-interface-content
- Microsoft writing for all abilities: https://learn.microsoft.com/en-us/style-guide/accessibility/writing-all-abilities
- Unicode MessageFormat 2: https://messageformat.unicode.org/
- NIST SP 800-63B-4 publication: https://www.nist.gov/publications/nist-sp-800-63b-4digital-identity-guidelines-authentication-and-authenticator

## 진행 업데이트 (2026-03-06, voice overlay 토글)

- [x] 설정 > 소리에서 `voiceOverlayEnabled` 토글 추가
  - 음성 입력 박스를 설정에서 켜고 끌 수 있게 분리.
  - `voiceEnabled`는 읽어주기(TTS) 전용으로 유지.

- [x] voice status 구독 중앙화
  - 새 `voice.store`를 추가해서 preload `voice.onStatus` 구독을 1곳으로 통합.
  - `HomePage`, `VoiceIndicator`, `VoiceOverlay`가 같은 상태를 재사용.

- [x] VoiceOverlay lazy mount 조건 축소
  - 설정이 켜져 있고 실제로 음성 이벤트가 있을 때만 overlay를 마운트.
  - E2E 강제 플래그는 기존대로 유지.

- [x] 검증
  - `lint`, `typecheck`, `test:all`, `verify:strict` 통과.

## 진행 업데이트 (2026-03-06, 음성 표시/고급 메뉴 정리)

- [x] 음성 도움창 토글이 상태바 음성 표시도 함께 제어하도록 통일
  - `VoiceIndicator`가 `voiceOverlayEnabled`를 함께 확인하도록 변경.
  - 음성 도움창을 끄면 하단 음성 상태도 같이 숨김.

- [x] `쉬운 모드` 노출 방식을 사용자 문구 기준으로 재정리
  - 설정 카드 라벨을 `고급 메뉴 보기` 개념으로 변경.
  - 내부 상태명 `beginnerMode`는 유지하고, UI 토글만 `고급 메뉴 표시 여부`로 반전 표현.
  - 도움 문구에 `자동 작업/지식/대시보드/추가 기능` 예시를 직접 표시.

- [x] `워크플로우` 용어를 `자동 작업` 계열 문구로 단순화
  - 사이드바 메뉴와 페이지 제목을 더 쉬운 표현으로 조정.
  - 영어/일본어도 `Automations` / `自動作業` 기준으로 정리.

- [x] 회귀 테스트 추가
  - `settings-page.a11y.test.tsx`에 `고급 메뉴 보기` 토글 테스트 추가.
  - `voice-indicator.test.tsx` 추가: 음성 도움 UI 설정이 꺼지면 상태바 표시도 숨겨지는지 검증.

## 진행 업데이트 (2026-03-06, 고급 메뉴 용어 단순화)

- [x] 고급 메뉴 이름 단순화
  - `지식` -> `저장한 자료`
  - `대시보드` -> `컴퓨터 상태`
  - `워크플로우`는 앞선 배치처럼 `자동 작업` 유지

- [x] 홈 화면 쉬운 모드 안내 추가
  - 쉬운 모드에서 `고급 메뉴가 숨겨져 있다`는 안내 카드 추가.
  - 설정에서 `고급 메뉴 보기`를 켜면 어떤 메뉴가 보이는지 직접 설명.

- [x] 다국어 반영
  - `en`: `Saved info`, `Computer status`, `Automations`
  - `ko`: `저장한 자료`, `컴퓨터 상태`, `자동 작업`
  - `ja`: `保存した資料`, `パソコン状態`, `自動作業`

- [x] 검증
  - `lint`, `typecheck`, `test:all`, `verify:strict`, quick web-quality PASS

## 진행 업데이트 (2026-03-06, 초보자 모드 고급 페이지 단순화)

- [x] 컴퓨터 상태 화면 단순화
  - 초보자 모드에서는 CPU/메모리/저장 공간/배터리 또는 인터넷만 요약 카드로 표시.
  - 프로세스 표, 제안 트레이, 보조 패널은 숨김.
  - 초보자 모드에서는 불필요한 프로세스 폴링도 중단.

- [x] 저장한 자료 화면 단순화
  - 초보자 모드에서는 상단 통계 카드와 우측 상태 카드 숨김.
  - 문서 목록의 chunks 수치와 검색 결과 점수/벡터/키워드/신뢰도 같은 내부 지표 숨김.
  - 검색 결과 섹션 제목을 찾기 대신 결과 의미로 정리.

- [x] 추가 기능 화면 단순화
  - 초보자 모드에서는 플러그인 상세 패널과 MCP Servers 패널 숨김.
  - 카드에서 버전/저자/별점/다운로드/태그 같은 개발자용 메타데이터를 숨김.
  - 설치된 항목도 내부 ID 대신 설명문 위주로 표시.

- [x] Home -> Settings 바로가기 실브라우저 검증 추가
  - Electron a11y runner에 home-settings-shortcut 시나리오 추가.
  - 로컬 사용자 상태에 따라 기존 대화가 열려 있어도 새 대화 상태를 만든 뒤 설정 열기 -> 일반 탭 진입까지 검증.

- [x] 검증
  - lint, 	ypecheck, 	est:all, 	est:e2e:electron:a11y, erify:strict, quick web-quality PASS

## 진행 업데이트 (2026-03-06, 한국어 UI 혼합 언어 정리)

- [x] 한국어 locale 보강
  - 메인 가시 UI 경로에서 실제로 사용하는 번역 키 기준으로 `ko.ts` 누락분 178개를 추가.
  - Account, Home, Notes, Files, Settings, StatusBar, Sidebar, TitleBar, ErrorBoundary, Voice, Dashboard, Knowledge, Marketplace, Workflow 계열 화면의 영어 fallback 제거.

- [x] 회귀 테스트 추가
  - `tests/unit/i18n-visible-ko.test.ts` 추가.
  - 메인 가시 UI 파일에서 `t('...')`로 사용하는 키를 수집해 `ko.ts`에 모두 존재하는지 검증.
  - 이후 동일한 혼합 언어 회귀가 생기면 unit test 단계에서 즉시 실패.

- [x] 검증
  - `lint`, `typecheck`, `test:all`, `verify:strict`, quick web-quality PASS

## 진행 업데이트 (2026-03-06, 일본어 UI 혼합 언어 정리)

- [x] 일본어 locale 보강
  - 메인 가시 UI 경로에서 실제로 사용하는 번역 키 기준으로 `ja.ts` 누락분 214개를 추가.
  - 일본어 locale에서도 메인 화면 기준 영어 fallback이 섞여 보이던 문제를 제거.

- [x] 자동 작업 화면 하드코딩 영어 제거
  - `WorkflowBuilder.tsx`의 `onError`, `stop`, `skip`, `retry`, `toolArgs (JSON)`를 모두 i18n 키로 전환.
  - `en`, `ko`, `ja`에 대응 키 추가.

- [x] locale regression test 구조 정리
  - `tests/unit/i18n-visible-helpers.ts`로 visible UI key 수집 로직 공통화.
  - `tests/unit/i18n-visible-ko.test.ts`
  - `tests/unit/i18n-visible-ja.test.ts`

- [x] 검증
  - `verify:strict`, quick web-quality PASS

## 진행 업데이트 (2026-03-06, 지원 패널 일본어 정리)

- [x] 일본어 support-panel locale 보강
  - `Email`, `Calendar`, `Clipboard`, `CommandPalette`, `Files`, `Hotkey`, `Image`, `Macro`, `MCP`, `Monitor`, `Onboarding`, `Safety`, `Vision`, `AppLauncher` 계열에서 사용하는 번역 키 누락분 185개를 `ja.ts`에 추가.
  - 이제 support-panel 기준으로도 `ja` locale 누락 0 상태.

- [x] 일본어 regression test 추가
  - `tests/unit/i18n-support-panels-ja.test.ts`
  - support-panel 파일에서 사용하는 `t('...')` 키가 모두 `ja` locale에 존재하는지 검사.

- [x] 초보자용 용어 보강
  - `AppLauncherHelper`에서 내부 app id 대신 locale label(`orchestration.app.*`)을 사용.
  - `McpServerList`의 transport/placeholder 문구를 초보자용 표현으로 정리한 상태를 `ja`까지 일관되게 반영.

- [x] 검증
  - `npm run typecheck`
  - `npm run test:all -- --run tests/unit/i18n-support-panels-ja.test.ts tests/unit/app-registry-i18n.test.ts tests/unit/i18n-visible-ja.test.ts`
  - `npm run verify:strict`
  - quick web-quality PASS

## 진행 업데이트 (2026-03-06, 기술 용어 단순화 3차)

- [x] `ja.ts` 상태 재확인
  - locale 파일 자체는 중복 키 0개 상태.
  - 이번 배치는 dedupe보다 실제 화면에 보이는 기술 용어 단순화에 집중.

- [x] `MCP` UI 문구 단순화
  - `MCP Servers` 계열 문구를 `도구 연결` 계열 쉬운 표현으로 정리.
  - `Server ID`, `Server Name`, `Transport`, `Command`, `Args`, `URL`을 `짧은 이름`, `보여줄 이름`, `연결 방식`, `프로그램 경로`, `추가 옵션`, `웹 주소` 식으로 재정리.
  - 연결 카드에서 내부 server id를 그대로 노출하지 않고 `사용 가능한 도구 {count}개` 식 요약으로 대체.
  - `McpToolPanel`도 선택된 연결 이름을 우선 표시하도록 변경.

- [x] `Hotkey` UI 문구 단순화
  - `Accelerator` -> `키 조합`
  - `ID` -> `짧은 이름`
  - `Action` -> `할 일`
  - 하드코딩 placeholder `open-dashboard`, `navigate:dashboard` 제거 후 locale 기반 예시로 치환.
  - `HotkeyRecorder` 버튼의 `Press keys...`, `Record hotkey` 하드코딩 제거.

- [x] 진단/모델 문구 단순화
  - `OpenRouter` 노출 라벨을 `온라인 AI` 계열 표현으로 정리.
  - `Technical details`는 `자세히 보기` 계열로 정리.
  - `workflow.toolArgsLabel`, `workflow.invalidJson`, `mcp.argsJson`도 초보자 기준 표현으로 완화.

- [x] 회귀 범위 확장
  - `tests/unit/i18n-visible-helpers.ts`에 `HotkeyRecorder.tsx` 추가.
  - 새 hotkey 키가 support-panel locale coverage에 포함되도록 보강.

- [x] 검증
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:all -- --run tests/unit/i18n-support-panels-ko.test.ts tests/unit/i18n-support-panels-ja.test.ts tests/unit/i18n-visible-ko.test.ts tests/unit/i18n-visible-ja.test.ts`

## 진행 업데이트 (2026-03-06, 초보자 안내 문구 보강 4차)

- [x] `저장한 자료` beginner 도움말 추가
  - `KnowledgePage`에 초보자용 안내 notice 추가.
  - `파일 추가/폴더 추가/찾기`가 각각 언제 필요한지 한 줄로 설명.

- [x] `컴퓨터 상태` beginner 도움말 추가
  - `DashboardPage`에 quick summary 읽는 법 notice 추가.
  - `곧 확인 필요`가 보일 때 새로고침 후 다시 보면 된다는 식으로 행동 지침을 직접 제공.

- [x] `개발자 설정` 섹션별 한 줄 설명 추가
  - `업데이트`, `접근/권한`, `저장된 비밀번호`, `진단` 섹션마다
    `언제 만지면 되는지`를 한 문장으로 표시.
  - 설정 페이지를 아는 사람 전용 화면처럼 보이지 않게 압축 설명 추가.

- [x] 문구 단순화
  - beginner dashboard 요약 카드 라벨을 더 직관적인 표현으로 조정
    - CPU -> `컴퓨터 속도`
    - Memory -> `메모리 사용량`
    - Storage -> `저장 공간`
  - knowledge index summary의 `skipped/failed` 의미도 `이미 들어있음/확인 필요` 계열로 정리.

- [x] 회귀 테스트 추가
  - `tests/unit/beginner-guidance.test.tsx`
  - beginner dashboard 가이드 노출
  - beginner knowledge 가이드 노출
  - developer settings 섹션별 plain-language 도움말 노출

- [x] 검증
  - `npm run test:all -- --run tests/unit/beginner-guidance.test.tsx tests/unit/i18n-support-panels-ko.test.ts tests/unit/i18n-support-panels-ja.test.ts tests/unit/i18n-visible-ko.test.ts tests/unit/i18n-visible-ja.test.ts`
  - `npm run verify:strict`
  - quick web-quality PASS

## 진행 업데이트 (2026-03-06, locale 재구성 + 인코딩 손상 fallback 정리)

- [x] locale 런타임 손상 감지 유지
  - `src/renderer/src/i18n/index.ts`
  - 번역 값이 `??` 또는 손상 패턴으로 보이면 그대로 출력하지 않고 영어 원문으로 안전 fallback.
  - `isLikelyCorruptedTranslation(...)`를 export해서 테스트에서도 같은 기준을 사용.

- [x] `ko.ts`, `ja.ts`를 깨끗한 단일 locale 파일로 재생성
  - `src/renderer/src/i18n/locales/ko.ts`
  - `src/renderer/src/i18n/locales/ja.ts`
  - 구조를 `...en` 기반 clean dictionary 형태로 재작성.
  - 값은 `\\uXXXX` escape 형태로 저장해서 파일 인코딩에 덜 민감하게 유지.

- [x] user-facing key 기준 locale 재구성
  - `tests/unit/i18n-visible-helpers.ts`에서 수집한 visible/support-panel key 총 494개 기준으로 ko/ja locale을 재생성.
  - 장문 문장은 기계 번역 기반으로 채우되, 핵심 버튼/내비게이션/상태 라벨은 수동 override로 교정.
  - 예:
    - `Home` / `Run` / `Close` / `Send` / `Connect`
    - `자동 작업`, `저장한 자료`, `도구 연결`
    - `実行`, `閉じる`, `ツール接続`

- [x] 영어 원문 손상 값 정리
  - `src/renderer/src/i18n/locales/en.ts`
  - 복구한 대표 키:
    - `titlebar.title`
    - `settings.permissionProfileHintSimple`
    - `notes.emptyHint`

- [x] locale 품질 회귀 테스트 보강
  - `tests/unit/i18n-quality.test.ts`
    - visible/support key 전체에서 손상 문자열이 resolve되지 않는지 검사
    - ko/ja 핵심 액션 라벨이 영어 fallback이 아니라 locale override를 실제로 쓰는지 검사
  - `tests/unit/i18n.test.ts`
    - locale 값이 손상됐을 때 영어 fallback으로 내려가는 runtime 경로를 직접 검증

- [x] 검증
  - `npm run verify:strict`
  - `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick`
  - 결과:
    - `37 passed`, `2 skipped` test files
    - `217 passed`, `2 skipped` tests
    - Electron smoke PASS
    - Electron a11y PASS

## 진행 업데이트 (2026-03-06, ko/ja copy polish 1차)

- [x] 한국어 핵심 라벨 교정
  - `닫다` -> `닫기`
  - `말하다` -> `말하기`
  - `멈추다` -> `중지`
  - `빛 / 어두운 / 체계` 같은 기계 번역형 테마 라벨을
    `밝게 / 어둡게 / 시스템 설정`으로 교정

- [x] 한국어 help/guide 문구 정리
  - `settings.developerGroupDiagnosticsHint`에 남아 있던 영어 문장을 제거
  - `system/developer/password import/permission profile/dashboard/help` 계열 설명 문구를 더 짧고 직접적인 한국어로 재작성

- [x] 일본어 핵심 라벨 교정
  - `titlebar.close`를 잘못된 `近い`에서 `閉じる`로 교정
  - `notes.title`을 `注意事項`에서 `メモ`로 교정
  - `settings.themeDark`, `settings.themeSystem`도 UI 라벨 기준 표현으로 정리

- [x] 일본어 help/guide 문구 정리
  - `settings.passwordImportHint`에 남아 있던 영어 문장을 제거
  - `system/developer/password import/permission profile/dashboard/help` 계열 문장을 더 자연스러운 UI 문구로 정리

- [x] 회귀 테스트 보강
  - `tests/unit/i18n-quality.test.ts`
  - 핵심 라벨 exact assertion 추가:
    - ko: `titlebar.close`, `home.voiceStart`, `home.voiceStop`, `settings.theme*`
    - ja: `titlebar.close`, `notes.title`, `settings.theme*`
  - ko/ja helper 문구에 영어가 다시 섞이지 않는지 확인하는 assertion 추가

- [x] 검증
  - `npm run verify:strict`
  - `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick`
  - 결과:
    - `37 passed`, `2 skipped` test files
    - `219 passed`, `2 skipped` tests
    - Electron smoke PASS
    - Electron a11y PASS

## 진행 업데이트 (2026-03-06, 기술 용어 완화 4차)

- [x] 지식/비전 지표 문구를 의미 중심 표현으로 완화
  - `knowledge.chunks` -> `Parts` / `나눈 수` / `分けた数`
  - `knowledge.result.score` -> `Match` / `맞는 정도` / `一致度`
  - `knowledge.result.vectorScore` -> `Meaning match` / `의미가 비슷한 정도` / `意味の近さ`
  - `knowledge.result.confidence`, `vision.confidence` -> `Likely match` / `믿을 만한 정도` / `確からしさ`

- [x] 고급 입력 용어에서 `JSON` 직접 노출 축소
  - `workflow.toolArgsLabel` -> `Extra options` / `추가 옵션` / `追加オプション`
  - `mcp.argsJson`도 같은 라벨로 통일
  - `mcp.invalidJson` -> `The input format is not valid.` / `입력 형식이 올바르지 않습니다.` / `入力形式が正しくありません。`

- [x] 회귀 테스트 정리
  - `tests/unit/user-facing-errors.test.ts`에서 MCP 입력 경고 기대값을 현재 plain-language 문구에 맞게 갱신

- [x] 최종 검증
  - `npm run test:all -- --run tests/unit/user-facing-errors.test.ts tests/unit/i18n-quality.test.ts` PASS
  - `npm run verify:strict` PASS
  - `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick` PASS

## 진행 업데이트 (2026-03-06, Developer/Marketplace/Knowledge 용어 단순화 5차)

- [x] Developer 설정 문구 완화
  - `Diagnostics` -> `App check` / `앱 확인` / `アプリ確認`
  - `Available AI models` -> `Connected online AI` 계열 표현으로 정리
  - `Update speed / Beta` -> `When to get updates / Early access` 계열 표현으로 정리
  - `App access level` -> `How much control to allow` 계열 표현으로 정리

- [x] Marketplace 용어 완화
  - `Add-ons` -> `Extra tools` / `추가 도구` / `追加ツール`
  - `Author / Version / Rating / Downloads` -> 더 쉬운 표현으로 교체
  - 설치 목록에서 내부 plugin id 노출 제거
  - 상세 보기 버튼 aria-label도 locale 기반으로 교체

- [x] Knowledge 용어 완화
  - `Matches / Parts / Keyword / Confidence` 계열을 의미 중심 문구로 조정
  - `Folder scan complete`, `File not changed, skipped` 같은 개발자형 상태 문구를 쉬운 문장으로 교체

- [x] 회귀 테스트 보강
  - `tests/unit/i18n-quality.test.ts`에 Developer/Marketplace/Knowledge 단순화 라벨 exact assertion 추가
  - `tests/unit/user-facing-errors.test.ts`, `tests/unit/beginner-guidance.test.tsx` 기대값을 최신 plain-language 문구에 맞게 갱신

- [x] 검증
  - `npm run test:all -- --run tests/unit/user-facing-errors.test.ts tests/unit/beginner-guidance.test.tsx tests/unit/i18n-quality.test.ts` PASS
  - `npm run verify:strict` PASS
  - `python C:\Users\admin\.codex\skills\web-quality-optimizer\scripts\run_web_quality_checks.py --project C:\Users\admin\Projects\usan\apps\desktop --mode quick` PASS
## 진행 업데이트 (2026-03-07, Electron locale screenshot audit)

- [x] 실제 화면 기준 locale 감사 스크립트 추가
  - `scripts/capture-electron-locales.mjs`
  - 대상 locale: `ko`, `ja`
  - 대상 화면:
    - `home`
    - `tools`
    - `notes`
    - `account`
    - `dashboard`
    - `marketplace`
    - `knowledge`
    - `workflows`
    - `settings-display`
    - `settings-advanced`
  - 산출물 경로:
    - `C:\Users\admin\Projects\usan\apps\desktop\output\playwright\locale-audit`

- [x] 재실행용 npm 스크립트 추가
  - `npm run test:e2e:locale-audit`

- [x] 혼합 언어 노이즈 추가 정리
  - `StatusBar`에서 locale 코드(`KO / EN / JA`)와 `ContextIndicator`를 제거.
  - 검색 힌트는 locale 문자열(`status.searchHint`)로 대체.
  - `SettingsPage` 언어 선택기에서 visible `KO / EN / JA` 코드를 제거하고 각 언어 이름만 표시.
  - `package.json` description의 손상 문자열도 정리.

- [x] ko/ja copy polish 추가
  - `status.*` 상태 문구를 더 자연스럽게 수정.
  - `settings.enterToSendOnHint`
  - `settings.passwordImportHowTo`
  - `knowledge.shortcutsHint`
  - `knowledge.shortcutsHintSimple`
  - `tools.browserAutomationDesc*`(ja)
  - 위 high-traffic 안내 문구를 실제 UI 기준으로 더 짧고 직접적인 표현으로 조정.

- [x] 실제 감사 결과
  - `ko`/`ja` 모두 `home`, `tools`, `notes`, `account`, `marketplace`, `knowledge`, `workflows`, `settings-display`, `settings-advanced`에서:
    - `documentLang` 정상
    - suspicious English 0
    - overflow 0
    - screenshot 기준 혼합 언어 문제 없음
  - `dashboard`만 예외로 남음:
    - process name, monitor name, file extension, unit(`KB/s`, `PID`, `png`, `jpeg`, `webp`) 같은 시스템 데이터가 영어로 잡힘
    - 이는 앱 copy가 아니라 런타임 시스템 데이터라서 locale regression으로 분류하지 않음

- [x] 주의사항
  - `report.json`의 `textPreview`는 PowerShell/terminal 인코딩 영향으로 mojibake처럼 보일 수 있음.
  - 실제 판정은 screenshot과 `suspiciousEnglish`/`overflow` 수치 기준으로 수행.

- [x] 검증
  - `npm run build` PASS
  - `node scripts/capture-electron-locales.mjs` PASS
  - `npm run verify:strict` PASS
## 진행 업데이트 (2026-03-07, dashboard simplification + locale audit CI)

- [x] `컴퓨터 상태` 화면 복잡도 추가 축소
  - `DashboardPage.tsx`
  - 고급 메뉴를 켠 상태에서도 원시 시스템 정보와 부가 도구를 기본 접힘으로 변경.
  - 기본 표시:
    - CPU / 메모리 / 디스크 / 네트워크 요약
    - 제안 카드
  - 기본 숨김:
    - 프로세스/모니터 상세 정보
    - 캘린더/클립보드/이메일/매크로/핫키/앱 실행/파일 정리/비전/이미지 도구
  - 접힘 토글 추가:
    - `dashboard-toggle-system-details`
    - `dashboard-toggle-tools`

- [x] 회귀 테스트 추가
  - `tests/unit/beginner-guidance.test.tsx`
  - 고급 모드 대시보드에서도 상세 시스템 정보와 추가 도구가 기본 접힘인지 검증.

- [x] locale audit false-positive 제거
  - `scripts/capture-electron-locales.mjs`
  - 시스템 전송 단위 `B/s`, `KB/s`를 allowlist에 추가.
  - 결과: `ko`, `ja` 전체 감사 대상 화면에서 suspicious English 0.

- [x] locale 실감사 CI 연결
  - `.github/workflows/desktop-quality.yml`
  - Windows strict job에서 추가 실행:
    - `npm run test:e2e:locale-audit`
  - 결과 아티팩트 업로드:
    - `desktop-locale-audit`
    - path: `apps/desktop/output/playwright/locale-audit`

- [x] 검증
  - `npm run test:all -- --run tests/unit/beginner-guidance.test.tsx` PASS
  - `npm run test:e2e:locale-audit` PASS
  - `node scripts/capture-electron-locales.mjs` PASS
  - `npm run test:e2e:electron:a11y` PASS
  - `npm run verify:strict` PASS
