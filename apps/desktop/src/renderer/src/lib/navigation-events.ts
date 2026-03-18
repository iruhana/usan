import type { AppPage } from '../constants/navigation'
import type { SettingsTab } from '../constants/settings'

export const USAN_NAVIGATE_EVENT = 'usan:navigate'

export interface NavigateEventDetail {
  page: AppPage
  settingsTab?: SettingsTab
}

export function dispatchNavigate(detail: NavigateEventDetail): void {
  window.dispatchEvent(new CustomEvent<NavigateEventDetail>(USAN_NAVIGATE_EVENT, { detail }))
}
