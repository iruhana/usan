export const FLOATING_TOOLBAR_COMPOSER_DRAFT_EVENT = 'usan:floating-toolbar:composer-draft'

export interface FloatingToolbarComposerDraft {
  text: string
}

let pendingComposerDraft: FloatingToolbarComposerDraft | null = null

export function queueFloatingToolbarComposerDraft(draft: FloatingToolbarComposerDraft): void {
  pendingComposerDraft = draft

  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<FloatingToolbarComposerDraft>(FLOATING_TOOLBAR_COMPOSER_DRAFT_EVENT, {
      detail: draft,
    }),
  )
}

export function consumeFloatingToolbarComposerDraft(): FloatingToolbarComposerDraft | null {
  const nextDraft = pendingComposerDraft
  pendingComposerDraft = null
  return nextDraft
}
