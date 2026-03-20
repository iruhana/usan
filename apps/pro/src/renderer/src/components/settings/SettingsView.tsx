import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AlertTriangle,
  Bell,
  Cpu,
  Database,
  Key,
  Moon,
  Palette,
  Shield,
  Sun,
  User,
} from 'lucide-react'
import type { ProviderSecretProvider, ProviderSecretsSnapshot } from '@shared/types'
import { useChatStore } from '../../stores/chat.store'
import { useSettingsStore } from '../../stores/settings.store'

type SettingsSection = 'general' | 'models' | 'keys' | 'appearance' | 'notifications' | 'privacy' | 'data'

interface SettingsNavItem {
  id: SettingsSection
  icon: typeof User
  label: string
  danger?: boolean
}

interface SecretDraftState {
  anthropic: string
  openai: string
  google: string
}

const NAV_ITEMS: SettingsNavItem[] = [
  { id: 'general', icon: User, label: '일반' },
  { id: 'models', icon: Cpu, label: '모델' },
  { id: 'keys', icon: Key, label: 'API 키' },
  { id: 'appearance', icon: Palette, label: '화면' },
  { id: 'notifications', icon: Bell, label: '알림' },
  { id: 'privacy', icon: Shield, label: '개인정보' },
  { id: 'data', icon: Database, label: '데이터 관리', danger: true },
]

const PROVIDER_KEY_CONFIG: Array<{
  id: ProviderSecretProvider
  label: string
  description: string
  placeholder: string
}> = [
  {
    id: 'anthropic',
    label: 'Anthropic API Key',
    description: 'Claude 계열 모델 호출에 사용합니다.',
    placeholder: 'sk-ant-...',
  },
  {
    id: 'openai',
    label: 'OpenAI API Key',
    description: 'GPT 계열 모델 호출에 사용합니다.',
    placeholder: 'sk-...',
  },
  {
    id: 'google',
    label: 'Google AI API Key',
    description: 'Gemini 계열 모델 호출에 사용합니다.',
    placeholder: 'AIza...',
  },
]

const EMPTY_SECRET_DRAFTS: SecretDraftState = {
  anthropic: '',
  openai: '',
  google: '',
}

const SECRET_SOURCE_LABELS = {
  secure_store: { label: '로컬 보안 저장소', color: 'var(--success)', background: 'var(--success-soft)' },
  environment: { label: '환경 변수', color: 'var(--warning)', background: 'var(--warning-soft)' },
  none: { label: '미설정', color: 'var(--text-muted)', background: 'var(--bg-hover)' },
} as const

export default function SettingsView() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      <aside
        style={{
          width: 200,
          padding: 'var(--sp-4) var(--sp-3)',
          borderRight: '1px solid var(--border-subtle)',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            fontSize: 'var(--fs-lg)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'var(--sp-4)',
            paddingLeft: 'var(--sp-2)',
          }}
        >
          설정
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = item.id === activeSection

            return (
              <button
                key={item.id}
                type="button"
                data-settings-nav={item.id}
                onClick={() => setActiveSection(item.id)}
                aria-current={active ? 'page' : undefined}
                className="focus-ring"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-2)',
                  padding: '6px var(--sp-2)',
                  background: active ? 'var(--bg-active)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: item.danger && !active
                    ? 'var(--danger)'
                    : active
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: active ? 500 : 400,
                  transition: 'background var(--dur-micro), color var(--dur-micro)',
                }}
                onMouseEnter={(event) => {
                  if (!active) {
                    event.currentTarget.style.background = 'var(--bg-hover)'
                  }
                }}
                onMouseLeave={(event) => {
                  if (!active) {
                    event.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <Icon size={14} strokeWidth={1.5} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-6) var(--sp-8)' }}>
        {activeSection === 'general' && <GeneralSettings />}
        {activeSection === 'models' && <ModelsSettings />}
        {activeSection === 'keys' && <KeysSettings />}
        {activeSection === 'appearance' && <AppearanceSettings />}
        {activeSection === 'notifications' && <PlaceholderSection title="알림 설정" />}
        {activeSection === 'privacy' && <PlaceholderSection title="개인정보 설정" />}
        {activeSection === 'data' && <DataSettings />}
      </main>
    </div>
  )
}

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--sp-8)' }}>
      <h3
        style={{
          fontSize: 'var(--fs-md)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--sp-4)',
          paddingBottom: 'var(--sp-2)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {children}
      </div>
    </section>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--sp-4)',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
        {description && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
        )}
      </div>
      {children}
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="focus-ring"
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? 'var(--accent)' : 'var(--bg-hover)',
        border: '1px solid var(--border-default)',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'background var(--dur-micro)',
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'var(--text-inverse)',
          position: 'absolute',
          top: 2,
          left: checked ? 19 : 2,
          transition: 'left var(--dur-micro) var(--ease-standard)',
        }}
      />
    </button>
  )
}

