/**
 * Onboarding — First-run discoverability flow.
 * Lightweight, dismissible, task-oriented.
 */
import { useState } from 'react'
import { X, ArrowRight, Sparkles, MessageSquare, Command, Zap } from 'lucide-react'
import { useSettingsStore } from '../../stores/settings.store'

interface OnboardingStep {
  icon: typeof Sparkles
  title: string
  description: string
}

const STEPS: OnboardingStep[] = [
  {
    icon: MessageSquare,
    title: '자유롭게 요청하세요',
    description: '코드, 문서, 자동화 — 무엇이든 자연어로 요청할 수 있습니다.',
  },
  {
    icon: Sparkles,
    title: '빌더 템플릿으로 빠르게 시작',
    description: '랜딩 페이지, 대시보드, 워크플로우 등 미리 만들어진 템플릿을 사용하세요.',
  },
  {
    icon: Command,
    title: 'Ctrl+K로 뭐든 빠르게',
    description: '명령 팔레트로 세션, 설정, 도구에 즉시 접근하세요.',
  },
  {
    icon: Zap,
    title: '실행 전 항상 확인',
    description: '위험한 작업은 자동으로 승인을 요청합니다. 안전하게 사용하세요.',
  },
]

export default function Onboarding() {
  const { hydrated, settings, updateSettings } = useSettingsStore()
  const [currentStep, setCurrentStep] = useState(0)

  if (!hydrated || settings.onboardingDismissed) return null

  const dismissOnboarding = () => {
    void updateSettings({ onboardingDismissed: true })
  }

  const step = STEPS[currentStep]
  const Icon = step.icon
  const isLast = currentStep === STEPS.length - 1

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismissOnboarding}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.50)',
          zIndex: 300,
        }}
      />

      {/* Card */}
      <div
        className="anim-scale-in"
        role="dialog"
        aria-label="온보딩"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-4)',
          zIndex: 301,
          overflow: 'hidden',
        }}
      >
        {/* Close button */}
        <button
          onClick={dismissOnboarding}
          aria-label="온보딩 닫기"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div style={{ padding: 'var(--sp-8) var(--sp-6)', textAlign: 'center' }}>
          {/* Icon */}
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-xl)',
            background: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--sp-4)',
          }}>
            <Icon size={28} style={{ color: 'var(--accent)' }} />
          </div>

          <h2 style={{
            fontSize: 'var(--fs-lg)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'var(--sp-2)',
          }}>
            {step.title}
          </h2>
          <p style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--text-secondary)',
            lineHeight: 'var(--lh-relaxed)',
            maxWidth: 300,
            margin: '0 auto',
          }}>
            {step.description}
          </p>
        </div>

        {/* Footer */}
        <div style={{
          padding: 'var(--sp-3) var(--sp-6) var(--sp-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Step indicators */}
          <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === currentStep ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === currentStep ? 'var(--accent)' : 'var(--bg-hover)',
                  transition: `width var(--dur-panel), background var(--dur-panel)`,
                }}
              />
            ))}
          </div>

          {/* Next / Done */}
          <button
            onClick={() => {
              if (isLast) dismissOnboarding()
              else setCurrentStep(currentStep + 1)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-1)',
              padding: '8px 16px',
              background: 'var(--accent)',
              color: 'var(--text-inverse)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {isLast ? '시작하기' : '다음'}
            {!isLast && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </>
  )
}
