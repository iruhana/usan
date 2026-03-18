export type AppPage =
  | 'home'
  | 'tasks'
  | 'files'
  | 'tools'
  | 'settings'

export const ALL_PAGES: AppPage[] = ['home', 'tasks', 'files', 'tools', 'settings']

export const PAGE_SHORTCUTS: Record<string, AppPage> = {
  '1': 'home',
  '2': 'tasks',
  '3': 'files',
  '4': 'tools',
  '5': 'settings',
}

/** Icons from lucide-react for each page */
export const PAGE_ICONS: Record<AppPage, string> = {
  home: 'Home',
  tasks: 'ListTodo',
  files: 'FolderOpen',
  tools: 'Wrench',
  settings: 'Settings',
}

/** Labels (i18n keys) for each page */
export const PAGE_LABELS: Record<AppPage, string> = {
  home: 'nav.home',
  tasks: 'nav.tasks',
  files: 'nav.files',
  tools: 'nav.tools',
  settings: 'nav.settings',
}

/**
 * Fallback for unknown page names (e.g., old 'workflows', 'dashboard', etc.)
 * dispatched from main process or legacy navigation events.
 */
export function resolvePageOrFallback(page: string): AppPage {
  if (ALL_PAGES.includes(page as AppPage)) return page as AppPage
  return 'home'
}

/* ─── Legacy Compat (referenced by old AppLayout, Sidebar, CommandPalette) ─── */
/* These will be removed when Codex replaces those components with shell/* */

/** @deprecated Use ALL_PAGES instead */
export const BEGINNER_PAGES: AppPage[] = ALL_PAGES

/** @deprecated No longer used — main app has no beginner/advanced split */
export const ADVANCED_PAGES: AppPage[] = []

/** @deprecated Always returns true — beginner mode moved to Usan Lite */
export function isPageVisible(_page: AppPage, _beginnerMode: boolean): boolean {
  return ALL_PAGES.includes(_page)
}
