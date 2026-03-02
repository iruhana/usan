import { useState, useEffect, lazy, Suspense } from 'react'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import { SkipLink, AnnouncerProvider } from '../accessibility'
import NotificationToast from '../NotificationToast'
import SafetyConfirmationModal from '../modal/SafetyConfirmationModal'
import StatusBar from './StatusBar'
import HomePage from '../../pages/HomePage'

const ToolsPage = lazy(() => import('../../pages/ToolsPage'))
const NotesPage = lazy(() => import('../../pages/NotesPage'))
const FilesPage = lazy(() => import('../../pages/FilesPage'))
const SettingsPage = lazy(() => import('../../pages/SettingsPage'))

type Page = 'home' | 'tools' | 'notes' | 'files' | 'settings'

export default function AppLayout() {
  const [activePage, setActivePage] = useState<Page>('home')
  const [commandOpen, setCommandOpen] = useState(false)

  // Global keyboard shortcuts: Ctrl+K (command palette), Ctrl+1-5 (page navigation)
  useEffect(() => {
    const pages: Page[] = ['home', 'tools', 'notes', 'files', 'settings']
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen((o) => !o)
      }
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
        e.preventDefault()
        setActivePage(pages[parseInt(e.key) - 1])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <AnnouncerProvider>
      <div className="flex flex-col h-screen">
        <SkipLink />
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activePage={activePage} onNavigate={setActivePage} />
          <main id="main-content" className="flex-1 overflow-hidden bg-[var(--color-bg)]">
            <div className="h-full" style={{ display: activePage === 'home' ? 'flex' : 'none' }}><HomePage /></div>
            <Suspense fallback={null}>
              <div className="h-full overflow-auto" style={{ display: activePage === 'tools' ? 'block' : 'none' }}><ToolsPage /></div>
              <div className="h-full overflow-auto" style={{ display: activePage === 'notes' ? 'block' : 'none' }}><NotesPage /></div>
              <div className="h-full overflow-auto" style={{ display: activePage === 'files' ? 'block' : 'none' }}><FilesPage /></div>
              <div className="h-full overflow-auto" style={{ display: activePage === 'settings' ? 'block' : 'none' }}><SettingsPage /></div>
            </Suspense>
          </main>
        </div>
        <StatusBar />
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onNavigate={setActivePage}
        />
        <NotificationToast />
        <SafetyConfirmationModal />
      </div>
    </AnnouncerProvider>
  )
}