function Notice({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'warning' | 'danger'
  children: ReactNode
}) {
  const palette = {
    neutral: {
      background: 'var(--bg-elevated)',
      border: 'var(--border-default)',
      color: 'var(--text-secondary)',
    },
    warning: {
      background: 'var(--warning-soft)',
      border: 'var(--warning)',
      color: 'var(--text-primary)',
    },
    danger: {
      background: 'var(--danger-soft)',
      border: 'var(--danger)',
      color: 'var(--text-primary)',
    },
  }[tone]

  return (
    <div
      style={{
        padding: 'var(--sp-3)',
        background: palette.background,
        border: `1px solid ${palette.border}`,
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--fs-sm)',
        color: palette.color,
        lineHeight: 'var(--lh-relaxed)',
      }}
    >
      {children}
    </div>
  )
}

function GeneralSettings() {
  const { settings, updateSettings } = useSettingsStore()

  return (
    <SettingGroup title="일반">
      <SettingRow label="자동 저장" description="세션 변경을 자동으로 보존합니다.">
        <ToggleSwitch checked={settings.autoSave} onChange={() => { void updateSettings({ autoSave: !settings.autoSave }) }} />
      </SettingRow>
      <SettingRow label="시작 템플릿 표시" description="빈 세션에서 추천 템플릿을 보여줍니다.">
        <ToggleSwitch checked={settings.showTemplates} onChange={() => { void updateSettings({ showTemplates: !settings.showTemplates }) }} />
      </SettingRow>
      <SettingRow label="언어" description="인터페이스 기본 언어입니다.">
        <select
          value={settings.language}
          onChange={(event) => { void updateSettings({ language: event.target.value as 'ko' | 'en' }) }}
          style={selectStyle}
        >
          <option value="ko">한국어</option>
          <option value="en">English</option>
        </select>
      </SettingRow>
    </SettingGroup>
  )
}

function ModelsSettings() {
  const { settings, updateSettings } = useSettingsStore()
  const { models, setModel } = useChatStore()

  return (
    <SettingGroup title="모델 설정">
      <SettingRow label="기본 모델" description="새 세션의 기본 모델입니다.">
        <select
          value={settings.defaultModel}
          onChange={(event) => {
            const nextModel = event.target.value
            setModel(nextModel)
            void updateSettings({ defaultModel: nextModel })
          }}
          style={selectStyle}
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="도구 사용" description="모델이 필요한 경우 로컬 도구를 호출할 수 있게 합니다.">
        <ToggleSwitch checked={settings.toolUseEnabled} onChange={() => { void updateSettings({ toolUseEnabled: !settings.toolUseEnabled }) }} />
      </SettingRow>
    </SettingGroup>
  )
}

