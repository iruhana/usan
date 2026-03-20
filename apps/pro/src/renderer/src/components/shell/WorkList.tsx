/**
 * Z3: Work List / Session Surface
 * Recent sessions, pinned work, search, and history filters.
 */
import { useState } from 'react'
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  GitBranch,
  Info,
  Loader2,
  Pin,
  Paperclip,
  RotateCcw,
  Search,
  ShieldAlert,
  TerminalSquare,
  X,
} from 'lucide-react'
import type {
  ArtifactKind,
  PreviewStatus,
  SessionStatus,
  ShellAttachment,
  ShellArtifact,
  ShellLog,
  ShellPreview,
  ShellSession,
} from '@shared/types'
import { useShellStore } from '../../stores/shell.store'
import { useUiStore, type LogFeedFilter, type WorkListFilter } from '../../stores/ui.store'
import { getAttachmentTextPreview } from '../../utils/attachmentPreview'
import {
  findLatestAttachmentDeliveryLog,
  getResolvedAttachmentDeliveryPresentation,
  getAttachmentDeliveryModePresentation,
} from '../../utils/attachmentDelivery'
import AttachmentDeliveryBadge from './AttachmentDeliveryBadge'
import AttachmentTextDisclosure from './AttachmentTextDisclosure'

interface SessionApprovalSummary {
  pending: number
  approved: number
  denied: number
}

interface SessionLogSummary {
  message: string
  ts: string
  kind?: ShellLog['kind']
  status?: ShellLog['status']
  capability?: ShellLog['capability']
  toolName?: ShellLog['toolName']
  attachmentName?: ShellLog['attachmentName']
  attachmentDeliveryMode?: ShellLog['attachmentDeliveryMode']
  modelId?: ShellLog['modelId']
}

interface SessionAttachmentSummary {
  attachment: ShellAttachment
  name: string
  count: number
  kind: ShellAttachment['kind']
  status: ShellAttachment['status']
  previewText: string | null
}

interface SessionArtifactSummary {
  artifact: ShellArtifact
  title: string
  kind: ShellArtifact['kind']
  version: number
  size: string
  createdAt: string
  previewText: string | null
}

interface SessionPreviewSummary {
  preview: ShellPreview
  title: string
  status: ShellPreview['status']
  version: number
}

interface SessionRowAction {
  icon: typeof Archive
  label: string
  onClick: () => void
}

interface AttachmentRouteSummaryBadge {
  mode: string
  label: string
  color: string
  background: string
  count: number
}

interface SessionRowMeta {
  session: ShellSession
  approvalSummary: SessionApprovalSummary
  latestLogSummary: SessionLogSummary | null
  latestAttachmentSummary: SessionAttachmentSummary | null
  latestArtifactSummary: SessionArtifactSummary | null
  previewSummary: SessionPreviewSummary | null
  recentAttachments: ShellAttachment[]
  sessionLogs: ShellLog[]
}

const STATUS_CONFIG: Record<SessionStatus, { icon: typeof Clock; color: string; label: string }> = {
  active: { icon: Clock, color: 'var(--accent)', label: '활성' },
  idle: { icon: Clock, color: 'var(--text-muted)', label: '대기' },
  running: { icon: Loader2, color: 'var(--warning)', label: '실행 중' },
  failed: { icon: AlertTriangle, color: 'var(--danger)', label: '실패' },
  approval_pending: { icon: ShieldAlert, color: 'var(--warning)', label: '승인 대기' },
}

const LOG_KIND_CONFIG = {
  attachment: { color: 'var(--warning)', background: 'var(--warning-soft)', label: 'attachment' },
  session: { color: 'var(--accent)', background: 'var(--accent-soft)', label: '세션' },
  tool: { color: 'var(--success)', background: 'var(--success-soft)', label: '도구' },
  approval: { color: 'var(--warning)', background: 'var(--warning-soft)', label: '승인' },
  system: { color: 'var(--text-secondary)', background: 'var(--bg-hover)', label: '시스템' },
} as const

const LOG_STATUS_CONFIG = {
  pending: { color: 'var(--warning)', background: 'var(--warning-soft)', label: '대기' },
  running: { color: 'var(--accent)', background: 'var(--accent-soft)', label: '실행 중' },
  success: { color: 'var(--success)', background: 'var(--success-soft)', label: '완료' },
  failed: { color: 'var(--danger)', background: 'var(--danger-soft)', label: '실패' },
  skipped: { color: 'var(--text-muted)', background: 'var(--bg-hover)', label: '건너뜀' },
  approved: { color: 'var(--success)', background: 'var(--success-soft)', label: '승인됨' },
  denied: { color: 'var(--danger)', background: 'var(--danger-soft)', label: '거부' },
} as const

const FILTER_CONFIG: Record<WorkListFilter, { label: string }> = {
  all: { label: '전체' },
  approvals: { label: '승인 대기' },
  tools: { label: '도구' },
  attachments: { label: '첨부' },
  issues: { label: '이슈' },
}

const ATTACHMENT_KIND_CONFIG = {
  file: { color: 'var(--text-secondary)', background: 'var(--bg-hover)', label: '파일' },
  image: { color: 'var(--accent)', background: 'var(--accent-soft)', label: '이미지' },
  screenshot: { color: 'var(--warning)', background: 'var(--warning-soft)', label: '스크린샷' },
} as const

const ATTACHMENT_STATUS_CONFIG = {
  staged: { color: 'var(--warning)', background: 'var(--warning-soft)', label: '대기' },
  sent: { color: 'var(--success)', background: 'var(--success-soft)', label: '전송' },
} as const

