/**
 * Z6 Utility Panel
 * Run steps, logs, terminal, and approvals.
 */
import type { ShellApproval, ShellLog, ShellRunStep } from '@shared/types'
import {
  X,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Clock,
  XCircle,
  Paperclip,
  Terminal as TerminalIcon,
} from 'lucide-react'
import { useShellStore } from '../../stores/shell.store'
import { useUiStore, type LogFeedFilter, type UtilityTab } from '../../stores/ui.store'
import { getAttachmentDeliveryModePresentation } from '../../utils/attachmentDelivery'

const TABS: { id: UtilityTab; label: string }[] = [
  { id: 'steps', label: '실행 단계' },
  { id: 'logs', label: '로그' },
  { id: 'terminal', label: '터미널' },
  { id: 'approvals', label: '승인' },
]

const STEP_STATUS_ICON: Record<string, { icon: typeof Clock; color: string }> = {
  pending: { icon: Clock, color: 'var(--text-muted)' },
  running: { icon: Loader2, color: 'var(--accent)' },
  success: { icon: CheckCircle2, color: 'var(--success)' },
  failed: { icon: XCircle, color: 'var(--danger)' },
  skipped: { icon: Clock, color: 'var(--text-muted)' },
  approval_needed: { icon: ShieldAlert, color: 'var(--warning)' },
}

const LOG_COLORS: Record<string, string> = {
  info: 'var(--text-secondary)',
  debug: 'var(--text-muted)',
  warn: 'var(--warning)',
  error: 'var(--danger)',
}

const LOG_KIND_CONFIG = {
  attachment: { color: 'var(--warning)', bg: 'var(--warning-soft)', label: 'attachment' },
  session: { color: 'var(--accent)', bg: 'var(--accent-soft)', label: '세션' },
  tool: { color: 'var(--success)', bg: 'var(--success-soft)', label: '도구' },
  approval: { color: 'var(--warning)', bg: 'var(--warning-soft)', label: '승인' },
  system: { color: 'var(--text-secondary)', bg: 'var(--bg-hover)', label: '시스템' },
} as const

const LOG_STATUS_CONFIG = {
  pending: { color: 'var(--warning)', bg: 'var(--warning-soft)', label: '대기' },
  running: { color: 'var(--accent)', bg: 'var(--accent-soft)', label: '실행 중' },
  success: { color: 'var(--success)', bg: 'var(--success-soft)', label: '완료' },
  failed: { color: 'var(--danger)', bg: 'var(--danger-soft)', label: '실패' },
  skipped: { color: 'var(--text-muted)', bg: 'var(--bg-hover)', label: '건너뜀' },
  approved: { color: 'var(--success)', bg: 'var(--success-soft)', label: '승인됨' },
  denied: { color: 'var(--danger)', bg: 'var(--danger-soft)', label: '거부' },
} as const

const LOG_FILTER_CONFIG: Record<LogFeedFilter, { label: string; icon?: typeof Paperclip }> = {
  all: { label: '전체' },
  tools: { label: '도구' },
  attachments: { label: '첨부', icon: Paperclip },
  issues: { label: '이슈' },
}

const RISK_CONFIG = {
  low: { color: 'var(--success)', bg: 'var(--success-soft)', label: '낮음' },
  medium: { color: 'var(--warning)', bg: 'var(--warning-soft)', label: '보통' },
  high: { color: 'var(--danger)', bg: 'var(--danger-soft)', label: '높음' },
} as const

const APPROVAL_STATUS_CONFIG = {
  pending: { color: 'var(--warning)', bg: 'var(--warning-soft)', label: '대기' },
  approved: { color: 'var(--success)', bg: 'var(--success-soft)', label: '승인됨' },
  denied: { color: 'var(--danger)', bg: 'var(--danger-soft)', label: '거부됨' },
} as const