function KeysSettings() {
  const [drafts, setDrafts] = useState<SecretDraftState>(EMPTY_SECRET_DRAFTS)
  const [snapshot, setSnapshot] = useState<ProviderSecretsSnapshot | null>(null)
  const [busyProvider, setBusyProvider] = useState<ProviderSecretProvider | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const providerStatuses = useMemo(() => {
    return new Map((snapshot?.providers ?? []).map((status) => [status.provider, status]))
  }, [snapshot])

  async function refreshStatus(): Promise<void> {
    const next = await window.usan.secrets.getStatus()
    setSnapshot(next)
  }

  useEffect(() => {
    void refreshStatus()
  }, [])

  async function handleSave(provider: ProviderSecretProvider): Promise<void> {
    const value = drafts[provider].trim()
    if (!value) {
      return
    }

    setBusyProvider(provider)
    setFeedback(null)
    setError(null)

    try {
      const next = await window.usan.secrets.setProviderKey(provider, value)
      setSnapshot(next)
      setDrafts((current) => ({ ...current, [provider]: '' }))
      setFeedback(`${provider.toUpperCase()} 키를 로컬 보안 저장소에 저장했습니다.`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setBusyProvider(null)
    }
  }

  async function handleDelete(provider: ProviderSecretProvider): Promise<void> {
    setBusyProvider(provider)
    setFeedback(null)
    setError(null)

    try {
      const next = await window.usan.secrets.deleteProviderKey(provider)
      setSnapshot(next)
      setFeedback(`${provider.toUpperCase()} 로컬 저장 키를 삭제했습니다.`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setBusyProvider(null)
    }
  }

  return (
    <SettingGroup title="API 키">
      <Notice>
        저장한 키는 렌더러로 다시 노출되지 않습니다. 메인 프로세스가 OS 보안 저장소를 통해 암호화된 값만 디스크에 보관합니다.
      </Notice>

      {snapshot && !snapshot.encryptionAvailable && (
        <Notice tone="warning">
          이 환경에서는 로컬 보안 저장소를 사용할 수 없습니다. 환경 변수 fallback은 계속 동작하지만 앱 안에서 새 키를 저장할 수는 없습니다.
        </Notice>
      )}

      {PROVIDER_KEY_CONFIG.map((providerConfig) => {
        const status = providerStatuses.get(providerConfig.id)
        const statusPalette = SECRET_SOURCE_LABELS[status?.source ?? 'none']
        const isBusy = busyProvider === providerConfig.id
        const canDelete = status?.source === 'secure_store'

        return (
          <div
            key={providerConfig.id}
            data-provider-secret-row={providerConfig.id}
            style={{
              padding: 'var(--sp-4)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {providerConfig.label}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  {providerConfig.description}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                <span
                  data-provider-secret-status={providerConfig.id}
                  style={{
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 600,
                    color: statusPalette.color,
                    background: statusPalette.background,
                    borderRadius: '999px',
                    padding: '2px 10px',
                  }}
                >
                  {statusPalette.label}
                </span>
                <span
                  style={{
                    fontSize: 'var(--fs-xs)',
                    color: status?.configured ? 'var(--success)' : 'var(--text-muted)',
                  }}
                >
                  {status?.configured ? '구성됨' : '미구성'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              <input
                data-provider-secret-input={providerConfig.id}
                type="password"
                value={drafts[providerConfig.id]}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setDrafts((current) => ({
                    ...current,
                    [providerConfig.id]: nextValue,
                  }))
                }}
                placeholder={providerConfig.placeholder}
                style={{
                  flex: '1 1 240px',
                  minWidth: 220,
                  padding: '6px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--fs-sm)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <button
                type="button"
                data-provider-secret-save={providerConfig.id}
                onClick={() => { void handleSave(providerConfig.id) }}
                disabled={isBusy || !drafts[providerConfig.id].trim() || snapshot?.encryptionAvailable === false}
                className="focus-ring"
                style={primaryButtonStyle(isBusy || !drafts[providerConfig.id].trim() || snapshot?.encryptionAvailable === false)}
              >
                저장
              </button>
              <button
                type="button"
                data-provider-secret-delete={providerConfig.id}
                onClick={() => { void handleDelete(providerConfig.id) }}
                disabled={isBusy || !canDelete}
                className="focus-ring"
                style={secondaryButtonStyle(isBusy || !canDelete)}
              >
                삭제
              </button>
            </div>

            {status?.source === 'environment' && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                현재 값은 환경 변수에서 제공되고 있습니다. 앱 안에서 삭제할 수 있는 로컬 저장 키는 없습니다.
              </div>
            )}
          </div>
        )
      })}

      {feedback && <Notice>{feedback}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
    </SettingGroup>
  )
}

function AppearanceSettings() {
  const { settings, updateSettings } = useSettingsStore()

  return (
    <SettingGroup title="화면">
      <SettingRow label="테마" description="밝은 테마와 어두운 테마를 전환합니다.">
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {(['dark', 'light'] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => { void updateSettings({ theme }) }}
              className="focus-ring"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-1)',
                padding: '5px 12px',
                background: settings.theme === theme ? 'var(--bg-active)' : 'var(--bg-elevated)',
                border: `1px solid ${settings.theme === theme ? 'var(--accent)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-sm)',
                color: settings.theme === theme ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 'var(--fs-sm)',
                cursor: 'pointer',
              }}
            >
              {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
              {theme === 'dark' ? '다크' : '라이트'}
            </button>
          ))}
        </div>
      </SettingRow>
    </SettingGroup>
  )
}

function DataSettings() {
  const clearMessages = useChatStore((state) => state.clearMessages)
  const [busyAction, setBusyAction] = useState<'reset-workspace' | 'clear-cache' | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleResetWorkspace(): Promise<void> {
    const confirmed = window.confirm('모든 세션, 메시지, 아티팩트를 삭제하고 새 작업 공간으로 초기화합니다. 먼저 로컬 백업을 만든 뒤 계속할까요?')
    if (!confirmed) {
      return
    }

    setBusyAction('reset-workspace')
    setFeedback(null)
    setError(null)

    try {
      const result = await window.usan.data.resetWorkspace()
      clearMessages()
      setFeedback(`작업 공간을 초기화했습니다. 로컬 백업: ${result.backupDir}`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setBusyAction(null)
    }
  }

  async function handleClearCache(): Promise<void> {
    setBusyAction('clear-cache')
    setFeedback(null)
    setError(null)

    try {
      const result = await window.usan.data.clearCache()
      const cacheSummary = result.clearedPaths.length > 0
        ? `${result.clearedPaths.length}개 파일을 정리했고`
        : '정리할 캐시 파일은 없었고'
      const backupSummary = result.backupDir
        ? ` 로컬 백업: ${result.backupDir}`
        : ''

      setFeedback(`캐시를 초기화했습니다. ${cacheSummary} 스킬 캐시 ${result.reindexedSkillCount}개를 다시 색인했습니다.${backupSummary}`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <SettingGroup title="데이터 관리">
      <Notice>
        세션 삭제는 설정과 API 키를 건드리지 않고 작업 기록만 비웁니다. 두 작업 모두 실행 전에 로컬 백업을 만들거나 보관된 경로를 알려줍니다.
      </Notice>

      <div
        style={{
          padding: 'var(--sp-3)',
          background: 'var(--danger-soft)',
          border: '1px solid var(--border-danger)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--sp-2)',
        }}
      >
        <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--danger)' }}>위험 구역</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
            아래 작업은 되돌릴 수 없습니다.
          </div>
        </div>
      </div>

      <SettingRow label="모든 세션 삭제" description="대화 기록, 실행 단계, 승인, 아티팩트를 영구 삭제합니다.">
        <button
          type="button"
          data-settings-reset-workspace
          onClick={() => { void handleResetWorkspace() }}
          disabled={busyAction !== null}
          className="focus-ring"
          style={dangerButtonStyle(busyAction !== null)}
        >
          {busyAction === 'reset-workspace' ? '삭제 중...' : '삭제'}
        </button>
      </SettingRow>

      <SettingRow label="캐시 초기화" description="임시 파일, skills 인덱스 캐시, 렌더 캐시를 정리합니다.">
        <button
          type="button"
          data-settings-clear-cache
          onClick={() => { void handleClearCache() }}
          disabled={busyAction !== null}
          className="focus-ring"
          style={secondaryButtonStyle(busyAction !== null)}
        >
          {busyAction === 'clear-cache' ? '초기화 중...' : '초기화'}
        </button>
      </SettingRow>

      {feedback && (
        <Notice>
          <span data-settings-data-feedback>{feedback}</span>
        </Notice>
      )}

      {error && (
        <Notice tone="danger">
          <span data-settings-data-error>{error}</span>
        </Notice>
      )}
    </SettingGroup>
  )
}

function PlaceholderSection({ title }: { title: string }) {
  return (
    <SettingGroup title={title}>
      <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
        백엔드 연결 예정입니다.
      </div>
    </SettingGroup>
  )
}

const selectStyle: CSSProperties = {
  padding: '4px 8px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: 'var(--fs-sm)',
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: '6px 14px',
    fontSize: 'var(--fs-sm)',
    fontWeight: 500,
    background: disabled ? 'var(--bg-hover)' : 'var(--accent)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-inverse)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: '6px 14px',
    fontSize: 'var(--fs-sm)',
    background: 'transparent',
    color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function dangerButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: '6px 14px',
    fontSize: 'var(--fs-sm)',
    fontWeight: 500,
    background: disabled ? 'var(--bg-hover)' : 'var(--danger)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-inverse)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
