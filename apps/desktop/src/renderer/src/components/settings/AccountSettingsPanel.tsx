import { useEffect, useId, useState } from 'react'
import { LogOut, ShieldCheck, User } from 'lucide-react'
import { useAuthStore } from '../../stores/auth.store'
import { t } from '../../i18n'
import { Button, InlineNotice, Input } from '../ui'
import { SettingsSectionCard } from './SettingsPrimitives'

export default function AccountSettingsPanel() {
  const { user, loading, error, login, signup, logout, checkSession } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const emailId = useId()
  const passwordId = useId()
  const displayNameId = useId()

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!email.trim() || !password.trim()) return

    if (mode === 'login') {
      await login(email, password)
      return
    }

    await signup(email, password, displayName || undefined)
  }

  return (
    <div className="space-y-4">
      {user ? (
        <SettingsSectionCard
          cardId="account-access"
          icon={User}
          title={t('account.title')}
          description={t('account.subtitle')}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                <User size={24} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold text-[var(--color-text)]">
                  {user.displayName || user.email || t('account.unknownUser')}
                </p>
                {user.email ? (
                  <p className="mt-1 truncate text-[13px] text-[var(--color-text-muted)]">{user.email}</p>
                ) : null}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              leftIcon={<LogOut size={16} />}
              onClick={() => void logout()}
              disabled={loading}
            >
              {t('account.logout')}
            </Button>
          </div>

          <p className="mt-4 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            {t('account.loggedInHint')}
          </p>
        </SettingsSectionCard>
      ) : (
        <SettingsSectionCard
          cardId="account-access"
          icon={User}
          title={t('account.title')}
          description={t('account.subtitle')}
        >
          <div className="flex gap-1 rounded-[16px] bg-[var(--color-surface-soft)] p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-[12px] py-2.5 text-[14px] font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-[var(--shadow-xs)]'
                  : 'text-[var(--color-text-muted)]'
              }`}
              data-account-mode="login"
            >
              {t('account.login')}
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-[12px] py-2.5 text-[14px] font-semibold transition-all ${
                mode === 'signup'
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-[var(--shadow-xs)]'
                  : 'text-[var(--color-text-muted)]'
              }`}
              data-account-mode="signup"
            >
              {t('account.signup')}
            </button>
          </div>

          <div className="mt-4 space-y-1">
            <p className="text-[14px] font-medium text-[var(--color-text-secondary)]">
              {mode === 'login' ? t('account.login') : t('account.signup')}
            </p>
            <p className="text-[13px] leading-6 text-[var(--color-text-muted)]">
              {t(mode === 'login' ? 'account.modeHintLogin' : 'account.modeHintSignup')}
            </p>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 flex flex-col gap-4">
            {mode === 'signup' ? (
              <Input
                id={displayNameId}
                type="text"
                label={t('account.displayName')}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t('account.displayNamePlaceholder')}
                autoComplete="name"
              />
            ) : null}

            <Input
              id={emailId}
              type="email"
              label={t('account.email')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('account.emailPlaceholder')}
              autoComplete="email"
              required
            />

            <Input
              id={passwordId}
              type="password"
              label={t('account.password')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('account.passwordPlaceholder')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />

            {error ? (
              <InlineNotice tone="error" title={t('account.helpTitle')}>
                {error}
              </InlineNotice>
            ) : null}

            <Button className="w-full" type="submit" loading={loading}>
              {loading
                ? t('account.loading')
                : mode === 'login'
                  ? t('account.loginButton')
                  : t('account.signupButton')}
            </Button>
          </form>
        </SettingsSectionCard>
      )}

      <SettingsSectionCard
        cardId="account-local"
        icon={ShieldCheck}
        title={t('settings.accountLocalTitle')}
        description={t('settings.accountLocalBody')}
      >
        <div className="rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-4">
          <p className="text-[13px] leading-6 text-[var(--color-text-secondary)]">{t('account.syncHint')}</p>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
