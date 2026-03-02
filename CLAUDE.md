# 우산 (Usan) Monorepo

## 구조
- `apps/desktop/` — Electron 34 + React 19 + Zustand + Tailwind (데스크톱 AI 비서)
- `apps/web/` — Next.js 16 + Supabase + shadcn/ui (usan.ai 랜딩 페이지)

## 네이밍
- 프로젝트명: 우산 (Usan)
- IPC 브릿지: `window.usan` (UsanAPI)
- appId: `com.usan.app`
- 도메인: usan.ai

## 규칙
- 모든 UI 텍스트는 한국어 (타겟: 어르신/컴맹)
- 접근성 필수: 큰 터치 타겟(44px+), 폰트 스케일링, 고대비 모드
- OpenRouter 전용 AI 프로바이더
- Windows PowerShell 기반 컴퓨터 제어

## 보이스피싱 차단 (Phase 3 계획)
- 안드로이드 앱에서 통화 녹취 → 서버 전송
- 실시간 대화 메모 + 보이스피싱 확률 판정
- 위험 감지 시 즉시 전화 끊기 + 경고
- 데스크톱 앱과 안드로이드 앱 상호작용 필요