const ARTIFACT_KIND_CONFIG: Record<ArtifactKind, { color: string; background: string; label: string }> = {
  code: { color: 'var(--accent)', background: 'var(--accent-soft)', label: '코드' },
  markdown: { color: 'var(--success)', background: 'var(--success-soft)', label: '마크다운' },
  json: { color: 'var(--text-secondary)', background: 'var(--bg-hover)', label: 'JSON' },
  diff: { color: 'var(--warning)', background: 'var(--warning-soft)', label: 'Diff' },
  plan: { color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent-soft) 72%, white)' , label: '계획' },
  preview: { color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning-soft) 72%, white)', label: '프리뷰' },
}

const PREVIEW_STATUS_CONFIG: Record<PreviewStatus, { color: string; background: string; label: string }> = {
  healthy: { color: 'var(--success)', background: 'var(--success-soft)', label: '정상' },
  partial: { color: 'var(--warning)', background: 'var(--warning-soft)', label: '부분' },
  stale: { color: 'var(--text-muted)', background: 'var(--bg-hover)', label: '오래됨' },
  failed: { color: 'var(--danger)', background: 'var(--danger-soft)', label: '실패' },
}

export default function WorkList() {
  const navExpanded = useUiStore((state) => state.navExpanded)
  const sessionHistoryOpen = useUiStore((state) => state.sessionHistoryOpen)
  const activityFilter = useUiStore((state) => state.workListFilter)
  const setWorkListFilter = useUiStore((state) => state.setWorkListFilter)
  const setLogFeedFilter = useUiStore((state) => state.setLogFeedFilter)
  const setUtilityTab = useUiStore((state) => state.setUtilityTab)
  const activeSessionId = useShellStore((state) => state.activeSessionId)
  const approvals = useShellStore((state) => state.approvals)
  const attachments = useShellStore((state) => state.attachments)
  const artifacts = useShellStore((state) => state.artifacts)
  const logs = useShellStore((state) => state.logs)
  const previews = useShellStore((state) => state.previews)
  const sessions = useShellStore((state) => state.sessions)
  const setActiveSession = useShellStore((state) => state.setActiveSession)
  const branchSession = useShellStore((state) => state.branchSession)
  const archiveSession = useShellStore((state) => state.archiveSession)
  const restoreSession = useShellStore((state) => state.restoreSession)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  if (!navExpanded) return null

  const sessionMeta = sessions.map((session) => ({
    session,
    approvalSummary: summarizeSessionApprovals(approvals, session.id),
    latestLogSummary: summarizeLatestSessionLog(logs, session.id),
    latestAttachmentSummary: summarizeLatestSessionAttachment(attachments, session.id),
    latestArtifactSummary: summarizeLatestSessionArtifact(artifacts, session.id),
    previewSummary: summarizeSessionPreview(previews, session.id),
    recentAttachments: listRecentSessionAttachments(attachments, session.id),
    sessionLogs: logs.filter((log) => log.sessionId === session.id),
  }))

  const searchFiltered = sessionMeta.filter(({ session }) =>
    !searchQuery || session.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const scopeFiltered = searchFiltered.filter(({ session }) =>
    sessionHistoryOpen || !session.archivedAt
  )
  const filtered = scopeFiltered.filter((meta) => matchesActivityFilter(meta, activityFilter))
  const visibleSessions = filtered.filter(({ session }) => !session.archivedAt)
  const archivedSessions = filtered.filter(({ session }) => Boolean(session.archivedAt))
  const pinned = visibleSessions.filter(({ session }) => session.pinned)
  const recent = visibleSessions.filter(({ session }) => !session.pinned)

  const filterCounts = {
    all: scopeFiltered.length,
    approvals: scopeFiltered.filter((meta) => matchesActivityFilter(meta, 'approvals')).length,
    tools: scopeFiltered.filter((meta) => matchesActivityFilter(meta, 'tools')).length,
    attachments: scopeFiltered.filter((meta) => matchesActivityFilter(meta, 'attachments')).length,
    issues: scopeFiltered.filter((meta) => matchesActivityFilter(meta, 'issues')).length,
  }

  const syncUtilityForFilter = (filter: WorkListFilter) => {
    if (filter === 'approvals') {
      setLogFeedFilter('all')
      setUtilityTab('approvals')
      return
    }

    if (filter === 'tools' || filter === 'attachments' || filter === 'issues') {
      setLogFeedFilter(filter)
      setUtilityTab('logs')
      return
    }

    setLogFeedFilter('all')
  }

  const handleSelectActivityFilter = (filter: WorkListFilter) => {
    setWorkListFilter(filter)
    syncUtilityForFilter(filter)
  }

  const focusSessionPanel = async (
    session: ShellSession,
    tab: 'logs' | 'approvals',
    logFilter: LogFeedFilter = 'all',
  ) => {
    if (session.archivedAt) {
      await restoreSession(session.id)
    }

    await setActiveSession(session.id)
    if (tab === 'logs') {
      setLogFeedFilter(logFilter)
    } else {
      setLogFeedFilter('all')
    }
    setUtilityTab(tab)
  }

  const buildRowActions = (
    session: ShellSession,
    approvalSummary: SessionApprovalSummary,
    latestLogSummary: SessionLogSummary | null,
  ): SessionRowAction[] => {
    const actions: SessionRowAction[] = []

    if (approvalSummary.pending > 0) {
      actions.push({
        icon: ShieldAlert,
        label: `${session.title} 승인 보기`,
        onClick: () => {
          void focusSessionPanel(session, 'approvals')
        },
      })
    }

    if (latestLogSummary) {
      actions.push({
        icon: TerminalSquare,
        label: `${session.title} 로그 보기`,
        onClick: () => {
          void focusSessionPanel(session, 'logs', getLogFeedFilterForSummary(latestLogSummary))
        },
      })
    }

    return actions
  }

  return (
    <div
      data-shell-zone="work-list"
      data-shell-filter={activityFilter}
      style={{
        width: 'var(--worklist-width)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-default)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: 'var(--sp-3) var(--sp-3) var(--sp-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          작업 목록
        </span>
        {sessionHistoryOpen && (
          <span
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--accent)',
              background: 'var(--accent-soft)',
              padding: '1px 8px',
              borderRadius: 10,
            }}
          >
            히스토리
          </span>
        )}
        <button
          onClick={() => {
            setSearchOpen(!searchOpen)
            setSearchQuery('')
          }}
          aria-label="검색 열기"
          className="focus-ring"
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'color var(--dur-micro)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          {searchOpen ? <X size={12} /> : <Search size={12} />}
        </button>
      </div>

      {searchOpen && (
        <div
          style={{
            padding: 'var(--sp-2) var(--sp-3)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="세션 검색..."
            style={{
              width: '100%',
              padding: '5px var(--sp-2)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-sm)',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-focus)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)'
            }}
          />
        </div>
      )}

      {scopeFiltered.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--sp-2)',
            padding: 'var(--sp-2) var(--sp-3)',
            borderBottom: '1px solid var(--border-subtle)',
            overflowX: 'auto',
          }}
        >
          {(Object.keys(FILTER_CONFIG) as WorkListFilter[]).map((filterId) => (
            <FilterChip
              key={filterId}
              label={`${FILTER_CONFIG[filterId].label} ${filterCounts[filterId]}`}
              active={activityFilter === filterId}
              onClick={() => handleSelectActivityFilter(filterId)}
            />
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {pinned.length > 0 && (
          <>
            <SectionLabel icon={Pin} label="고정됨" />
            {pinned.map(({
              session,
              approvalSummary,
              latestLogSummary,
              latestAttachmentSummary,
              latestArtifactSummary,
              previewSummary,
              recentAttachments,
              sessionLogs,
            }) => (
              <SessionRow
                key={session.id}
                session={session}
                active={session.id === activeSessionId}
                approvalSummary={approvalSummary}
                latestLogSummary={latestLogSummary}
                latestAttachmentSummary={latestAttachmentSummary}
                latestArtifactSummary={latestArtifactSummary}
                previewSummary={previewSummary}
                recentAttachments={recentAttachments}
                sessionLogs={sessionLogs}
                onClick={() => {
                  void setActiveSession(session.id)
                }}
                actions={[
                  ...buildRowActions(session, approvalSummary, latestLogSummary),
                  {
                    icon: GitBranch,
                    label: `${session.title} 분기`,
                    onClick: () => {
                      void branchSession(session.id)
                    },
                  },
                  {
                    icon: Archive,
                    label: `${session.title} 보관`,
                    onClick: () => {
                      void archiveSession(session.id)
                    },
                  },
                ]}
              />
            ))}
          </>
        )}

        {recent.length > 0 && (
          <>
            <SectionLabel icon={Clock} label="최근" />
            {recent.map(({
              session,
              approvalSummary,
              latestLogSummary,
              latestAttachmentSummary,
              latestArtifactSummary,
              previewSummary,
              recentAttachments,
              sessionLogs,
            }) => (
              <SessionRow
                key={session.id}
                session={session}
                active={session.id === activeSessionId}
                approvalSummary={approvalSummary}
                latestLogSummary={latestLogSummary}
                latestAttachmentSummary={latestAttachmentSummary}
                latestArtifactSummary={latestArtifactSummary}
                previewSummary={previewSummary}
                recentAttachments={recentAttachments}
                sessionLogs={sessionLogs}
                onClick={() => {
                  void setActiveSession(session.id)
                }}
                actions={[
                  ...buildRowActions(session, approvalSummary, latestLogSummary),
                  {
                    icon: GitBranch,
                    label: `${session.title} 분기`,
                    onClick: () => {
                      void branchSession(session.id)
                    },
                  },
                  {
                    icon: Archive,
                    label: `${session.title} 보관`,
                    onClick: () => {
                      void archiveSession(session.id)
                    },
                  },
                ]}
              />
            ))}
          </>
        )}

        {sessionHistoryOpen && archivedSessions.length > 0 && (
          <>
            <SectionLabel icon={Archive} label="보관됨" />
            {archivedSessions.map(({
              session,
              approvalSummary,
              latestLogSummary,
              latestAttachmentSummary,
              latestArtifactSummary,
              previewSummary,
              recentAttachments,
              sessionLogs,
            }) => (
              <SessionRow
                key={session.id}
                session={session}
                active={false}
                approvalSummary={approvalSummary}
                latestLogSummary={latestLogSummary}
                latestAttachmentSummary={latestAttachmentSummary}
                latestArtifactSummary={latestArtifactSummary}
                previewSummary={previewSummary}
                recentAttachments={recentAttachments}
                sessionLogs={sessionLogs}
                actions={[
                  ...buildRowActions(session, approvalSummary, latestLogSummary),
                  {
                    icon: GitBranch,
                    label: `${session.title} 분기`,
                    onClick: () => {
                      void branchSession(session.id)
                    },
                  },
                  {
                    icon: RotateCcw,
                    label: `${session.title} 복원`,
                    onClick: () => {
                      void restoreSession(session.id)
                    },
                  },
                ]}
              />
            ))}
          </>
        )}

        {filtered.length === 0 && (
          <div style={{ padding: 'var(--sp-6) var(--sp-4)', textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
              {searchQuery
                ? '검색 결과가 없습니다'
                : activityFilter !== 'all'
                  ? '선택한 조건에 맞는 세션이 없습니다'
                  : sessionHistoryOpen
                    ? '표시할 세션이 없습니다'
                    : '세션이 없습니다'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className="focus-ring"
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '4px 10px',
        borderRadius: 999,
        border: active ? '1px solid var(--accent)' : '1px solid var(--border-default)',
        background: active ? 'var(--accent-soft)' : 'var(--bg-elevated)',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background var(--dur-micro), color var(--dur-micro), border-color var(--dur-micro)',
      }}
    >
      {label}
    </button>
  )
}

function SectionLabel({ icon: Icon, label }: { icon: typeof Pin; label: string }) {
  return (
    <div
      style={{
        padding: 'var(--sp-3) var(--sp-3) var(--sp-1)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-1)',
      }}
    >
      <Icon size={10} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
      <span
        style={{
          fontSize: 'var(--fs-xs)',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
    </div>
  )
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 72,
        padding: 'var(--sp-2)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function DetailBadge({
  label,
  color,
  background,
}: {
  label: string
  color: string
  background: string
}) {
  return (
    <span
      style={{
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        color,
        background,
        borderRadius: '999px',
        padding: '1px 8px',
      }}
    >
      {label}
    </span>
  )
}

function summarizeSessionApprovals(
  approvals: ReturnType<typeof useShellStore.getState>['approvals'],
  sessionId: string,
): SessionApprovalSummary {
  return approvals.reduce<SessionApprovalSummary>((summary, approval) => {
    if (approval.sessionId !== sessionId) {
      return summary
    }

    summary[approval.status] += 1
    return summary
  }, {
    pending: 0,
    approved: 0,
    denied: 0,
  })
}

function summarizeLatestSessionLog(logs: ShellLog[], sessionId: string): SessionLogSummary | null {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const log = logs[index]
    if (!log || log.sessionId !== sessionId) {
      continue
    }

    return {
      message: log.message,
      ts: log.ts,
      kind: log.kind,
      status: log.status,
      capability: log.capability,
      toolName: log.toolName,
      attachmentName: log.attachmentName,
      attachmentDeliveryMode: log.attachmentDeliveryMode,
      modelId: log.modelId,
    }
  }

  return null
}

function summarizeLatestSessionAttachment(
  attachments: ShellAttachment[],
  sessionId: string,
): SessionAttachmentSummary | null {
  let count = 0
  let latestAttachment: ShellAttachment | null = null

  for (let index = attachments.length - 1; index >= 0; index -= 1) {
    const attachment = attachments[index]
    if (!attachment || attachment.sessionId !== sessionId) {
      continue
    }

    count += 1
    latestAttachment ??= attachment
  }

  if (!latestAttachment) {
    return null
  }

  return {
    attachment: latestAttachment,
    name: latestAttachment.name,
    count,
    kind: latestAttachment.kind,
    status: latestAttachment.status,
    previewText: getAttachmentTextPreview(latestAttachment.textContent, 72),
  }
}

function getArtifactContentPreview(content?: string, maxChars = 96) {
  if (!content) {
    return null
  }

  const normalized = content
    .replace(/[`#>*_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) {
    return null
  }

  return normalized.length > maxChars
    ? `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
    : normalized
}

function summarizeLatestSessionArtifact(
  artifacts: ShellArtifact[],
  sessionId: string,
): SessionArtifactSummary | null {
  let latestArtifact: ShellArtifact | null = null

  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index]
    if (!artifact || artifact.sessionId !== sessionId) {
      continue
    }

    if (!latestArtifact || artifact.version >= latestArtifact.version) {
      latestArtifact = artifact
    }
  }

  if (!latestArtifact) {
    return null
  }

  return {
    artifact: latestArtifact,
    title: latestArtifact.title,
    kind: latestArtifact.kind,
    version: latestArtifact.version,
    size: latestArtifact.size,
    createdAt: latestArtifact.createdAt,
    previewText: getArtifactContentPreview(latestArtifact.content),
  }
}

function summarizeSessionPreview(
  previews: ShellPreview[],
  sessionId: string,
): SessionPreviewSummary | null {
  for (let index = previews.length - 1; index >= 0; index -= 1) {
    const preview = previews[index]
    if (!preview || preview.sessionId !== sessionId) {
      continue
    }

    return {
      preview,
      title: preview.title,
      status: preview.status,
      version: preview.version,
    }
  }

  return null
}

function listRecentSessionAttachments(
  attachments: ShellAttachment[],
  sessionId: string,
  limit = 3,
): ShellAttachment[] {
  const recentAttachments: ShellAttachment[] = []

  for (let index = attachments.length - 1; index >= 0; index -= 1) {
    const attachment = attachments[index]
    if (!attachment || attachment.sessionId !== sessionId) {
      continue
    }

    recentAttachments.push(attachment)
    if (recentAttachments.length >= limit) {
      break
    }
  }

  return recentAttachments
}

function summarizeRecentAttachmentRoutes(
  attachments: ShellAttachment[],
  logs: ShellLog[],
  modelId?: string,
): AttachmentRouteSummaryBadge[] {
  const summary = new Map<string, AttachmentRouteSummaryBadge>()

  for (const attachment of attachments) {
    const deliveryLog = findLatestAttachmentDeliveryLog(logs, attachment.sessionId, attachment.name)
    const presentation = getResolvedAttachmentDeliveryPresentation(attachment, modelId, deliveryLog)
    const key = `${presentation.mode}:${deliveryLog?.modelId ?? modelId ?? ''}`
    const existing = summary.get(key)

    if (existing) {
      existing.count += 1
      continue
    }

    summary.set(key, {
      mode: presentation.mode,
      label: presentation.label,
      color: presentation.color,
      background: presentation.background,
      count: 1,
    })
  }

  return [...summary.values()]
}

function buildSessionDetailSummary({
  session,
  approvalSummary,
  latestLogSummary,
  latestAttachmentSummary,
  latestArtifactSummary,
  previewSummary,
  recentAttachmentRouteBadges,
  recentLogs,
}: {
  session: ShellSession
  approvalSummary: SessionApprovalSummary
  latestLogSummary: SessionLogSummary | null | undefined
  latestAttachmentSummary: SessionAttachmentSummary | null | undefined
  latestArtifactSummary: SessionArtifactSummary | null | undefined
  previewSummary: SessionPreviewSummary | null | undefined
  recentAttachmentRouteBadges: AttachmentRouteSummaryBadge[]
  recentLogs: ShellLog[]
}) {
  const lines = [
    `# ${session.title}`,
    `- 상태: ${STATUS_CONFIG[session.status].label}`,
    `- 모델: ${session.model}`,
    `- 메시지: ${session.messageCount}`,
    `- 아티팩트: ${session.artifactCount}`,
    `- 첨부: ${latestAttachmentSummary?.count ?? 0}`,
    `- 로그: ${recentLogs.length}`,
    `- 승인 대기: ${approvalSummary.pending}`,
    `- 승인됨: ${approvalSummary.approved}`,
    `- 거부: ${approvalSummary.denied}`,
  ]

  if (session.archivedAt) {
    lines.push(`- 보관됨: ${session.archivedAt}`)
  }

  if (session.branchedFromMessageId) {
    lines.push(`- 분기: 메시지 ${session.branchedFromMessageId}`)
  } else if (session.branchedFromSessionId) {
    lines.push(`- 분기: 세션 ${session.branchedFromSessionId}`)
  }

  if (latestLogSummary) {
    lines.push(`- 최신 로그: ${latestLogSummary.ts} ${latestLogSummary.message}`)
  }

  if (latestAttachmentSummary) {
    lines.push(`- 최신 첨부: ${latestAttachmentSummary.name}`)
  }

  if (latestArtifactSummary) {
    lines.push(
      `- 최신 아티팩트: ${latestArtifactSummary.title} · ${ARTIFACT_KIND_CONFIG[latestArtifactSummary.kind].label} · v${latestArtifactSummary.version} · ${latestArtifactSummary.size}`,
    )
    if (latestArtifactSummary.previewText) {
      lines.push(`- 아티팩트 요약: ${latestArtifactSummary.previewText}`)
    }
  }

  if (previewSummary) {
    lines.push(
      `- 프리뷰: ${previewSummary.title} · ${PREVIEW_STATUS_CONFIG[previewSummary.status].label} · v${previewSummary.version}`,
    )
  }

  if (recentAttachmentRouteBadges.length > 0) {
    lines.push(`- 첨부 경로: ${recentAttachmentRouteBadges.map((badge) => `${badge.label} ${badge.count}`).join(', ')}`)
  }

  if (recentLogs.length > 0) {
    lines.push('', '## 최근 로그')
    for (const log of recentLogs) {
      lines.push(`- [${log.ts}] ${log.message}`)
    }
  }

  return lines.join('\n')
}

function toSessionSummaryFileName(title: string) {
  const withoutControlChars = Array.from(title.trim())
    .filter((char) => char >= ' ')
    .join('')

  const sanitized = withoutControlChars
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')

  return `${sanitized || 'session'}-summary.md`
}

function downloadSessionDetailSummary(title: string, content: string) {
  if (typeof URL.createObjectURL !== 'function' || typeof URL.revokeObjectURL !== 'function') {
    return
  }

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = toSessionSummaryFileName(title)
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

function getLogFeedFilterForSummary(summary: SessionLogSummary | null): LogFeedFilter {
  if (!summary) {
    return 'all'
  }

  if (summary.kind === 'attachment' || summary.attachmentName || summary.attachmentDeliveryMode) {
    return 'attachments'
  }

  if (summary.status === 'failed' || summary.status === 'denied' || summary.status === 'skipped') {
    return 'issues'
  }

  if (summary.kind === 'tool' || summary.toolName) {
    return 'tools'
  }

  return 'all'
}

function matchesActivityFilter(meta: SessionRowMeta, filter: WorkListFilter) {
  if (filter === 'all') {
    return true
  }

  if (filter === 'approvals') {
    return meta.session.status === 'approval_pending' || meta.approvalSummary.pending > 0
  }

  if (filter === 'tools') {
    return meta.sessionLogs.some((log) => log.kind === 'tool' || Boolean(log.toolName))
  }

  if (filter === 'attachments') {
    return meta.recentAttachments.length > 0 || meta.sessionLogs.some((log) => log.kind === 'attachment')
  }

  return (
    meta.session.status === 'failed'
    || meta.approvalSummary.denied > 0
    || meta.sessionLogs.some((log) => (
      log.status === 'failed'
      || log.status === 'denied'
      || log.status === 'skipped'
    ))
  )
}

function SessionRow({
  session,
  active,
  approvalSummary,
  latestLogSummary,
  latestAttachmentSummary,
  latestArtifactSummary,
  previewSummary,
  recentAttachments = [],
  sessionLogs = [],
  onClick,
  actions = [],
}: {
  session: ShellSession
  active: boolean
  approvalSummary: SessionApprovalSummary
  latestLogSummary?: SessionLogSummary | null
  latestAttachmentSummary?: SessionAttachmentSummary | null
  latestArtifactSummary?: SessionArtifactSummary | null
  previewSummary?: SessionPreviewSummary | null
  recentAttachments?: ShellAttachment[]
  sessionLogs?: ShellLog[]
  onClick?: () => void
  actions?: SessionRowAction[]
}) {
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [summaryCopied, setSummaryCopied] = useState(false)
  const status = STATUS_CONFIG[session.status]
  const StatusIcon = status.icon
  const isRunning = session.status === 'running'
  const archived = Boolean(session.archivedAt)
  const hasRecentAttachments = recentAttachments.length > 0
  const attachmentPanelId = `session-attachments-${session.id}`
  const detailPanelId = `session-detail-${session.id}`
  const approvalBadges = [
    approvalSummary.pending > 0
      ? { label: `승인 ${approvalSummary.pending}`, color: 'var(--warning)', background: 'var(--warning-soft)' }
      : null,
    approvalSummary.denied > 0
      ? { label: `거부 ${approvalSummary.denied}`, color: 'var(--danger)', background: 'var(--danger-soft)' }
      : null,
    approvalSummary.approved > 0
      ? { label: `승인됨 ${approvalSummary.approved}`, color: 'var(--success)', background: 'var(--success-soft)' }
      : null,
  ].filter((badge): badge is { label: string; color: string; background: string } => Boolean(badge))
  const latestAttachmentDeliveryLog = latestAttachmentSummary
    ? findLatestAttachmentDeliveryLog(sessionLogs, session.id, latestAttachmentSummary.name)
    : null
  const latestAttachmentLogBadge = latestLogSummary?.attachmentDeliveryMode
    ? getAttachmentDeliveryModePresentation(latestLogSummary.attachmentDeliveryMode, latestLogSummary.modelId)
    : null
  const latestLogBadges = [
    latestLogSummary?.kind ? LOG_KIND_CONFIG[latestLogSummary.kind] : null,
    latestLogSummary?.status ? LOG_STATUS_CONFIG[latestLogSummary.status] : null,
    latestLogSummary?.capability
      ? { label: latestLogSummary.capability, color: 'var(--text-secondary)', background: 'var(--bg-hover)' }
      : null,
    latestLogSummary?.toolName
      ? { label: latestLogSummary.toolName, color: 'var(--accent)', background: 'var(--accent-soft)' }
      : null,
    latestLogSummary?.attachmentName
      ? { label: latestLogSummary.attachmentName, color: 'var(--text-secondary)', background: 'var(--bg-hover)' }
      : null,
    latestAttachmentLogBadge,
    latestLogSummary?.modelId
      ? { label: latestLogSummary.modelId, color: 'var(--accent)', background: 'var(--accent-soft)' }
      : null,
  ].filter((badge): badge is { label: string; color: string; background: string } => Boolean(badge))
  const attachmentBadges = latestAttachmentSummary
    ? [
      {
        label: `첨부 ${latestAttachmentSummary.count}`,
        color: 'var(--text-secondary)',
        background: 'var(--bg-hover)',
      },
      ATTACHMENT_STATUS_CONFIG[latestAttachmentSummary.status],
      ATTACHMENT_KIND_CONFIG[latestAttachmentSummary.kind],
    ]
    : []
  const recentAttachmentRouteBadges = summarizeRecentAttachmentRoutes(recentAttachments, sessionLogs, session.model)
  const recentLogs = [...sessionLogs].slice(-3).reverse()
  const attachmentSummaryText = latestAttachmentSummary
    ? latestAttachmentSummary.previewText
      ? `첨부: ${latestAttachmentSummary.name} · ${latestAttachmentSummary.previewText}`
      : `첨부: ${latestAttachmentSummary.name}`
    : null
  const previewStatus = previewSummary
    ? PREVIEW_STATUS_CONFIG[previewSummary.status]
    : null
  const artifactKind = latestArtifactSummary
    ? ARTIFACT_KIND_CONFIG[latestArtifactSummary.kind]
    : null
  const sessionSummaryText = buildSessionDetailSummary({
    session,
    approvalSummary,
    latestLogSummary,
    latestAttachmentSummary,
    latestArtifactSummary,
    previewSummary,
    recentAttachmentRouteBadges,
    recentLogs,
  })

  const handleCopySummary = async () => {
    if (!navigator.clipboard?.writeText) {
      return
    }

    await navigator.clipboard.writeText(sessionSummaryText)
    setSummaryCopied(true)
  }

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          width: '100%',
        }}
      >
        <button
          data-shell-session-row={session.id}
          onClick={onClick}
          disabled={!onClick}
          aria-current={active ? 'true' : undefined}
          className="focus-ring"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            padding: 'var(--sp-2) var(--sp-3)',
            background: active ? 'var(--bg-active)' : 'transparent',
            border: 'none',
            borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: onClick ? 'pointer' : 'default',
            textAlign: 'left',
            opacity: archived ? 0.72 : 1,
            transition: 'background var(--dur-micro), opacity var(--dur-micro)',
          }}
          onMouseEnter={(e) => {
            if (!active && onClick) e.currentTarget.style.background = 'var(--bg-hover)'
          }}
          onMouseLeave={(e) => {
            if (!active) e.currentTarget.style.background = active ? 'var(--bg-active)' : 'transparent'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minWidth: 0 }}>
            <StatusIcon
              size={12}
              style={{
                color: status.color,
                flexShrink: 0,
                ...(isRunning ? { animation: 'spin 1.5s linear infinite' } : {}),
              }}
            />
            <span
              className="truncate"
              style={{
                flex: 1,
                fontSize: 'var(--fs-sm)',
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {session.title}
            </span>
          </div>

          {latestLogSummary && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-2)',
                paddingLeft: 20,
                minWidth: 0,
              }}
            >
              <span
                className="truncate"
                style={{
                  flex: 1,
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-secondary)',
                }}
              >
                {latestLogSummary.message}
              </span>
            </div>
          )}

          {attachmentSummaryText && (
            <div
              data-shell-session-attachment={session.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-2)',
                paddingLeft: 20,
                minWidth: 0,
              }}
            >
              <span
                className="truncate"
                style={{
                  flex: 1,
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-secondary)',
                }}
              >
                {attachmentSummaryText}
              </span>
              {latestAttachmentSummary && (
                <AttachmentDeliveryBadge
                  attachment={latestAttachmentSummary.attachment}
                  modelId={session.model}
                  context="worklist"
                  log={latestAttachmentDeliveryLog}
                />
              )}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
              paddingLeft: 20,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              {archived ? `보관됨 ${session.archivedAt}` : session.updatedAt}
            </span>
            {latestLogSummary && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                로그 {latestLogSummary.ts}
              </span>
            )}
            {session.branchedFromMessageId && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                · 메시지 분기
              </span>
            )}
            {!session.branchedFromMessageId && session.branchedFromSessionId && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                · 세션 분기
              </span>
            )}
            {session.artifactCount > 0 && (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                · 아티팩트 {session.artifactCount}개
              </span>
            )}
            {latestLogBadges.map((badge) => (
              <span
                key={`${badge.label}-${latestLogSummary?.ts ?? 'log'}`}
                style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  color: badge.color,
                  background: badge.background,
                  borderRadius: '999px',
                  padding: '1px 8px',
                }}
              >
                {badge.label}
              </span>
            ))}
            {approvalBadges.map((badge) => (
              <span
                key={badge.label}
                style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  color: badge.color,
                  background: badge.background,
                  borderRadius: '999px',
                  padding: '1px 8px',
                }}
              >
                {badge.label}
              </span>
            ))}
            {attachmentBadges.map((badge) => (
              <span
                key={`${badge.label}-${session.id}`}
                style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  color: badge.color,
                  background: badge.background,
                  borderRadius: '999px',
                  padding: '1px 8px',
                }}
              >
                {badge.label}
              </span>
            ))}
            {recentAttachmentRouteBadges.map((badge) => (
              <span
                key={`${badge.mode}-${badge.label}-${session.id}`}
                data-shell-session-attachment-route-row={session.id}
                data-shell-session-attachment-route-mode={badge.mode}
                style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  color: badge.color,
                  background: badge.background,
                  borderRadius: '999px',
                  padding: '1px 8px',
                }}
              >
                {badge.label} {badge.count}
              </span>
            ))}
          </div>
        </button>

        {hasRecentAttachments && (
          <button
            type="button"
            data-shell-session-attachment-toggle={session.id}
            aria-label={attachmentsOpen ? `${session.title} 최근 첨부 접기` : `${session.title} 최근 첨부 보기`}
            aria-expanded={attachmentsOpen}
            aria-controls={attachmentPanelId}
            className="focus-ring"
            onClick={() => setAttachmentsOpen((open) => !open)}
            style={{
              width: 28,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: attachmentsOpen ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {attachmentsOpen ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
          </button>
        )}

        <button
          type="button"
          data-shell-session-detail-toggle={session.id}
          aria-label={detailsOpen ? `${session.title} 세션 개요 접기` : `${session.title} 세션 개요 보기`}
          aria-expanded={detailsOpen}
          aria-controls={detailPanelId}
          className="focus-ring"
          onClick={() => setDetailsOpen((open) => !open)}
          style={{
            width: 28,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: detailsOpen ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <Info size={14} strokeWidth={1.5} />
        </button>

        {actions.map(({ icon: ActionIcon, label, onClick: onAction }) => (
          <button
            key={label}
            onClick={onAction}
            aria-label={label}
            title={label}
            className="focus-ring"
            style={{
              width: 28,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <ActionIcon size={14} strokeWidth={1.5} />
          </button>
        ))}
      </div>

      {detailsOpen && (
        <div
          id={detailPanelId}
          data-shell-session-detail-panel={session.id}
          style={{
            padding: '0 var(--sp-3) var(--sp-3) 23px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-2)',
            background: active ? 'color-mix(in srgb, var(--bg-active) 72%, transparent)' : 'transparent',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--sp-2)',
              flexWrap: 'wrap',
              paddingTop: 'var(--sp-2)',
            }}
          >
            <span
              style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              세션 개요
            </span>
            <button
              type="button"
              data-shell-session-detail-copy={session.id}
              aria-label={`${session.title} 세션 요약 복사`}
              className="focus-ring"
              onClick={() => { void handleCopySummary() }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--sp-1)',
                padding: '4px 10px',
                borderRadius: '999px',
                border: '1px solid var(--border-default)',
                background: summaryCopied ? 'var(--success-soft)' : 'var(--bg-elevated)',
                color: summaryCopied ? 'var(--success)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--fs-xs)',
                fontWeight: 600,
              }}
            >
              <Copy size={12} strokeWidth={1.75} />
              <span>{summaryCopied ? '복사됨' : '요약 복사'}</span>
            </button>
            <button
              type="button"
              data-shell-session-detail-export={session.id}
              aria-label={`${session.title} 세션 요약 내보내기`}
              className="focus-ring"
              onClick={() => {
                downloadSessionDetailSummary(session.title, sessionSummaryText)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--sp-1)',
                padding: '4px 10px',
                borderRadius: '999px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--fs-xs)',
                fontWeight: 600,
              }}
            >
              <Download size={12} strokeWidth={1.75} />
              <span>내보내기</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <DetailMetric label="상태" value={status.label} />
            <DetailMetric label="모델" value={session.model} />
            <DetailMetric label="메시지" value={`${session.messageCount}`} />
            <DetailMetric label="아티팩트" value={`${session.artifactCount}`} />
            <DetailMetric label="첨부" value={`${latestAttachmentSummary?.count ?? 0}`} />
            <DetailMetric label="로그" value={`${sessionLogs.length}`} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            <DetailBadge label={`승인 대기 ${approvalSummary.pending}`} color="var(--warning)" background="var(--warning-soft)" />
            <DetailBadge label={`승인됨 ${approvalSummary.approved}`} color="var(--success)" background="var(--success-soft)" />
            <DetailBadge label={`거부 ${approvalSummary.denied}`} color="var(--danger)" background="var(--danger-soft)" />
            {archived && <DetailBadge label={`보관됨 ${session.archivedAt}`} color="var(--text-secondary)" background="var(--bg-hover)" />}
            {session.branchedFromMessageId && <DetailBadge label="메시지 분기" color="var(--accent)" background="var(--accent-soft)" />}
            {!session.branchedFromMessageId && session.branchedFromSessionId && (
              <DetailBadge label="세션 분기" color="var(--accent)" background="var(--accent-soft)" />
            )}
          </div>

          {(latestArtifactSummary || previewSummary) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-2)' }}>
              {latestArtifactSummary && artifactKind && (
                <div
                  data-shell-session-detail-artifact={session.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--sp-1)',
                    padding: 'var(--sp-2)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>
                      최신 아티팩트
                    </span>
                    <DetailBadge
                      label={artifactKind.label}
                      color={artifactKind.color}
                      background={artifactKind.background}
                    />
                    <DetailBadge
                      label={`v${latestArtifactSummary.version}`}
                      color="var(--text-secondary)"
                      background="var(--bg-hover)"
                    />
                  </div>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {latestArtifactSummary.title}
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--sp-2)',
                      flexWrap: 'wrap',
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>{latestArtifactSummary.size}</span>
                    <span>{latestArtifactSummary.createdAt}</span>
                  </div>
                  {latestArtifactSummary.previewText && (
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                      {latestArtifactSummary.previewText}
                    </span>
                  )}
                </div>
              )}

              {previewSummary && previewStatus && (
                <div
                  data-shell-session-detail-preview={session.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--sp-1)',
                    padding: 'var(--sp-2)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>
                      프리뷰 상태
                    </span>
                    <DetailBadge
                      label={previewStatus.label}
                      color={previewStatus.color}
                      background={previewStatus.background}
                    />
                    <DetailBadge
                      label={`v${previewSummary.version}`}
                      color="var(--text-secondary)"
                      background="var(--bg-hover)"
                    />
                  </div>
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {previewSummary.title}
                  </span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>
              첨부 경로
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
              {recentAttachmentRouteBadges.length > 0 ? recentAttachmentRouteBadges.map((badge) => (
                <span
                  key={`${badge.mode}-detail-${session.id}`}
                  data-shell-session-detail-route={session.id}
                  data-shell-session-detail-route-mode={badge.mode}
                  style={{
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 600,
                    color: badge.color,
                    background: badge.background,
                    borderRadius: '999px',
                    padding: '1px 8px',
                  }}
                >
                  {badge.label} {badge.count}
                </span>
              )) : (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>최근 첨부 경로가 없습니다</span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-muted)' }}>
              최근 로그
            </span>
            {recentLogs.length > 0 ? recentLogs.map((log) => (
              <div
                key={log.id}
                data-shell-session-detail-log={log.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  padding: 'var(--sp-2)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {log.ts}
                  </span>
                  {log.kind && (
                    <DetailBadge
                      label={LOG_KIND_CONFIG[log.kind].label}
                      color={LOG_KIND_CONFIG[log.kind].color}
                      background={LOG_KIND_CONFIG[log.kind].background}
                    />
                  )}
                  {log.status && (
                    <DetailBadge
                      label={LOG_STATUS_CONFIG[log.status].label}
                      color={LOG_STATUS_CONFIG[log.status].color}
                      background={LOG_STATUS_CONFIG[log.status].background}
                    />
                  )}
                </div>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                  {log.message}
                </span>
              </div>
            )) : (
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>최근 로그가 없습니다</span>
            )}
          </div>
        </div>
      )}

      {hasRecentAttachments && attachmentsOpen && (
        <div
          id={attachmentPanelId}
          data-shell-session-attachment-panel={session.id}
          style={{
            padding: '0 var(--sp-3) var(--sp-3) 23px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-2)',
            background: active ? 'color-mix(in srgb, var(--bg-active) 72%, transparent)' : 'transparent',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
              flexWrap: 'wrap',
              color: 'var(--text-muted)',
              fontSize: 'var(--fs-xs)',
              fontWeight: 600,
            }}
          >
            <Paperclip size={12} />
            <span>최근 첨부 {recentAttachments.length}개</span>
            {recentAttachmentRouteBadges.map((badge) => (
              <span
                key={`${badge.mode}-${badge.label}-panel-${session.id}`}
                data-shell-session-attachment-route-panel={session.id}
                data-shell-session-attachment-route-mode={badge.mode}
                style={{
                  fontSize: 'var(--fs-xs)',
                  fontWeight: 600,
                  color: badge.color,
                  background: badge.background,
                  borderRadius: '999px',
                  padding: '1px 8px',
                }}
              >
                {badge.label} {badge.count}
              </span>
            ))}
          </div>

          {recentAttachments.map((attachment) => {
            const showImagePreview = Boolean(attachment.dataUrl)
              && (attachment.kind === 'image' || attachment.kind === 'screenshot')
            const attachmentDeliveryLog = findLatestAttachmentDeliveryLog(
              sessionLogs,
              session.id,
              attachment.name,
            )

            return (
              <div
                key={attachment.id}
                data-shell-session-attachment-item={attachment.id}
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)',
                  padding: 'var(--sp-2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--sp-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minWidth: 0 }}>
                  <span
                    className="truncate"
                    style={{
                      flex: 1,
                      fontSize: 'var(--fs-sm)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {attachment.name}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 600,
                      color: ATTACHMENT_KIND_CONFIG[attachment.kind].color,
                      background: ATTACHMENT_KIND_CONFIG[attachment.kind].background,
                      borderRadius: '999px',
                      padding: '1px 8px',
                    }}
                  >
                    {ATTACHMENT_KIND_CONFIG[attachment.kind].label}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--fs-xs)',
                      fontWeight: 600,
                      color: ATTACHMENT_STATUS_CONFIG[attachment.status].color,
                      background: ATTACHMENT_STATUS_CONFIG[attachment.status].background,
                      borderRadius: '999px',
                      padding: '1px 8px',
                    }}
                  >
                    {ATTACHMENT_STATUS_CONFIG[attachment.status].label}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--sp-2)',
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>{attachment.mimeType}</span>
                  <span>{attachment.sizeLabel}</span>
                  <span>{attachment.createdAt}</span>
                </div>

                <div>
                  <AttachmentDeliveryBadge
                    attachment={attachment}
                    modelId={session.model}
                    context="worklist"
                    log={attachmentDeliveryLog}
                  />
                </div>

                {showImagePreview && (
                  <img
                    src={attachment.dataUrl}
                    alt={`${attachment.name} preview`}
                    style={{
                      width: '100%',
                      maxHeight: 120,
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-base)',
                    }}
                  />
                )}

                <AttachmentTextDisclosure
                  attachmentName={attachment.name}
                  textContent={attachment.textContent}
                  previewChars={96}
                  scope="worklist"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
