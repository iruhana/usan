import { vi } from 'vitest'
import { DEFAULT_APP_SETTINGS, type AppSettings, type ShellSnapshot, type StreamChunk } from '@shared/types'

function createShellSnapshot(): ShellSnapshot {
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
        messageCount: 4,
        artifactCount: 1,
      },
    ],
    runSteps: [
      { id: 'step-1', sessionId: 'sess-001', label: '프로젝트 분석', status: 'success', durationMs: 1000 },
    ],
    artifacts: [
      {
        id: 'art-001',
        title: 'Hero.tsx',
        kind: 'code',
        sessionId: 'sess-001',
        createdAt: '5분 전',
        size: '2.4 KB',
        version: 3,
        content: 'export default function Hero() { return null }',
      },
    ],
    approvals: [],
    logs: [
      {
        id: 'log-001',
        sessionId: 'sess-001',
        ts: '14:32:01',
        level: 'info',
        message: '세션 시작',
      },
    ],
    templates: [
      {
        id: 'tmpl-001',
        emoji: '🌐',
        title: '랜딩 페이지',
        description: '서비스 소개 페이지를 빠르게 만들어보세요',
        category: 'page',
      },
    ],
    messages: [
      {
        id: 'msg-001',
        sessionId: 'sess-001',
        role: 'user',
        content: '우리 카페 랜딩 페이지를 만들어줘.',
        ts: Date.now(),
      },
    ],
    references: [
      {
        id: 'ref-001',
        sessionId: 'sess-001',
        type: 'file',
        title: 'src/App.tsx',
        detail: '42 lines — root component',
      },
    ],
    previews: [
      {
        sessionId: 'sess-001',
        title: 'page-preview',
        status: 'healthy',
        version: 3,
      },
    ],
  }
}

export function installMockUsan(options?: {
  snapshot?: ShellSnapshot
  settings?: AppSettings
}) {
  const snapshot = options?.snapshot ?? createShellSnapshot()
  const chunkListeners = new Set<(chunk: StreamChunk) => void>()
  let settings = {
    ...DEFAULT_APP_SETTINGS,
    onboardingDismissed: true,
    ...(options?.settings ?? {}),
  }

  const api = {
    tabs: {
      switch: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    },
    ai: {
      chat: vi.fn().mockResolvedValue(null),
      stop: vi.fn().mockResolvedValue(undefined),
      onChunk: vi.fn().mockImplementation((cb: (chunk: StreamChunk) => void) => {
        chunkListeners.add(cb)
        return () => {
          chunkListeners.delete(cb)
        }
      }),
    },
    skills: {
      list: vi.fn().mockResolvedValue([]),
      read: vi.fn().mockResolvedValue(''),
      reindex: vi.fn().mockResolvedValue({ count: 0 }),
    },
    shell: {
      getSnapshot: vi.fn().mockResolvedValue(snapshot),
    },
    settings: {
      get: vi.fn().mockImplementation(async () => settings),
      update: vi.fn().mockImplementation(async (patch: Partial<AppSettings>) => {
        settings = {
          ...settings,
          ...patch,
        }
        return settings
      }),
    },
    window: {
      minimize: vi.fn().mockResolvedValue(undefined),
      maximize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      isMaximized: vi.fn().mockResolvedValue(false),
    },
    emitChunk: (chunk: StreamChunk) => {
      for (const listener of chunkListeners) {
        listener(chunk)
      }
    },
  }

  Object.defineProperty(window, 'usan', {
    configurable: true,
    value: api,
  })

  return api
}
