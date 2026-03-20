/**
 * Mock data fixtures for renderer UI development.
 * These are renderer-only — no backend contracts are assumed.
 */

// ─── Session Fixtures ────────────────────────────────────────────────────────

export type MockSessionStatus = 'active' | 'idle' | 'running' | 'failed' | 'approval_pending'

export interface MockSession {
  id: string
  title: string
  status: MockSessionStatus
  model: string
  updatedAt: string
  pinned: boolean
  messageCount: number
  artifactCount: number
  preview?: string
}

export const MOCK_SESSIONS: MockSession[] = [
  {
    id: 'sess-001',
    title: '카페 랜딩 페이지 빌드',
    status: 'active',
    model: 'claude-sonnet-4-6',
    updatedAt: '2분 전',
    pinned: true,
    messageCount: 24,
    artifactCount: 3,
    preview: '히어로 섹션 + 메뉴 리스트 + 연락처 폼',
  },
  {
    id: 'sess-002',
    title: '고객 문의 대시보드 — 필터, 상태 관리, CSV 내보내기 포함하여 관리자용 내부 도구',
    status: 'running',
    model: 'gpt-5.4-pro',
    updatedAt: '방금',
    pinned: true,
    messageCount: 47,
    artifactCount: 5,
  },
  {
    id: 'sess-003',
    title: '주간 매출 리포트 자동화 워크플로우',
    status: 'approval_pending',
    model: 'claude-sonnet-4-6',
    updatedAt: '12분 전',
    pinned: false,
    messageCount: 15,
    artifactCount: 2,
    preview: '트리거: 매주 월요일 09:00 → Google Sheets → Slack 알림',
  },
  {
    id: 'sess-004',
    title: 'React 컴포넌트 리팩토링',
    status: 'idle',
    model: 'gemini-2.5-pro',
    updatedAt: '1시간 전',
    pinned: false,
    messageCount: 8,
    artifactCount: 1,
  },
  {
    id: 'sess-005',
    title: 'REST API 설계 — /api/v2/users, /api/v2/orders, /api/v2/products 엔드포인트 스펙',
    status: 'idle',
    model: 'claude-opus-4-6',
    updatedAt: '3시간 전',
    pinned: false,
    messageCount: 32,
    artifactCount: 4,
  },
  {
    id: 'sess-006',
    title: '이미지 리사이즈 스크립트',
    status: 'failed',
    model: 'gpt-5.4',
    updatedAt: '어제',
    pinned: false,
    messageCount: 6,
    artifactCount: 0,
    preview: 'sharp 모듈 설치 실패 — node-gyp 오류',
  },
  {
    id: 'sess-007',
    title: 'TypeScript 타입 유틸리티 모음',
    status: 'idle',
    model: 'claude-sonnet-4-6',
    updatedAt: '어제',
    pinned: false,
    messageCount: 11,
    artifactCount: 2,
  },
  {
    id: 'sess-008',
    title: 'Docker Compose로 개발 환경 구성하기 — PostgreSQL + Redis + MinIO + Nginx reverse proxy',
    status: 'idle',
    model: 'gemini-2.5-flash',
    updatedAt: '3일 전',
    pinned: false,
    messageCount: 19,
    artifactCount: 3,
  },
]

// ─── Run Step Fixtures ───────────────────────────────────────────────────────

export type MockRunStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'approval_needed'

export interface MockRunStep {
  id: string
  label: string
  status: MockRunStepStatus
  detail?: string
  durationMs?: number
}

export const MOCK_RUN_STEPS: MockRunStep[] = [
  { id: 'rs-1', label: '프로젝트 분석', status: 'success', durationMs: 1200 },
  { id: 'rs-2', label: '의존성 설치', status: 'success', detail: 'npm install — 47 packages', durationMs: 8400 },
  { id: 'rs-3', label: '코드 생성', status: 'success', detail: '3 files created', durationMs: 3200 },
  { id: 'rs-4', label: '프리뷰 빌드', status: 'running', detail: 'vite build...' },
  { id: 'rs-5', label: '파일 쓰기', status: 'approval_needed', detail: 'src/components/Hero.tsx 에 쓰기 권한 필요' },
  { id: 'rs-6', label: '배포 준비', status: 'pending' },
]

// ─── Artifact Fixtures ───────────────────────────────────────────────────────

