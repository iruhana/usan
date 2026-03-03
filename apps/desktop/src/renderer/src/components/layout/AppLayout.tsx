import { useState, useEffect, lazy, Suspense, useRef } from 'react'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import { SkipLink, AnnouncerProvider } from '../accessibility'
import NotificationToast from '../NotificationToast'
import UndoToast from '../UndoToast'
import SafetyConfirmationModal from '../modal/SafetyConfirmationModal'
import StatusBar from './StatusBar'
import HomePage from '../../pages/HomePage'
import { useChatStore } from '../../stores/chat.store'
import { useNotesStore } from '../../stores/notes.store'

const ToolsPage = lazy(() => import('../../pages/ToolsPage'))
const NotesPage = lazy(() => import('../../pages/NotesPage'))
const FilesPage = lazy(() => import('../../pages/FilesPage'))
const SettingsPage = lazy(() => import('../../pages/SettingsPage'))
const AccountPage = lazy(() => import('../../pages/AccountPage'))

type Page = 'home' | 'tools' | 'notes' | 'files' | 'settings' | 'account'

export default function AppLayout() {
  const [activePage, setActivePage] = useState<Page>('home')
  const [commandOpen, setCommandOpen] = useState(false)
  const animKey = useRef(0)

  const navigate = (page: Page) => {
    if (page !== activePage) {
      animKey.current += 1
      setActivePage(page)
    }
  }

  // Global keyboard shortcuts: Ctrl+K (command palette), Ctrl+1-6 (page navigation)
  useEffect(() => {
    const pages: Page[] = ['home', 'tools', 'notes', 'files', 'settings', 'account']
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen((o) => !o)
      }
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
        e.preventDefault()
        navigate(pages[parseInt(e.key) - 1])
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
  }, [activePage])

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
                <div key={animKey.current} className="h-full overflow-auto animate-in">
                  {activePage === 'tools' && <ToolsPage />}
                  {activePage === 'notes' && <NotesPage />}
                  {activePage === 'files' && <FilesPage />}
                  {activePage === 'settings' && <SettingsPage />}
                  {activePage === 'account' && <AccountPage />}
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
        <SafetyConfirmationModal />
      </div>
    </AnnouncerProvider>
  )
}
