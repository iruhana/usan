export const FLOATING_TOOLBAR_MIN_TEXT_LENGTH = 3
const FLOATING_TOOLBAR_VIEWPORT_PADDING = 16
const FLOATING_TOOLBAR_GAP = 12

export type FloatingSelectionSource = 'document' | 'editable'
export type FloatingToolbarPlacement = 'above' | 'below'

export interface FloatingSelectionRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface FloatingSelectionSnapshot {
  text: string
  rect: FloatingSelectionRect
  source: FloatingSelectionSource
}

export interface FloatingToolbarSize {
  width: number
  height: number
}

export interface FloatingToolbarViewport {
  width: number
  height: number
}

export interface FloatingToolbarPosition {
  left: number
  top: number
  placement: FloatingToolbarPlacement
}

function normalizeSelectedText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function toSelectionRect(rect: DOMRect | DOMRectReadOnly): FloatingSelectionRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  }
}

function hasUsableSelection(text: string): boolean {
  return normalizeSelectedText(text).length >= FLOATING_TOOLBAR_MIN_TEXT_LENGTH
}

function isTextInputElement(
  element: Element | null,
): element is HTMLInputElement | HTMLTextAreaElement {
  if (!element) return false
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly
  if (!(element instanceof HTMLInputElement)) return false

  const supportedTypes = new Set([
    'text',
    'search',
    'email',
    'tel',
    'url',
    'number',
  ])

  return supportedTypes.has(element.type || 'text') && !element.disabled && !element.readOnly
}

function getEditableSelection(
  activeElement: HTMLInputElement | HTMLTextAreaElement,
): FloatingSelectionSnapshot | null {
  const start = activeElement.selectionStart ?? 0
  const end = activeElement.selectionEnd ?? 0
  if (start === end) return null

  const text = normalizeSelectedText(activeElement.value.slice(start, end))
  if (!hasUsableSelection(text)) return null

  const rect = activeElement.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const anchorTop = rect.top
  const anchorBottom = rect.top + Math.min(rect.height, 28)

  return {
    text,
    rect: {
      left: centerX,
      right: centerX,
      width: 0,
      top: anchorTop,
      bottom: anchorBottom,
      height: Math.max(0, anchorBottom - anchorTop),
    },
    source: 'editable',
  }
}

function getDocumentSelection(doc: Document): FloatingSelectionSnapshot | null {
  const selection = doc.defaultView?.getSelection() ?? null
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null

  const text = normalizeSelectedText(selection.toString())
  if (!hasUsableSelection(text)) return null

  const range = selection.getRangeAt(0).cloneRange()
  let rect = range.getBoundingClientRect()

  if (rect.width === 0 && rect.height === 0) {
    const container =
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement

    if (!container) return null
    rect = container.getBoundingClientRect()
  }

  const activeElement = doc.activeElement

  return {
    text,
    rect: toSelectionRect(rect),
    source:
      activeElement instanceof HTMLElement && activeElement.isContentEditable
        ? 'editable'
        : 'document',
  }
}

export function resolveFloatingSelection(doc: Document = document): FloatingSelectionSnapshot | null {
  const activeElement = doc.activeElement

  if (isTextInputElement(activeElement)) {
    const editableSelection = getEditableSelection(activeElement)
    if (editableSelection) return editableSelection
  }

  return getDocumentSelection(doc)
}

export function getFloatingToolbarPosition(
  rect: FloatingSelectionRect,
  size: FloatingToolbarSize,
  viewport: FloatingToolbarViewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): FloatingToolbarPosition {
  const maxLeft = Math.max(
    FLOATING_TOOLBAR_VIEWPORT_PADDING,
    viewport.width - size.width - FLOATING_TOOLBAR_VIEWPORT_PADDING,
  )
  const centeredLeft = rect.left + rect.width / 2 - size.width / 2
  const left = Math.min(Math.max(centeredLeft, FLOATING_TOOLBAR_VIEWPORT_PADDING), maxLeft)

  const preferredTop = rect.top - size.height - FLOATING_TOOLBAR_GAP
  const fallbackTop = rect.bottom + FLOATING_TOOLBAR_GAP
  const placement: FloatingToolbarPlacement =
    preferredTop >= FLOATING_TOOLBAR_VIEWPORT_PADDING ? 'above' : 'below'
  const unclampedTop = placement === 'above' ? preferredTop : fallbackTop
  const maxTop = Math.max(
    FLOATING_TOOLBAR_VIEWPORT_PADDING,
    viewport.height - size.height - FLOATING_TOOLBAR_VIEWPORT_PADDING,
  )
  const top = Math.min(Math.max(unclampedTop, FLOATING_TOOLBAR_VIEWPORT_PADDING), maxTop)

  return {
    left,
    top,
    placement,
  }
}