export type MockArtifactKind = 'code' | 'markdown' | 'json' | 'diff' | 'plan' | 'preview'

export interface MockArtifact {
  id: string
  title: string
  kind: MockArtifactKind
  sessionId: string
  createdAt: string
  size: string
  version: number
}

export const MOCK_ARTIFACTS: MockArtifact[] = [
  { id: 'art-001', title: 'Hero.tsx', kind: 'code', sessionId: 'sess-001', createdAt: '5분 전', size: '2.4 KB', version: 3 },
  { id: 'art-002', title: 'landing-page-plan.md', kind: 'plan', sessionId: 'sess-001', createdAt: '15분 전', size: '1.1 KB', version: 1 },
  { id: 'art-003', title: 'api-spec-v2.json', kind: 'json', sessionId: 'sess-005', createdAt: '3시간 전', size: '8.7 KB', version: 2 },
  { id: 'art-004', title: 'dashboard-schema.diff', kind: 'diff', sessionId: 'sess-002', createdAt: '30분 전', size: '3.2 KB', version: 1 },
  { id: 'art-005', title: '주간 매출 리포트 워크플로우 정의', kind: 'markdown', sessionId: 'sess-003', createdAt: '12분 전', size: '940 B', version: 1 },
  { id: 'art-006', title: 'page-preview', kind: 'preview', sessionId: 'sess-001', createdAt: '3분 전', size: '—', version: 3 },
]

// ─── Approval Fixtures ───────────────────────────────────────────────────────

export type MockApprovalRisk = 'low' | 'medium' | 'high'

export interface MockApproval {
  id: string
  sessionId: string
  action: string
  detail: string
  risk: MockApprovalRisk
  retryable: boolean
}

export const MOCK_APPROVALS: MockApproval[] = [
  {
    id: 'apv-001',
    sessionId: 'sess-003',
    action: 'Google Sheets API 접근',
    detail: '매출 데이터를 읽기 위해 Google Sheets API에 접근합니다. 읽기 전용입니다.',
    risk: 'low',
    retryable: true,
  },
  {
    id: 'apv-002',
    sessionId: 'sess-002',
    action: '파일 덮어쓰기: src/components/Dashboard.tsx',
    detail: '기존 파일을 새 버전으로 교체합니다. 이전 버전은 체크포인트에 저장됩니다.',
    risk: 'medium',
    retryable: true,
  },
  {
    id: 'apv-003',
    sessionId: 'sess-003',
    action: 'Slack 메시지 전송',
    detail: '#sales-report 채널에 주간 매출 요약 메시지를 전송합니다.',
    risk: 'high',
    retryable: false,
  },
]

// ─── Log Fixtures ────────────────────────────────────────────────────────────

export interface MockLog {
  ts: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

export const MOCK_LOGS: MockLog[] = [
  { ts: '14:32:01', level: 'info', message: '세션 시작 — claude-sonnet-4-6' },
  { ts: '14:32:02', level: 'info', message: '프로젝트 컨텍스트 로드: 12 files, 3 folders' },
  { ts: '14:32:05', level: 'debug', message: 'Tool call: read_file("src/App.tsx")' },
  { ts: '14:32:06', level: 'info', message: 'Tool result: 42 lines read' },
  { ts: '14:32:08', level: 'warn', message: '큰 파일 감지: node_modules/.package-lock.json (245 KB) — 건너뜀' },
  { ts: '14:32:12', level: 'info', message: 'Tool call: bash("npm install sharp")' },
  { ts: '14:32:20', level: 'error', message: 'npm ERR! gyp ERR! build error — node-gyp rebuild failed' },
  { ts: '14:32:20', level: 'error', message: 'C:\\Program Files\\nodejs\\node_modules\\npm\\node_modules\\node-gyp\\bin\\node-gyp.js rebuild' },
  { ts: '14:32:21', level: 'info', message: '실패 복구 경로 제안: sharp 대신 jimp 사용을 시도합니다' },
  { ts: '14:32:25', level: 'info', message: 'Tool call: bash("npm install jimp")' },
  { ts: '14:32:30', level: 'info', message: '설치 완료: jimp@1.6.0' },
]

// ─── Builder Template Fixtures ───────────────────────────────────────────────

export interface MockTemplate {
  id: string
  emoji: string
  title: string
  description: string
  category: 'page' | 'tool' | 'workflow' | 'document'
}

export const MOCK_TEMPLATES: MockTemplate[] = [
  { id: 'tmpl-01', emoji: '🌐', title: '랜딩 페이지', description: '서비스 소개 페이지를 빠르게 만들어보세요', category: 'page' },
  { id: 'tmpl-02', emoji: '📊', title: '대시보드', description: '데이터 테이블 + 차트 기반 관리 도구', category: 'tool' },
  { id: 'tmpl-03', emoji: '📝', title: '폼 빌더', description: '입력 폼과 유효성 검사를 자동 생성', category: 'tool' },
  { id: 'tmpl-04', emoji: '⚡', title: '워크플로우 자동화', description: '파일 처리, 알림, 보고서 자동화', category: 'workflow' },
  { id: 'tmpl-05', emoji: '📄', title: '기술 문서', description: 'API 문서, README, 아키텍처 문서', category: 'document' },
  { id: 'tmpl-06', emoji: '🛒', title: '주문 관리 도구', description: '주문 목록, 상태 변경, 내보내기', category: 'tool' },
]

// ─── Chat Message Fixtures ───────────────────────────────────────────────────

export interface MockChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
}

