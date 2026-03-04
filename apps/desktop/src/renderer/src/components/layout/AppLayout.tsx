import { useCallback, useEffect, lazy, Suspense, useState } from 'react'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import { SkipLink, AnnouncerProvider } from '../accessibility'
import NotificationToast from '../NotificationToast'
import UndoToast from '../UndoToast'
import SafetyConfirmationModal from '../modal/SafetyConfirmationModal'
import StatusBar from './StatusBar'
import VoiceOverlay from '../voice/VoiceOverlay'
import HomePage from '../../pages/HomePage'
import { useChatStore } from '../../stores/chat.store'
import { useNotesStore } from '../../stores/notes.store'

const ToolsPage = lazy(() => import('../../pages/ToolsPage'))
const NotesPage = lazy(() => import('../../pages/NotesPage'))
const FilesPage = lazy(() => import('../../pages/FilesPage'))
const SettingsPage = lazy(() => import('../../pages/SettingsPage'))
const AccountPage = lazy(() => import('../../pages/AccountPage'))
const WorkflowsPage = lazy(() => import('../../pages/WorkflowsPage'))
const KnowledgePage = lazy(() => import('../../pages/KnowledgePage'))
const DashboardPage = lazy(() => import('../../pages/DashboardPage'))
const MarketplacePage = lazy(() => import('../../pages/MarketplacePage'))

type Page = 'home' | 'tools' | 'notes' | 'files' | 'settings' | 'account' | 'workflows' | 'knowledge' | 'dashboard' | 'marketplace'

export default function AppLayout() {
  const [activePage, setActivePage] = useState<Page>('home')
  const [commandOpen, setCommandOpen] = useState(false)
  const [animKey, setAnimKey] = useState(0)

  const navigate = useCallback((page: Page) => {
    setActivePage((current) => {
      if (current === page) return current
      setAnimKey((key) => key + 1)
      return page
    })
  }, [])

  // Global keyboard shortcuts: Ctrl+K (command palette), Ctrl+1-0 (page navigation)
  useEffect(() => {
    const pageByKey: Record<string, Page> = {
      '1': 'home',
      '2': 'tools',
      '3': 'notes',
      '4': 'files',
      '5': 'settings',
      '6': 'account',
      '7': 'workflows',
      '8': 'knowledge',
      '9': 'dashboard',
      '0': 'marketplace',
    }

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen((o) => !o)
      }
      if ((e.ctrlKey || e.metaKey) && pageByKey[e.key]) {
        e.preventDefault()
        navigate(pageByKey[e.key])
      }
      // Ctrl+N: new conversation
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        navigate('home')
        useChatStore.getState().newConversation()
      }
      // Ctrl+Shift+N: new note
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        navigate('notes')
        useNotesStore.getState().create()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  return (
    <AnnouncerProvider>
      <div className="flex flex-col h-screen">
        <SkipLink />
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activePage={activePage} onNavigate={navigate} />
          <main id="main-content" className="flex-1 overflow-hidden bg-[var(--color-bg)]">
            <div className="h-full" style={{ display: activePage === 'home' ? 'flex' : 'none' }}><HomePage /></div>
            <Suspense fallback={null}>
              {activePage !== 'home' && (
                <div key={animKey} className="h-full overflow-auto animate-in">
                  {activePage === 'tools' && <ToolsPage />}
                  {activePage === 'notes' && <NotesPage />}
                  {activePage === 'files' && <FilesPage />}
                  {activePage === 'settings' && <SettingsPage />}
                  {activePage === 'account' && <AccountPage />}
                  {activePage === 'workflows' && <WorkflowsPage />}
                  {activePage === 'knowledge' && <KnowledgePage />}
                  {activePage === 'dashboard' && <DashboardPage />}
                  {activePage === 'marketplace' && <MarketplacePage />}
                </div>
              )}
            </Suspense>
          </main>
        </div>
        <StatusBar />
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onNavigate={navigate}
        />
        <NotificationToast />
        <UndoToast />
        <VoiceOverlay />
        <SafetyConfirmationModal />
      </div>
    </AnnouncerProvider>
  )
}
