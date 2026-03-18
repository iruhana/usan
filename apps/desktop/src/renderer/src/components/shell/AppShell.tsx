import {
  Suspense,
  lazy,
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
} from 'react'
import { SkipLink, AnnouncerProvider } from '../accessibility'
import { useChatStore } from '../../stores/chat.store'
import { useNotificationStore } from '../../stores/notification.store'
import { useSettingsStore } from '../../stores/settings.store'
import { useSkillStore } from '../../stores/skill.store'
import { useSafetyStore } from '../../stores/safety.store'
import { useUndoStore } from '../../stores/undo.store'
import { useVoiceStore } from '../../stores/voice.store'
import type { AppPage } from '../../constants/navigation'
import { isPageVisible, PAGE_SHORTCUTS } from '../../constants/navigation'
import type { SettingsTab } from '../../constants/settings'
import { hasE2EQueryFlag } from '../../lib/e2e-flags'
import { USAN_NAVIGATE_EVENT, type NavigateEventDetail } from '../../lib/navigation-events'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import TitleBar from './TitleBar'

const HomePage = lazy(() => import('../../pages/HomePage'))
const TasksPage = lazy(() => import('../../pages/TasksPage'))
const ToolsPage = lazy(() => import('../../pages/ToolsPage'))
const FilesPage = lazy(() => import('../../pages/FilesPage'))
const SettingsPage = lazy(() => import('../../pages/SettingsPage'))
const CommandPalette = lazy(() => import('../layout/CommandPalette'))
const MiniLauncher = lazy(() => import('../ambient/MiniLauncher'))
const NotificationToast = lazy(() => import('../NotificationToast'))
const UndoToast = lazy(() => import('../UndoToast'))
const SkillRunner = lazy(() => import('../skill/SkillRunner'))
const VoiceOverlay = lazy(() => import('../voice/VoiceOverlay'))
const SafetyConfirmationModal = lazy(() => import('../modal/SafetyConfirmationModal'))