export const MOCK_CHAT_MESSAGES: MockChatMessage[] = [
  {
    id: 'msg-001',
    role: 'user',
    content: '우리 카페 랜딩 페이지를 만들어줘. 모던한 느낌으로, 히어로 섹션, 메뉴 리스트, 연락처 폼이 있으면 좋겠어.',
    ts: Date.now() - 600000,
  },
  {
    id: 'msg-002',
    role: 'assistant',
    content: `좋습니다! 카페 랜딩 페이지를 만들어 보겠습니다.\n\n## 계획\n\n1. **히어로 섹션** — 큰 이미지 배경 + 카페 이름 + 한 줄 소개\n2. **메뉴 리스트** — 카테고리별 (커피, 디저트, 음료) 카드 그리드\n3. **연락처 폼** — 이름, 이메일, 메시지 입력\n\n### 기술 스택\n- React + Tailwind CSS\n- 반응형 (모바일 우선)\n\n진행할까요?`,
    ts: Date.now() - 590000,
  },
  {
    id: 'msg-003',
    role: 'user',
    content: '좋아, 진행해줘. 그리고 색상은 따뜻한 톤으로 해줘.',
    ts: Date.now() - 580000,
  },
  {
    id: 'msg-004',
    role: 'assistant',
    content: `따뜻한 톤 팔레트를 적용하여 코드를 생성하고 있습니다.\n\n\`\`\`tsx\n// Hero.tsx\nexport default function Hero() {\n  return (\n    <section className="relative h-[80vh] bg-amber-50">\n      <div className="absolute inset-0 bg-gradient-to-b from-amber-900/60 to-amber-800/40" />\n      <div className="relative z-10 flex flex-col items-center justify-center h-full text-white">\n        <h1 className="text-5xl font-bold">Cafe Blossom</h1>\n        <p className="mt-4 text-xl opacity-90">따뜻한 한 잔의 여유</p>\n      </div>\n    </section>\n  )\n}\n\`\`\`\n\n프리뷰가 준비되면 오른쪽에서 확인할 수 있습니다.`,
    ts: Date.now() - 560000,
  },
]

// ─── Context Panel Fixtures ──────────────────────────────────────────────────

export interface MockReference {
  id: string
  type: 'file' | 'memory' | 'web' | 'resource'
  title: string
  detail: string
}

export const MOCK_REFERENCES: MockReference[] = [
  { id: 'ref-01', type: 'file', title: 'src/App.tsx', detail: '42 lines — root component' },
  { id: 'ref-02', type: 'file', title: 'src/components/Hero.tsx', detail: '28 lines — hero section' },
  { id: 'ref-03', type: 'memory', title: '프로젝트 컨텍스트', detail: 'React + Tailwind, dark theme 기본' },
  { id: 'ref-04', type: 'web', title: 'Tailwind CSS 문서', detail: 'tailwindcss.com/docs' },
  { id: 'ref-05', type: 'resource', title: '.cursorrules', detail: '프로젝트 규칙 — 13 rules' },
]
