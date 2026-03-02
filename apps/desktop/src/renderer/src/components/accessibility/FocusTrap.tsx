/**
 * Focus trap — keeps Tab focus inside a container (for modals, dialogs).
 * When the user presses Tab at the last focusable element, focus wraps to the first.
 */
import { useRef, useEffect } from 'react'
import type { ReactNode } from 'react'

interface FocusTrapProps {
  active: boolean
  children: ReactNode
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export default function FocusTrap({ active, children }: FocusTrapProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active || !ref.current) return

    const container = ref.current

    // Auto-focus first focusable element
    const initial = container.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (initial.length > 0) initial[0].focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      // Query on each Tab press so dynamically added elements are captured
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [active])

  return (
    <div ref={ref} role={active ? 'dialog' : undefined} aria-modal={active || undefined}>
      {children}
    </div>
  )
}
