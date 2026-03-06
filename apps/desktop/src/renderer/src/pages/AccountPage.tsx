import { useEffect, useId, useState } from 'react'
import { User, LogOut, Mail, Lock, UserPlus } from 'lucide-react'
import { useAuthStore } from '../stores/auth.store'
import { t } from '../i18n'
import { Card, Button, InlineNotice } from '../components/ui'

export default function AccountPage() {
  const { user, loading, error, login, signup, logout, checkSession } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const emailId = useId()
  const passwordId = useId()
  const displayNameId = useId()

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password.trim()) return

    if (mode === 'login') {
      await login(email, password)
      return
    }

    await signup(email, password, displayName || undefined)
  }

  if (user) {
    return (
      <div className="max-w-md mx-auto p-8 space-y-4" data-view="account-page">
        <header>
          <h1 className="font-semibold tracking-tight text-[length:var(--text-xl)] text-[var(--color-text)]">
            {t('account.title')}
          </h1>
          <p className="mt-1 text-[length:var(--text-md)] text-[var(--color-text-muted)]">
            {t('account.subtitle')}
          </p>
        </header>

        <Card variant="outline">
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {t('account.syncHint')}
          </p>
        </Card>

        <Card data-account-state="signed-in">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
                <User size={24} className="text-[var(--color-primary)]" />
              </div>
              <div>
                <p className="text-[length:var(--text-md)] font-medium text-[var(--color-text)]">
                  {user.displayName || user.email || t('account.unknownUser')}
                </p>
                {user.email && (
                  <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                    {user.email}
                  </p>
                )}
              </div>
            </div>
            <span className="rounded-full bg-[var(--color-primary-muted)] px-2.5 py-1 text-[length:var(--text-xs)] font-medium text-[var(--color-primary)]">
              {t('account.loggedIn')}
            </span>
          </div>

          <p className="mb-4 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {t('account.loggedInHint')}
          </p>

          <Button
            variant="ghost"
            className="w-full !text-[var(--color-danger)] hover:!bg-[var(--color-danger-bg)]"
            onClick={logout}
            disabled={loading}
            leftIcon={<LogOut size={16} />}
          >
            {t('account.logout')}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-8 space-y-4" data-view="account-page">
      <header>
        <h1 className="font-semibold tracking-tight text-[length:var(--text-xl)] text-[var(--color-text)]">
          {t('account.title')}
        </h1>
        <p className="mt-1 text-[length:var(--text-md)] text-[var(--color-text-muted)]">
          {t('account.subtitle')}
        </p>
      </header>

      <Card variant="outline">
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          {t('account.syncHint')}
        </p>
      </Card>

      <Card data-account-state="signed-out">
        <div className="mb-4 flex gap-1 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-[var(--radius-sm)] py-2 text-[length:var(--text-md)] font-medium transition-all ${
              mode === 'login'
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-muted)]'
            }`}
            data-account-mode="login"
          >
            {t('account.login')}
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-[var(--radius-sm)] py-2 text-[length:var(--text-md)] font-medium transition-all ${
              mode === 'signup'
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-muted)]'
            }`}
            data-account-mode="signup"
          >
            {t('account.signup')}
          </button>
        </div>

        <p className="mb-4 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          {t(mode === 'login' ? 'account.modeHintLogin' : 'account.modeHintSignup')}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <div>
              <label htmlFor={displayNameId} className="mb-1 block text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                {t('account.displayName')}
              </label>
              <div className="relative">
                <UserPlus size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  id={displayNameId}
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={t('account.displayNamePlaceholder')}
                  autoComplete="name"
                  className="h-9 w-full rounded-[var(--radius-md)] ring-1 ring-transparent bg-[var(--color-surface-soft)] pl-9 pr-3 text-[length:var(--text-md)] transition-all focus:ring-[var(--color-primary)] focus:shadow-[var(--shadow-primary)] focus:bg-[var(--color-bg-card)] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor={emailId} className="mb-1 block text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {t('account.email')}
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                id={emailId}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('account.emailPlaceholder')}
                autoComplete="email"
                className="h-9 w-full rounded-[var(--radius-md)] ring-1 ring-transparent bg-[var(--color-surface-soft)] pl-9 pr-3 text-[length:var(--text-md)] transition-all focus:ring-[var(--color-primary)] focus:shadow-[var(--shadow-primary)] focus:bg-[var(--color-bg-card)] focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor={passwordId} className="mb-1 block text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {t('account.password')}
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                id={passwordId}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t('account.passwordPlaceholder')}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="h-9 w-full rounded-[var(--radius-md)] ring-1 ring-transparent bg-[var(--color-surface-soft)] pl-9 pr-3 text-[length:var(--text-md)] transition-all focus:ring-[var(--color-primary)] focus:shadow-[var(--shadow-primary)] focus:bg-[var(--color-bg-card)] focus:outline-none"
                required
                minLength={6}
              />
            </div>
          </div>

          {error ? (
            <InlineNotice tone="error" title={t('account.helpTitle')}>
              {error}
            </InlineNotice>
          ) : null}

          <Button className="mt-1 w-full" type="submit" loading={loading}>
            {loading
              ? t('account.loading')
              : mode === 'login'
                ? t('account.loginButton')
                : t('account.signupButton')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
