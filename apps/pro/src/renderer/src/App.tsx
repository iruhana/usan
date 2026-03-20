/**
 * Root App shell — assembles all 8 canonical zones.
 *
 * Z1: TitleBar        — top
 * Z2: NavRail         — left edge
 * Z3: WorkList        — left of workspace (when nav expanded)
 * Z4: Workspace       — center dominant surface
 * Z5: ContextPanel    — right (optional)
 * Z6: UtilityPanel    — bottom (optional)
 * Z7: Composer        — bottom of Z4 (inside Workspace)
 * Z8: Overlays        — command palette, onboarding
 */
import { useEffect, useRef } from 'react'
import TitleBar from './components/shell/TitleBar'
import NavRail from './components/shell/NavRail'
import WorkList from './components/shell/WorkList'
import Workspace from './components/shell/Workspace'
import ContextPanel from './components/panels/ContextPanel'
import UtilityPanel from './components/panels/UtilityPanel'
import CommandPalette from './components/overlays/CommandPalette'
import Onboarding from './components/overlays/Onboarding'
import SettingsView from './components/settings/SettingsView'
import { useUiStore } from './stores/ui.store'
import { useSettingsStore } from './stores/settings.store'
import { useShellStore } from './stores/shell.store'

export default function App() {
  const { view, utilityPanelOpen, utilityTab } = useUiStore()
  const pendingApprovalSignature = useShellStore((state) => {
    if (!state.activeSessionId) {
      return null
    }

    const pendingApprovalIds = state.approvals
      .filter((approval) => approval.sessionId === state.activeSessionId && approval.status === 'pending')
      .map((approval) => approval.id)
      .sort()

    if (pendingApprovalIds.length === 0) {
      return null
    }

    return `${state.activeSessionId}:${pendingApprovalIds.join(',')}`
  })
  const surfacedApprovalSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    void useShellStore.getState().hydrate()
    void useSettingsStore.getState().hydrate()
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const jumpToWorkListFilter = (filter: 'all' | 'approvals' | 'tools' | 'attachments' | 'issues') => {
      const ui = useUiStore.getState()
      ui.setView('chat')
      ui.setWorkListFilter(filter)

      if (filter === 'approvals') {
        ui.setLogFeedFilter('all')
        ui.setUtilityTab('approvals')
        return
      }

      if (filter === 'tools' || filter === 'attachments' || filter === 'issues') {
        ui.setLogFeedFilter(filter)
        ui.setUtilityTab('logs')
        return
      }

      ui.setLogFeedFilter('all')
    }

    const handler = (e: KeyboardEvent) => {
      // Ctrl+. → toggle context panel
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault()
        useUiStore.getState().toggleContextPanel()
      }
      // Ctrl+` → toggle utility panel
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        useUiStore.getState().toggleUtilityPanel()
      }
      // Ctrl+N → new session
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        useUiStore.getState().setView('chat')
        void useShellStore.getState().createSession({
          model: useSettingsStore.getState().settings.defaultModel,
        })
      }
      // Ctrl+, → settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        const s = useUiStore.getState()
        s.setView(s.view === 'settings' ? 'chat' : 'settings')
      }
      // Use physical key codes here because shifted digits report symbols in `key`.
      // Ctrl+Shift+0 → reset work list filter
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Digit0') {
        e.preventDefault()
        jumpToWorkListFilter('all')
      }
      // Ctrl+Shift+A → approval queue
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault()
        jumpToWorkListFilter('approvals')
      }
      // Ctrl+Shift+L → tool/log sessions
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyL') {
        e.preventDefault()
        jumpToWorkListFilter('tools')
      }
      // Ctrl+Shift+F → attachment sessions
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyF') {
        e.preventDefault()
        jumpToWorkListFilter('attachments')
      }
      // Ctrl+Shift+E → issue/error sessions
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault()
        jumpToWorkListFilter('issues')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!pendingApprovalSignature) {
      surfacedApprovalSignatureRef.current = null
      return
    }

    if (view !== 'chat') {
      return
    }

    if (surfacedApprovalSignatureRef.current === pendingApprovalSignature) {
      return
    }

    surfacedApprovalSignatureRef.current = pendingApprovalSignature
    if (!utilityPanelOpen || utilityTab !== 'approvals') {
      useUiStore.getState().setUtilityTab('approvals')
    }
  }, [pendingApprovalSignature, utilityPanelOpen, utilityTab, view])

  return (
    <div
      data-shell-app="pro"
      data-shell-view={view}
      style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-base)',
      overflow: 'hidden',
    }}
    >
      {/* Z1: Title Bar */}
      <TitleBar />

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Z2: Primary Navigation */}
        <NavRail />

        {/* Z3: Work List / Session Surface */}
        {view === 'chat' && <WorkList />}

        {/* Center + Right + Bottom */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* Center + Right */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            {/* Z4 + Z7: Main Workspace (includes Composer) */}
            {view === 'chat' ? <Workspace /> : <SettingsView />}

            {/* Z5: Context Panel */}
            {view === 'chat' && <ContextPanel />}
          </div>

          {/* Z6: Utility Panel */}
          {view === 'chat' && <UtilityPanel />}
        </div>
      </div>

      {/* Z8: Global Overlays */}
      <CommandPalette />
      <Onboarding />
    </div>
  )
}
