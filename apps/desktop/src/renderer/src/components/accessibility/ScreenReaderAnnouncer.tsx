/**
 * ARIA live region — announces dynamic content changes to screen readers.
 * Usage: call announce('메시지') to speak to the screen reader.
 */
import { useState, useCallback, createContext, useContext } from 'react'
import type { ReactNode } from 'react'

interface AnnouncerCtx {
  announce: (message: string, priority?: 'polite' | 'assertive') => void
}

const AnnouncerContext = createContext<AnnouncerCtx>({ announce: () => {} })

// eslint-disable-next-line react-refresh/only-export-components
export function useAnnouncer() {
  return useContext(AnnouncerContext)
}

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [politeMsg, setPoliteMsg] = useState('')
  const [assertiveMsg, setAssertiveMsg] = useState('')

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMsg('')
      // Force re-render so screen reader picks up change
      requestAnimationFrame(() => setAssertiveMsg(message))
    } else {
      setPoliteMsg('')
      requestAnimationFrame(() => setPoliteMsg(message))
    }
  }, [])

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
      >
        {politeMsg}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
      >
        {assertiveMsg}
      </div>
    </AnnouncerContext.Provider>
  )
}