export default function UtilityPanel() {
  const {
    utilityPanelOpen,
    toggleUtilityPanel,
    utilityTab,
    setUtilityTab,
    logFeedFilter,
    setLogFeedFilter,
  } = useUiStore()
  const activeSessionId = useShellStore((state) => state.activeSessionId)
  const runSteps = useShellStore((state) => state.runSteps)
  const logs = useShellStore((state) => state.logs)
  const approvals = useShellStore((state) => state.approvals)
  const resolveApproval = useShellStore((state) => state.resolveApproval)

  const sessionRunSteps = activeSessionId
    ? runSteps.filter((step) => step.sessionId === activeSessionId)
    : []
  const sessionLogs = activeSessionId
    ? logs.filter((log) => log.sessionId === activeSessionId)
    : []
  const filteredSessionLogs = sessionLogs.filter((log) => matchesLogFeedFilter(log, logFeedFilter))
  const sessionApprovals = activeSessionId
    ? approvals.filter((approval) => approval.sessionId === activeSessionId)
    : approvals
  const pendingApprovalsCount = sessionApprovals.filter((approval) => approval.status === 'pending').length

  if (!utilityPanelOpen) {
    return null
  }

  return (
    <div
      data-shell-zone="utility-panel"
      data-shell-utility-tab={utilityTab}
      className="anim-fade-in"
      style={{
        height: 'var(--utility-panel-height)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-default)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div
        role="tablist"
        aria-label="유틸리티 패널 탭"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 var(--sp-3)',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            onClick={() => setUtilityTab(tab.id)}
            aria-selected={utilityTab === tab.id}
            className="focus-ring"
            style={{
              padding: '8px 12px',
              fontSize: 'var(--fs-sm)',
              fontWeight: utilityTab === tab.id ? 500 : 400,
              color: utilityTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: utilityTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              transition: `color var(--dur-micro)`,
            }}
          >
            {tab.label}
            {tab.id === 'approvals' && pendingApprovalsCount > 0 && (
              <span
                style={{
                  marginLeft: 'var(--sp-1)',
                  padding: '0 5px',
                  fontSize: 'var(--fs-xs)',
                  background: 'var(--warning-soft)',
                  color: 'var(--warning)',
                  borderRadius: 10,
                }}
              >
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button
          onClick={toggleUtilityPanel}
          aria-label="패널 닫기"
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
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {utilityTab === 'steps' && <RunStepsView steps={sessionRunSteps} />}
        {utilityTab === 'logs' && (
          <LogsView
            logs={filteredSessionLogs}
            allLogs={sessionLogs}
            filter={logFeedFilter}
            onFilterChange={setLogFeedFilter}
          />
        )}
        {utilityTab === 'terminal' && <TerminalView />}
        {utilityTab === 'approvals' && (
          <ApprovalsView
            approvals={sessionApprovals}
            onResolve={(approvalId, decision) => { void resolveApproval(approvalId, decision) }}
          />
        )}
      </div>
    </div>
  )
}

function RunStepsView({ steps }: { steps: ShellRunStep[] }) {
  if (steps.length === 0) {
    return <EmptyPanelState label="현재 세션의 실행 단계가 아직 없습니다" />
  }

  return (
    <div style={{ padding: 'var(--sp-2) var(--sp-3)' }}>
      {steps.map((step) => {
        const config = STEP_STATUS_ICON[step.status]
        const Icon = config.icon
        const isRunning = step.status === 'running'

        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--sp-2)',
              padding: '6px 0',
            }}
          >
            <Icon
              size={14}
              style={{
                color: config.color,
                flexShrink: 0,
                marginTop: 2,
                ...(isRunning ? { animation: 'spin 1.5s linear infinite' } : {}),
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)' }}>
                {step.label}
              </div>
              {step.detail && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 1 }}>
                  {step.detail}
                </div>
              )}
            </div>
            {step.durationMs && (
              <span
                style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                }}
              >
                {(step.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function matchesLogFeedFilter(log: ShellLog, filter: LogFeedFilter) {
  if (filter === 'all') {
    return true
  }

  if (filter === 'tools') {
    return log.kind === 'tool' || Boolean(log.toolName)
  }

  if (filter === 'attachments') {
    return log.kind === 'attachment' || Boolean(log.attachmentName) || Boolean(log.attachmentDeliveryMode)
  }

  return log.status === 'failed' || log.status === 'denied' || log.status === 'skipped'
}

function LogsView({
  logs,
  allLogs,
  filter,
  onFilterChange,
}: {
  logs: ShellLog[]
  allLogs: ShellLog[]
  filter: LogFeedFilter
  onFilterChange: (filter: LogFeedFilter) => void
}) {
  const filterCounts = {
    all: allLogs.length,
    tools: allLogs.filter((log) => matchesLogFeedFilter(log, 'tools')).length,
    attachments: allLogs.filter((log) => matchesLogFeedFilter(log, 'attachments')).length,
    issues: allLogs.filter((log) => matchesLogFeedFilter(log, 'issues')).length,
  }

  if (allLogs.length === 0) {
    return <EmptyPanelState label="현재 세션의 로그가 아직 없습니다" />
  }

  if (logs.length === 0) {
    return <EmptyPanelState label="선택한 로그 필터와 일치하는 항목이 없습니다" />
  }

  return (
    <div
      style={{
        padding: 'var(--sp-2) var(--sp-3)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-xs)',
        lineHeight: 'var(--lh-relaxed)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          flexWrap: 'wrap',
          marginBottom: 'var(--sp-2)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {(Object.keys(LOG_FILTER_CONFIG) as LogFeedFilter[]).map((filterId) => (
          <button
            key={filterId}
            type="button"
            onClick={() => onFilterChange(filterId)}
            data-shell-log-filter={filterId}
            aria-pressed={filter === filterId}
            className="focus-ring"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--sp-1)',
              padding: '3px 10px',
              borderRadius: '999px',
              border: '1px solid var(--border-default)',
              background: filter === filterId ? 'var(--bg-active)' : 'var(--bg-elevated)',
              color: filter === filterId ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--fs-xs)',
              fontWeight: 600,
            }}
          >
            {LOG_FILTER_CONFIG[filterId].icon ? <Paperclip size={11} strokeWidth={1.75} /> : null}
            <span>{LOG_FILTER_CONFIG[filterId].label}</span>
            <span style={{ color: 'var(--text-muted)' }}>{filterCounts[filterId]}</span>
          </button>
        ))}
      </div>

      {logs.map((log) => {
        const attachmentDeliveryBadge = log.attachmentDeliveryMode
          ? getAttachmentDeliveryModePresentation(log.attachmentDeliveryMode, log.modelId)
          : null

        return (
          <div key={log.id} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'flex-start', padding: '3px 0' }}>
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{log.ts}</span>
            <span
              style={{
                color: LOG_COLORS[log.level],
                padding: '0 3px',
                fontWeight: log.level === 'error' ? 500 : 400,
              }}
            >
              [{log.level.toUpperCase().padEnd(5)}]
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              {(log.kind || log.status || log.capability || log.toolName || log.attachmentName || attachmentDeliveryBadge || log.modelId) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)', flexWrap: 'wrap', marginBottom: 2 }}>
                  {log.kind && (
                    <LogBadge
                      label={LOG_KIND_CONFIG[log.kind].label}
                      color={LOG_KIND_CONFIG[log.kind].color}
                      background={LOG_KIND_CONFIG[log.kind].bg}
                    />
                  )}
                  {log.status && (
                    <LogBadge
                      label={LOG_STATUS_CONFIG[log.status].label}
                      color={LOG_STATUS_CONFIG[log.status].color}
                      background={LOG_STATUS_CONFIG[log.status].bg}
                    />
                  )}
                  {log.capability && (
                    <LogBadge
                      label={log.capability}
                      color="var(--text-secondary)"
                      background="var(--bg-elevated)"
                    />
                  )}
                  {log.toolName && (
                    <LogBadge
                      label={log.toolName}
                      color="var(--text-secondary)"
                      background="var(--bg-elevated)"
                    />
                  )}
                  {log.attachmentName && (
                    <LogBadge
                      label={log.attachmentName}
                      color="var(--text-secondary)"
                      background="var(--bg-elevated)"
                    />
                  )}
                  {attachmentDeliveryBadge && (
                    <LogBadge
                      label={attachmentDeliveryBadge.label}
                      color={attachmentDeliveryBadge.color}
                      background={attachmentDeliveryBadge.background}
                    />
                  )}
                  {log.modelId && (
                    <LogBadge
                      label={log.modelId}
                      color="var(--accent)"
                      background="var(--accent-soft)"
                    />
                  )}
                </div>
              )}
              <span style={{ color: LOG_COLORS[log.level], wordBreak: 'break-word' }}>{log.message}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LogBadge({
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

function TerminalView() {
  return (
    <div
      style={{
        height: '100%',
        padding: 'var(--sp-3)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-xs)',
        color: 'var(--text-secondary)',
        background: 'var(--bg-base)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        <TerminalIcon size={12} style={{ color: 'var(--text-muted)' }} />
        <span style={{ color: 'var(--text-muted)' }}>터미널 백엔드는 아직 연결되지 않았습니다</span>
      </div>
      <div>
        <span style={{ color: 'var(--success)' }}>$</span>
        <span style={{ color: 'var(--text-muted)' }}> _</span>
        <span
          className="anim-pulse"
          style={{
            display: 'inline-block',
            width: 7,
            height: 14,
            background: 'var(--text-muted)',
            marginLeft: 2,
            verticalAlign: 'text-bottom',
          }}
        />
      </div>
    </div>
  )
}

function ApprovalsView({
  approvals,
  onResolve,
}: {
  approvals: ShellApproval[]
  onResolve: (approvalId: string, decision: 'approved' | 'denied') => void
}) {
  if (approvals.length === 0) {
    return <EmptyPanelState label="승인 대기 중인 작업이 없습니다" />
  }

  return (
    <div style={{ padding: 'var(--sp-2) var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {approvals.map((approval) => {
        const risk = RISK_CONFIG[approval.risk]
        const status = APPROVAL_STATUS_CONFIG[approval.status]
        const isPending = approval.status === 'pending'

        return (
          <div
            key={approval.id}
            style={{
              padding: 'var(--sp-3)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)', flexWrap: 'wrap' }}>
              <ShieldAlert size={14} style={{ color: risk.color }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                {approval.action}
              </span>
              <span
                style={{
                  fontSize: 'var(--fs-xs)',
                  padding: '1px 8px',
                  borderRadius: 10,
                  background: risk.bg,
                  color: risk.color,
                  fontWeight: 500,
                }}
              >
                위험: {risk.label}
              </span>
              <span
                style={{
                  fontSize: 'var(--fs-xs)',
                  padding: '1px 8px',
                  borderRadius: 10,
                  background: status.bg,
                  color: status.color,
                  fontWeight: 500,
                }}
              >
                {status.label}
              </span>
            </div>

            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
              {approval.detail}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
              <span
                style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '999px',
                  padding: '2px 8px',
                }}
              >
                capability: {approval.capability}
              </span>
              {approval.stepId && (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                  step: {approval.stepId}
                </span>
              )}
            </div>

            {approval.fallback && (
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }}>
                거부 시 대안: {approval.fallback}
              </p>
            )}

            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button
                className="focus-ring"
                onClick={() => onResolve(approval.id, 'approved')}
                disabled={!isPending}
                style={{
                  padding: '5px 14px',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 500,
                  background: isPending ? 'var(--accent)' : 'var(--bg-surface)',
                  color: isPending ? 'var(--text-inverse)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: isPending ? 'pointer' : 'not-allowed',
                }}
              >
                승인
              </button>
              <button
                className="focus-ring"
                onClick={() => onResolve(approval.id, 'denied')}
                disabled={!isPending}
                style={{
                  padding: '5px 14px',
                  fontSize: 'var(--fs-sm)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: isPending ? 'pointer' : 'not-allowed',
                }}
              >
                거부
              </button>
              {approval.retryable && (
                <button
                  className="focus-ring"
                  disabled
                  style={{
                    padding: '5px 14px',
                    fontSize: 'var(--fs-sm)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    border: 'none',
                    cursor: 'not-allowed',
                  }}
                >
                  안전한 대안
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyPanelState({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: 'var(--sp-6)',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 'var(--fs-sm)',
      }}
    >
      {label}
    </div>
  )
}
