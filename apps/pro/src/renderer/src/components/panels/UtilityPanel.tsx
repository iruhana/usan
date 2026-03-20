/**
 * Z6 — Utility Panel
 * Run steps, terminal output, logs, approvals. Bottom-docked with tabs.
 */
import type { ShellApproval, ShellLog, ShellRunStep } from '@shared/types'
import {
  X, CheckCircle2,
  Loader2, ShieldAlert, Clock, XCircle,
  Terminal as TerminalIcon,
} from 'lucide-react'
import { useShellStore } from '../../stores/shell.store'
import { useUiStore, type UtilityTab } from '../../stores/ui.store'

const TABS: { id: UtilityTab; label: string }[] = [
  { id: 'steps', label: '실행 단계' },
  { id: 'logs', label: '로그' },
  { id: 'terminal', label: '터미널' },
  { id: 'approvals', label: '승인' },
]

export default function UtilityPanel() {
  const { utilityPanelOpen, toggleUtilityPanel, utilityTab, setUtilityTab } = useUiStore()
  const activeSessionId = useShellStore((state) => state.activeSessionId)
  const runSteps = useShellStore((state) => state.runSteps)
  const logs = useShellStore((state) => state.logs)
  const approvals = useShellStore((state) => state.approvals)
  const sessionRunSteps = activeSessionId
    ? runSteps.filter((step) => step.sessionId === activeSessionId)
    : []
  const sessionLogs = activeSessionId
    ? logs.filter((log) => log.sessionId === activeSessionId)
    : []
  const sessionApprovals = activeSessionId
    ? approvals.filter((approval) => approval.sessionId === activeSessionId)
    : approvals

  if (!utilityPanelOpen) return null

  return (
    <div
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
      {/* Tab bar */}
      <div role="tablist" aria-label="유틸리티 패널 탭" style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 var(--sp-3)',
        gap: 0,
      }}>
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
            onMouseEnter={(e) => { if (utilityTab !== tab.id) e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { if (utilityTab !== tab.id) e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            {tab.label}
            {tab.id === 'approvals' && approvals.length > 0 && (
              <span style={{
                marginLeft: 'var(--sp-1)',
                padding: '0 5px',
                fontSize: 'var(--fs-xs)',
                background: 'var(--warning-soft)',
                color: 'var(--warning)',
                borderRadius: 10,
              }}>
                {approvals.length}
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
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {utilityTab === 'steps' && <RunStepsView steps={sessionRunSteps} />}
        {utilityTab === 'logs' && <LogsView logs={sessionLogs} />}
        {utilityTab === 'terminal' && <TerminalView />}
        {utilityTab === 'approvals' && <ApprovalsView approvals={sessionApprovals} />}
      </div>
    </div>
  )
}

// ─── Run Steps ───────────────────────────────────────────────────────────────

const STEP_STATUS_ICON: Record<string, { icon: typeof Clock; color: string }> = {
  pending:         { icon: Clock,          color: 'var(--text-muted)' },
  running:         { icon: Loader2,        color: 'var(--accent)' },
  success:         { icon: CheckCircle2,   color: 'var(--success)' },
  failed:          { icon: XCircle,        color: 'var(--danger)' },
  skipped:         { icon: Clock,          color: 'var(--text-muted)' },
  approval_needed: { icon: ShieldAlert,    color: 'var(--warning)' },
}

function RunStepsView({ steps }: { steps: ShellRunStep[] }) {
  if (steps.length === 0) {
    return (
      <EmptyPanelState label="이 세션의 실행 단계가 아직 없습니다" />
    )
  }

  return (
    <div style={{ padding: 'var(--sp-2) var(--sp-3)' }}>
      {steps.map((step) => {
        const config = STEP_STATUS_ICON[step.status]
        const Icon = config.icon
        const isRunning = step.status === 'running'
        return (
          <div key={step.id} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--sp-2)',
            padding: '6px 0',
          }}>
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
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                {(step.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Logs ────────────────────────────────────────────────────────────────────

const LOG_COLORS: Record<string, string> = {
  info: 'var(--text-secondary)',
  debug: 'var(--text-muted)',
  warn: 'var(--warning)',
  error: 'var(--danger)',
}

function LogsView({ logs }: { logs: ShellLog[] }) {
  if (logs.length === 0) {
    return (
      <EmptyPanelState label="이 세션의 로그가 아직 없습니다" />
    )
  }

  return (
    <div style={{
      padding: 'var(--sp-2) var(--sp-3)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-xs)',
      lineHeight: 'var(--lh-relaxed)',
    }}>
      {logs.map((log) => (
        <div key={log.id} style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{log.ts}</span>
          <span style={{
            color: LOG_COLORS[log.level],
            padding: '0 3px',
            fontWeight: log.level === 'error' ? 500 : 400,
          }}>
            [{log.level.toUpperCase().padEnd(5)}]
          </span>
          <span style={{ color: LOG_COLORS[log.level] }}>{log.message}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Terminal ────────────────────────────────────────────────────────────────

function TerminalView() {
  return (
    <div style={{
      height: '100%',
      padding: 'var(--sp-3)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-xs)',
      color: 'var(--text-secondary)',
      background: 'var(--bg-base)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        <TerminalIcon size={12} style={{ color: 'var(--text-muted)' }} />
        <span style={{ color: 'var(--text-muted)' }}>터미널 — 백엔드 연결 후 활성화됩니다</span>
      </div>
      <div>
        <span style={{ color: 'var(--success)' }}>$</span>
        <span style={{ color: 'var(--text-muted)' }}> _</span>
        <span className="anim-pulse" style={{ display: 'inline-block', width: 7, height: 14, background: 'var(--text-muted)', marginLeft: 2, verticalAlign: 'text-bottom' }} />
      </div>
    </div>
  )
}

// ─── Approvals ───────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  low:    { color: 'var(--success)', bg: 'var(--success-soft)', label: '낮음' },
  medium: { color: 'var(--warning)', bg: 'var(--warning-soft)', label: '보통' },
  high:   { color: 'var(--danger)',  bg: 'var(--danger-soft)',  label: '높음' },
}

function ApprovalsView({ approvals }: { approvals: ShellApproval[] }) {
  if (approvals.length === 0) {
    return (
      <EmptyPanelState label="승인 대기 중인 작업이 없습니다" />
    )
  }

  return (
    <div style={{ padding: 'var(--sp-2) var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {approvals.map((apv) => {
        const risk = RISK_CONFIG[apv.risk]
        return (
          <div key={apv.id} style={{
            padding: 'var(--sp-3)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
              <ShieldAlert size={14} style={{ color: risk.color }} />
              <span style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                {apv.action}
              </span>
              <span style={{
                fontSize: 'var(--fs-xs)',
                padding: '1px 8px',
                borderRadius: 10,
                background: risk.bg,
                color: risk.color,
                fontWeight: 500,
              }}>
                위험: {risk.label}
              </span>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
              {apv.detail}
            </p>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button className="focus-ring" style={{
                padding: '5px 14px',
                fontSize: 'var(--fs-sm)',
                fontWeight: 500,
                background: 'var(--accent)',
                color: 'var(--text-inverse)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}>
                승인
              </button>
              <button className="focus-ring" style={{
                padding: '5px 14px',
                fontSize: 'var(--fs-sm)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
              }}>
                거부
              </button>
              {apv.retryable && (
                <button className="focus-ring" style={{
                  padding: '5px 14px',
                  fontSize: 'var(--fs-sm)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}>
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
    <div style={{
      padding: 'var(--sp-6)',
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: 'var(--fs-sm)',
    }}>
      {label}
    </div>
  )
}
