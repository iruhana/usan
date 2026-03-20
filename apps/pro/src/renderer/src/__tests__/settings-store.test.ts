import { DEFAULT_APP_SETTINGS } from '@shared/types'
import { installMockUsan } from '@renderer/test/mockUsan'
import { resetStores } from '@renderer/test/resetStores'
import { useSettingsStore } from '@renderer/stores/settings.store'

describe('settings store', () => {
  beforeEach(() => {
    resetStores()
  })

  it('hydrates and persists settings through the preload bridge', async () => {
    const api = installMockUsan({
      settings: {
        ...DEFAULT_APP_SETTINGS,
        onboardingDismissed: true,
      },
    })

    await useSettingsStore.getState().hydrate()
    await useSettingsStore.getState().updateSettings({
      theme: 'light',
      showTemplates: false,
    })

    expect(api.settings.get).toHaveBeenCalled()
    expect(api.settings.update).toHaveBeenCalledWith({
      theme: 'light',
      showTemplates: false,
    })
    expect(useSettingsStore.getState().settings.theme).toBe('light')
    expect(useSettingsStore.getState().settings.showTemplates).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
