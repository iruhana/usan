/**
 * Settings IA — Left-nav grouped settings surface.
 */
import { useState } from 'react'
import {
  User, Cpu, Key, Palette, Bell, Shield, Database,
  AlertTriangle, Moon, Sun,
} from 'lucide-react'
import { useChatStore } from '../../stores/chat.store'
import { useSettingsStore } from '../../stores/settings.store'

type SettingsSection = 'general' | 'models' | 'keys' | 'appearance' | 'notifications' | 'privacy' | 'data'

interface SettingsNavItem {
  id: SettingsSection
  icon: typeof User
  label: string
  danger?: boolean
}

const NAV_ITEMS: SettingsNavItem[] = [
  { id: 'general', icon: User, label: '일반' },
  { id: 'models', icon: Cpu, label: '모델' },
  { id: 'keys', icon: Key, label: 'API 키' },
  { id: 'appearance', icon: Palette, label: '외관' },
  { id: 'notifications', icon: Bell, label: '알림' },
  { id: 'privacy', icon: Shield, label: '개인정보' },
  { id: 'data', icon: Database, label: '데이터 관리', danger: true },
]

export default function SettingsView() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>
      {/* Settings nav */}
      <div style={{
        width: 200,
        padding: 'var(--sp-4) var(--sp-3)',
        borderRight: '1px solid var(--border-subtle)',
        overflowY: 'auto',
        flexShrink: 0,
      }}>
        <h2 style={{
          fontSize: 'var(--fs-lg)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--sp-4)',
          paddingLeft: 'var(--sp-2)',
        }}>
          설정
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = item.id === activeSection
            return (
              <button
                key={item.id}
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
                  color: item.danger && !active ? 'var(--danger)' : active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: active ? 500 : 400,
                  transition: `background var(--dur-micro), color var(--dur-micro)`,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? 'var(--bg-active)' : 'transparent' }}
              >
                <Icon size={14} strokeWidth={1.5} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Settings content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-6) var(--sp-8)' }}>
        {activeSection === 'general' && <GeneralSettings />}
        {activeSection === 'models' && <ModelsSettings />}
        {activeSection === 'keys' && <KeysSettings />}
        {activeSection === 'appearance' && <AppearanceSettings />}
        {activeSection === 'notifications' && <PlaceholderSection title="알림 설정" />}
        {activeSection === 'privacy' && <PlaceholderSection title="개인정보 설정" />}
        {activeSection === 'data' && <DataSettings />}
      </div>
    </div>
  )
}

// ─── Setting Primitives ──────────────────────────────────────────────────────

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--sp-8)' }}>
      <h3 style={{
        fontSize: 'var(--fs-md)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 'var(--sp-4)',
        paddingBottom: 'var(--sp-2)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {children}
      </div>
    </div>
  )
}

function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 'var(--sp-4)',
    }}>
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
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? 'var(--accent)' : 'var(--bg-hover)',
        border: '1px solid var(--border-default)',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: `background var(--dur-micro)`,
      }}
    >
      <div style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: 'var(--text-inverse)',
        position: 'absolute',
        top: 2,
        left: checked ? 19 : 2,
        transition: `left var(--dur-micro) var(--ease-standard)`,
      }} />
    </button>
  )
}

// ─── Sections ────────────────────────────────────────────────────────────────

function GeneralSettings() {
  const { settings, updateSettings } = useSettingsStore()

  return (
    <>
      <SettingGroup title="일반">
        <SettingRow label="자동 저장" description="세션을 자동으로 저장합니다">
          <ToggleSwitch checked={settings.autoSave} onChange={() => { void updateSettings({ autoSave: !settings.autoSave }) }} />
        </SettingRow>
        <SettingRow label="시작 시 템플릿 표시" description="빈 세션에서 빌더 템플릿을 표시합니다">
          <ToggleSwitch checked={settings.showTemplates} onChange={() => { void updateSettings({ showTemplates: !settings.showTemplates }) }} />
        </SettingRow>
        <SettingRow label="언어" description="인터페이스 언어">
          <select
            value={settings.language}
            onChange={(e) => { void updateSettings({ language: e.target.value as 'ko' | 'en' }) }}
            style={{
              padding: '4px 8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: 'var(--fs-sm)',
            }}
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </SettingRow>
      </SettingGroup>
    </>
  )
}