export default function AppShell() {
  const [activePage, setActivePage] = useState<AppPage>('home')
  const [commandOpen, setCommandOpen] = useState(false)
  const [miniLauncherOpen, setMiniLauncherOpen] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  const [settingsRequest, setSettingsRequest] = useState<{ tab?: SettingsTab; nonce: number }>({
    nonce: 0,
  })
  const voiceOverlayEnabled = useSettingsStore((s) => s.settings.voiceOverlayEnabled)
  const undoVisible = useUndoStore((s) => s.visible)
  const toastCount = useNotificationStore((s) => s.toasts.length)
  const startNotificationListening = useNotificationStore((s) => s.startListening)
  const stopNotificationListening = useNotificationStore((s) => s.stopListening)
  const startVoiceListening = useVoiceStore((s) => s.startListening)
  const stopVoiceListening = useVoiceStore((s) => s.stopListening)
  const voiceStatus = useVoiceStore((s) => s.status)
  const voiceLastText = useVoiceStore((s) => s.lastText)
  const voiceHidden = useVoiceStore((s) => s.hidden)
  const currentSkillRun = useSkillStore((s) => s.currentRun)
  const safetyOpen = useSafetyStore((s) => s.open)
  const forceSkillRunner = hasE2EQueryFlag('usan_e2e_force_skill_runner')
  const forceVoiceOverlay = hasE2EQueryFlag('usan_e2e_force_voice_overlay')
  const showVoiceOverlay =
    forceVoiceOverlay ||
    (voiceOverlayEnabled && !voiceHidden && (voiceStatus.status !== 'idle' || Boolean(voiceLastText)))

  const navigate = useCallback((page: AppPage) => {
    if (!isPageVisible(page, false)) {
      startTransition(() => {
        setActivePage('home')
      })
      return
    }

    startTransition(() => {
      setActivePage((current) => {
        if (current === page) return current
        setAnimKey((key) => key + 1)
        return page
      })
    })
  }, [])

  useEffect(() => {
    startNotificationListening()
    return () => {
      stopNotificationListening()
    }
  }, [startNotificationListening, stopNotificationListening])

  useEffect(() => {
    startVoiceListening()
    return () => {
      stopVoiceListening()
    }
  }, [startVoiceListening, stopVoiceListening])

  const handleNavigateEvent = useEffectEvent((detail?: NavigateEventDetail) => {
    if (!detail) return

    if (detail.page === 'settings' && detail.settingsTab) {
      setSettingsRequest((current) => ({
        tab: detail.settingsTab,
        nonce: current.nonce + 1,
      }))
    }

    navigate(detail.page)
  })

  useEffect(() => {
    const listener = (event: Event) => {
      handleNavigateEvent((event as CustomEvent<NavigateEventDetail>).detail)
    }

    window.addEventListener(USAN_NAVIGATE_EVENT, listener as EventListener)
    return () => window.removeEventListener(USAN_NAVIGATE_EVENT, listener as EventListener)
  }, [])

  const handleGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const isModifier = event.ctrlKey || event.metaKey
    const normalizedKey = event.key.toLowerCase()
    const target = event.target
    const isEditableTarget =
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT')
    const isMiniLauncherShortcut =
      (event.ctrlKey && event.code === 'Space') || (event.altKey && !event.ctrlKey && !event.metaKey && normalizedKey === 'u')

    if (event.repeat && ((isModifier && normalizedKey === 'k') || isMiniLauncherShortcut)) {
      event.preventDefault()
      return
    }

    if (isModifier && normalizedKey === 'k') {
      event.preventDefault()
      setMiniLauncherOpen(false)
      setCommandOpen((open) => !open)
      return
    }

    if (isMiniLauncherShortcut) {
      if (isEditableTarget) {
        return
      }

      event.preventDefault()
      setCommandOpen(false)
      setMiniLauncherOpen((open) => !open)
      return
    }

    if (event.key === 'Escape' && miniLauncherOpen) {
      event.preventDefault()
      setMiniLauncherOpen(false)
      return
    }

    if (event.key === 'Escape' && commandOpen) {
      event.preventDefault()
      setCommandOpen(false)
      return
    }

    if (miniLauncherOpen || commandOpen) {
      return
    }

    const targetPage = PAGE_SHORTCUTS[event.key]
    if (isModifier && targetPage && isPageVisible(targetPage, false)) {
      event.preventDefault()
      navigate(targetPage)
      return
    }

    if (isModifier && !event.shiftKey && normalizedKey === 'n') {
      event.preventDefault()
      navigate('home')
      useChatStore.getState().newConversation()
    }
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      handleGlobalKeyDown(event)
    }

    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  return (
    <AnnouncerProvider>
      <div
        data-testid="app-shell"
        className="relative flex h-screen min-h-[600px] min-w-[480px] flex-col overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.12),_transparent_28%)] dark:bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.14),_transparent_26%)]"
        />
        <SkipLink />
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <TitleBar activePage={activePage} />
          <div className="relative flex min-h-0 flex-1 overflow-hidden px-3 pb-3 pt-2">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-3 bottom-3 top-2 rounded-[28px] border border-white/35 bg-white/40 shadow-[var(--shadow-lg)] dark:border-white/8 dark:bg-white/[0.03]"
            />
            <div className="glass relative flex min-h-0 flex-1 overflow-hidden rounded-[28px] shadow-[var(--shadow-shell)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.3),_rgba(255,255,255,0.06)_30%,_transparent_60%)] dark:bg-[linear-gradient(180deg,_rgba(255,255,255,0.06),_transparent_28%)]"
              />
              <Sidebar activePage={activePage} onNavigate={navigate} />
              <main
                id="main-content"
                className="relative min-w-0 flex-1 overflow-hidden bg-[color:var(--color-shell-bg-strong)]/70"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(96,165,250,0.12),_transparent_24%)]"
                />
                <Suspense fallback={null}>
                  <div key={animKey} className="relative h-full min-w-0 overflow-hidden animate-in">
                    {activePage === 'home' && <HomePage />}
                    {activePage === 'tasks' && <TasksPage />}
                    {activePage === 'tools' && <ToolsPage />}
                    {activePage === 'files' && <FilesPage />}
                    {activePage === 'settings' && (
                      <SettingsPage
                        requestedTab={settingsRequest.tab}
                        requestedTabNonce={settingsRequest.nonce}
                      />
                    )}
                  </div>
                </Suspense>
              </main>
            </div>
          </div>
          <StatusBar />
        </div>
        <Suspense fallback={null}>
          {toastCount > 0 && <NotificationToast />}
          {undoVisible && <UndoToast />}
          {commandOpen && (
            <CommandPalette
              open={commandOpen}
              onOpenChange={setCommandOpen}
              onNavigate={navigate}
            />
          )}
          {miniLauncherOpen && (
            <MiniLauncher
              open={miniLauncherOpen}
              onNavigate={navigate}
              onOpenChange={setMiniLauncherOpen}
            />
          )}
          {(currentSkillRun || forceSkillRunner) && <SkillRunner />}
          {showVoiceOverlay && <VoiceOverlay />}
          {safetyOpen && <SafetyConfirmationModal />}
        </Suspense>
      </div>
    </AnnouncerProvider>
  )
}
