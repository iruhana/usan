import type { ShellSnapshot } from '@shared/types'

const DIFF_CONTENT = `--- a/src/components/Dashboard.tsx
+++ b/src/components/Dashboard.tsx
@@ -12,8 +12,10 @@ export default function Dashboard() {
   const [filter, setFilter] = useState<string>('all')
   const [sortBy, setSortBy] = useState<string>('date')

-  const filteredItems = items.filter(i => i.status === filter)
-  const sortedItems = filteredItems.sort((a, b) => a[sortBy] - b[sortBy])
+  const filteredItems = useMemo(
+    () => items.filter(i => filter === 'all' || i.status === filter),
+    [items, filter]
+  )
+  const sortedItems = useMemo(
+    () => [...filteredItems].sort((a, b) => a[sortBy] > b[sortBy] ? 1 : -1),
+    [filteredItems, sortBy]
+  )

   return (
     <div className="dashboard">
@@ -24,6 +26,7 @@ export default function Dashboard() {
         onChange={e => setFilter(e.target.value)}
       />
       <ExportButton data={sortedItems} />
+      <RefreshButton onClick={() => refetch()} />
     </div>
   )
 }`

export function createShellSnapshot(): ShellSnapshot {
  return {
    activeSessionId: 'sess-001',
    sessions: [
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
    ],
    runSteps: [
      { id: 'rs-1', sessionId: 'sess-001', label: '프로젝트 분석', status: 'success', durationMs: 1200 },
      { id: 'rs-2', sessionId: 'sess-001', label: '의존성 설치', status: 'success', detail: 'npm install — 47 packages', durationMs: 8400 },
      { id: 'rs-3', sessionId: 'sess-001', label: '코드 생성', status: 'success', detail: '3 files created', durationMs: 3200 },
      { id: 'rs-4', sessionId: 'sess-001', label: '프리뷰 빌드', status: 'running', detail: 'vite build...' },
      { id: 'rs-5', sessionId: 'sess-001', label: '파일 쓰기', status: 'approval_needed', detail: 'src/components/Hero.tsx 에 쓰기 권한 필요' },
      { id: 'rs-6', sessionId: 'sess-001', label: '배포 준비', status: 'pending' },
    ],
    attachments: [],
    artifacts: [
      {
        id: 'art-001',
        title: 'Hero.tsx',
        kind: 'code',
        sessionId: 'sess-001',
        createdAt: '5분 전',
        size: '2.4 KB',
        version: 3,
        content: `export default function Hero() {
  return (
    <section className="relative h-[80vh] bg-amber-50">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-900/60" />
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <h1 className="text-5xl font-bold text-white">Cafe Blossom</h1>
        <p className="mt-4 text-xl text-white/90">따뜻한 한 잔의 여유</p>
      </div>
    </section>
  )
}`,
      },
      {
        id: 'art-002',
        title: 'landing-page-plan.md',
        kind: 'plan',
        sessionId: 'sess-001',
        createdAt: '15분 전',
        size: '1.1 KB',
        version: 1,
        content: '# landing-page-plan.md\n\n카페 랜딩 페이지를 위해 히어로, 메뉴, 문의 폼 구성을 계획합니다.',
      },
      {
        id: 'art-003',
        title: 'api-spec-v2.json',
        kind: 'json',
        sessionId: 'sess-005',
        createdAt: '3시간 전',
        size: '8.7 KB',
        version: 2,
        content: `{
  "openapi": "3.0.0",
  "info": {
    "title": "Users API",
    "version": "2.0.0"
  },
  "paths": {
    "/api/v2/users": {
      "get": {
        "summary": "List all users"
      }
    }
  }
}`,
      },
      {
        id: 'art-004',
        title: 'dashboard-schema.diff',
        kind: 'diff',
        sessionId: 'sess-001',
        createdAt: '30분 전',
        size: '3.2 KB',
        version: 1,
        content: DIFF_CONTENT,
      },
      {
        id: 'art-005',
        title: '주간 매출 리포트 워크플로우 정의',
        kind: 'markdown',
        sessionId: 'sess-003',
        createdAt: '12분 전',
        size: '940 B',
        version: 1,
        content: '# 주간 매출 리포트 워크플로우 정의\n\nGoogle Sheets 읽기 → 요약 생성 → Slack 전송',
      },
      {
        id: 'art-006',
        title: 'page-preview',
        kind: 'preview',
        sessionId: 'sess-001',
        createdAt: '3분 전',
        size: '—',
        version: 3,
        content: '# page-preview\n\n현재 프리뷰는 Cafe Blossom 랜딩 페이지 3차 시안입니다.',
      },
    ],
    approvals: [
      {
        id: 'apv-001',
        sessionId: 'sess-003',
        action: 'Google Sheets API 접근',
        detail: '매출 데이터를 읽기 위해 Google Sheets API에 접근합니다. 읽기 전용입니다.',
        capability: 'integration:read',
        risk: 'low',
        status: 'pending',
        retryable: true,
        fallback: 'Google Sheets 동기화 없이 보고서 초안만 생성합니다.',
      },
      {
        id: 'apv-002',
        sessionId: 'sess-002',
        action: '파일 덮어쓰기: src/components/Dashboard.tsx',
        detail: '기존 파일을 새 버전으로 교체합니다. 이전 버전은 체크포인트에 저장됩니다.',
        capability: 'filesystem:write',
        risk: 'medium',
        status: 'pending',
        retryable: true,
        fallback: '패치 초안만 유지하고 파일 적용은 건너뜁니다.',
        stepId: 'rs-5',
      },
      {
        id: 'apv-003',
        sessionId: 'sess-003',
        action: 'Slack 메시지 전송',
        detail: '#sales-report 채널에 주간 매출 요약 메시지를 전송합니다.',
        capability: 'integration:write',
        risk: 'high',
        status: 'pending',
        retryable: false,
        fallback: '승인 전까지 Slack 전송 없이 로컬 아티팩트만 남깁니다.',
      },
    ],
    logs: [
      { id: 'log-01', sessionId: 'sess-001', ts: '14:32:01', level: 'info', message: '세션 시작 — claude-sonnet-4-6' },
      { id: 'log-02', sessionId: 'sess-001', ts: '14:32:02', level: 'info', message: '프로젝트 컨텍스트 로드: 12 files, 3 folders' },
      { id: 'log-03', sessionId: 'sess-001', ts: '14:32:05', level: 'debug', message: 'Tool call: read_file("src/App.tsx")' },
      { id: 'log-04', sessionId: 'sess-001', ts: '14:32:06', level: 'info', message: 'Tool result: 42 lines read' },
      { id: 'log-05', sessionId: 'sess-001', ts: '14:32:08', level: 'warn', message: '큰 파일 감지: node_modules/.package-lock.json (245 KB) — 건너뜀' },
      { id: 'log-06', sessionId: 'sess-001', ts: '14:32:12', level: 'info', message: 'Tool call: bash("npm install sharp")' },
      { id: 'log-07', sessionId: 'sess-001', ts: '14:32:20', level: 'error', message: 'npm ERR! gyp ERR! build error — node-gyp rebuild failed' },
      { id: 'log-08', sessionId: 'sess-001', ts: '14:32:20', level: 'error', message: 'C:\\Program Files\\nodejs\\node_modules\\npm\\node_modules\\node-gyp\\bin\\node-gyp.js rebuild' },
      { id: 'log-09', sessionId: 'sess-001', ts: '14:32:21', level: 'info', message: '실패 복구 경로 제안: sharp 대신 jimp 사용을 시도합니다' },
      { id: 'log-10', sessionId: 'sess-001', ts: '14:32:25', level: 'info', message: 'Tool call: bash("npm install jimp")' },
      { id: 'log-11', sessionId: 'sess-001', ts: '14:32:30', level: 'info', message: '설치 완료: jimp@1.6.0' },
    ],
    templates: [
      { id: 'tmpl-01', emoji: '🌐', title: '랜딩 페이지', description: '서비스 소개 페이지를 빠르게 만들어보세요', category: 'page' },
      { id: 'tmpl-02', emoji: '📊', title: '대시보드', description: '데이터 테이블 + 차트 기반 관리 도구', category: 'tool' },
      { id: 'tmpl-03', emoji: '📝', title: '폼 빌더', description: '입력 폼과 유효성 검사를 자동 생성', category: 'tool' },
      { id: 'tmpl-04', emoji: '⚡', title: '워크플로우 자동화', description: '파일 처리, 알림, 보고서 자동화', category: 'workflow' },
      { id: 'tmpl-05', emoji: '📄', title: '기술 문서', description: 'API 문서, README, 아키텍처 문서', category: 'document' },
      { id: 'tmpl-06', emoji: '🛒', title: '주문 관리 도구', description: '주문 목록, 상태 변경, 내보내기', category: 'tool' },
    ],
    messages: [
      {
        id: 'msg-001',
        sessionId: 'sess-001',
        role: 'user',
        content: '우리 카페 랜딩 페이지를 만들어줘. 모던한 느낌으로, 히어로 섹션, 메뉴 리스트, 연락처 폼이 있으면 좋겠어.',
        ts: Date.now() - 600000,
      },
      {
        id: 'msg-002',
        sessionId: 'sess-001',
        role: 'assistant',
        content: `좋습니다! 카페 랜딩 페이지를 만들어 보겠습니다.\n\n## 계획\n\n1. **히어로 섹션** — 큰 이미지 배경 + 카페 이름 + 한 줄 소개\n2. **메뉴 리스트** — 카테고리별 (커피, 디저트, 음료) 카드 그리드\n3. **연락처 폼** — 이름, 이메일, 메시지 입력\n\n### 기술 스택\n- React + Tailwind CSS\n- 반응형 (모바일 우선)\n\n진행할까요?`,
        ts: Date.now() - 590000,
      },
      {
        id: 'msg-003',
        sessionId: 'sess-001',
        role: 'user',
        content: '좋아, 진행해줘. 그리고 색상은 따뜻한 톤으로 해줘.',
        ts: Date.now() - 580000,
      },
      {
        id: 'msg-004',
        sessionId: 'sess-001',
        role: 'assistant',
        content: `따뜻한 톤 팔레트를 적용하여 코드를 생성하고 있습니다.\n\n\`\`\`tsx
// Hero.tsx
export default function Hero() {
  return (
    <section className="relative h-[80vh] bg-amber-50">
      <div className="absolute inset-0 bg-gradient-to-b from-amber-900/60 to-amber-800/40" />
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-white">
        <h1 className="text-5xl font-bold">Cafe Blossom</h1>
        <p className="mt-4 text-xl opacity-90">따뜻한 한 잔의 여유</p>
      </div>
    </section>
  )
}
\`\`\`\n\n프리뷰가 준비되면 오른쪽에서 확인할 수 있습니다.`,
        ts: Date.now() - 560000,
      },
    ],
    references: [
      { id: 'ref-01', sessionId: 'sess-001', type: 'file', title: 'src/App.tsx', detail: '42 lines — root component' },
      { id: 'ref-02', sessionId: 'sess-001', type: 'file', title: 'src/components/Hero.tsx', detail: '28 lines — hero section' },
      { id: 'ref-03', sessionId: 'sess-001', type: 'memory', title: '프로젝트 컨텍스트', detail: 'React + Tailwind, dark theme 기본' },
      { id: 'ref-04', sessionId: 'sess-001', type: 'web', title: 'Tailwind CSS 문서', detail: 'tailwindcss.com/docs' },
      { id: 'ref-05', sessionId: 'sess-001', type: 'resource', title: '.cursorrules', detail: '프로젝트 규칙 — 13 rules' },
    ],
    previews: [
      { sessionId: 'sess-001', title: 'page-preview', status: 'healthy', version: 3 },
      { sessionId: 'sess-006', title: 'image-resize-preview', status: 'failed', version: 1 },
    ],
  }
}