function ModelsSettings() {
  const { settings, updateSettings } = useSettingsStore()
  const { models, setModel } = useChatStore()

  return (
    <SettingGroup title="모델 설정">
      <SettingRow label="기본 모델" description="새 세션에서 사용할 기본 모델">
        <select
          value={settings.defaultModel}
          onChange={(e) => {
            const nextModel = e.target.value
            setModel(nextModel)
            void updateSettings({ defaultModel: nextModel })
          }}
          style={{
            padding: '4px 8px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-sm)',
          }}
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="도구 사용" description="모델이 도구를 사용하도록 허용합니다">
        <ToggleSwitch checked={settings.toolUseEnabled} onChange={() => { void updateSettings({ toolUseEnabled: !settings.toolUseEnabled }) }} />
      </SettingRow>
    </SettingGroup>
  )
}

function KeysSettings() {
  return (
    <SettingGroup title="API 키">
      <SettingRow label="Anthropic API Key" description="Claude 모델 사용에 필요합니다">
        <input
          type="password"
          placeholder="sk-ant-..."
          style={{
            width: 240,
            padding: '5px 8px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-sm)',
            fontFamily: 'var(--font-mono)',
          }}
        />
      </SettingRow>
      <SettingRow label="OpenAI API Key" description="GPT 모델 사용에 필요합니다">
        <input
          type="password"
          placeholder="sk-..."
          style={{
            width: 240,
            padding: '5px 8px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-sm)',
            fontFamily: 'var(--font-mono)',
          }}
        />
      </SettingRow>
      <SettingRow label="Google AI API Key" description="Gemini 모델 사용에 필요합니다">
        <input
          type="password"
          placeholder="AI..."
          style={{
            width: 240,
            padding: '5px 8px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: 'var(--fs-sm)',
            fontFamily: 'var(--font-mono)',
          }}
        />
      </SettingRow>
    </SettingGroup>
  )
}

function AppearanceSettings() {
  const { settings, updateSettings } = useSettingsStore()

  return (
    <SettingGroup title="외관">
      <SettingRow label="테마" description="어두운 테마 또는 밝은 테마를 선택합니다">
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { void updateSettings({ theme: t }) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-1)',
                padding: '5px 12px',
                background: settings.theme === t ? 'var(--bg-active)' : 'var(--bg-elevated)',
                border: `1px solid ${settings.theme === t ? 'var(--accent)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-sm)',
                color: settings.theme === t ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 'var(--fs-sm)',
                cursor: 'pointer',
              }}
            >
              {t === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
              {t === 'dark' ? '다크' : '라이트'}
            </button>
          ))}
        </div>
      </SettingRow>
    </SettingGroup>
  )
}

function DataSettings() {
  return (
    <SettingGroup title="데이터 관리">
      <div style={{
        padding: 'var(--sp-3)',
        background: 'var(--danger-soft)',
        border: '1px solid var(--border-danger)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--sp-2)',
        marginBottom: 'var(--sp-4)',
      }}>
        <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--danger)' }}>위험 구역</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
            아래 작업은 되돌릴 수 없습니다.
          </div>
        </div>
      </div>
      <SettingRow label="모든 세션 삭제" description="모든 대화 기록과 아티팩트를 영구적으로 삭제합니다">
        <button className="focus-ring" style={{
          padding: '5px 14px',
          fontSize: 'var(--fs-sm)',
          fontWeight: 500,
          background: 'var(--danger)',
          color: 'var(--text-inverse)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
        }}>
          삭제
        </button>
      </SettingRow>
      <SettingRow label="캐시 초기화" description="임시 파일과 캐시를 정리합니다">
        <button className="focus-ring" style={{
          padding: '5px 14px',
          fontSize: 'var(--fs-sm)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
        }}>
          초기화
        </button>
      </SettingRow>
    </SettingGroup>
  )
}

function PlaceholderSection({ title }: { title: string }) {
  return (
    <SettingGroup title={title}>
      <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
        백엔드 연결 후 활성화됩니다
      </div>
    </SettingGroup>
  )
}
