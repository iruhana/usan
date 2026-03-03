import { useState, useEffect } from 'react'
import { User, LogOut, Mail, Lock, UserPlus } from 'lucide-react'
import { useAuthStore } from '../stores/auth.store'
import { t } from '../i18n'
import { Card, Button } from '../components/ui'

export default function AccountPage() {
  const { user, loading, error, login, signup, logout, checkSession } = useAuthStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    if (mode === 'login') {
      await login(email, password)
    } else {
      await signup(email, password, displayName || undefined)
    }
  }

  // Logged in view
  if (user) {
    return (
      <div className="max-w-sm mx-auto p-8">
        <div className="mb-8">
          <h1 className="font-semibold tracking-tight text-[length:var(--text-xl)] text-[var(--color-text)]">
            {t('account.title')}
          </h1>
        </div>

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
              <User size={24} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-[length:var(--text-md)] font-medium">
                {user.displayName || user.email || t('account.unknownUser')}
              </p>
              {user.email && (
                <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                  {user.email}
                </p>
              )}
            </div>
          </div>

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

  // Login/Signup form
  return (
    <div className="max-w-sm mx-auto p-8">
      <div className="mb-8">
        <h1 className="font-semibold tracking-tight text-[length:var(--text-xl)] text-[var(--color-text)]">
          {t('account.title')}
        </h1>
      </div>

      <Card>
        {/* Mode toggle */}
        <div className="flex gap-1 mb-4 p-1 bg-[var(--color-surface-soft)] rounded-[var(--radius-md)]">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-[var(--radius-sm)] text-[length:var(--text-md)] font-medium transition-all ${
              mode === 'login'
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)]'
            }`}
          >
            {t('account.login')}
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-[var(--radius-sm)] text-[length:var(--text-md)] font-medium transition-all ${
              mode === 'signup'
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-muted)]'
            }`}
          >
            {t('account.signup')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <div>
              <label className="block mb-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                {t('account.displayName')}
              </label>
              <div className="relative">
                <UserPlus size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('account.displayNamePlaceholder')}
                  className="w-full h-10 pl-9 pr-3 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[length:var(--text-md)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block mb-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {t('account.email')}
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('account.emailPlaceholder')}
                className="w-full h-10 pl-9 pr-3 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[length:var(--text-md)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {t('account.password')}
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('account.passwordPlaceholder')}
                className="w-full h-10 pl-9 pr-3 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] border border-[var(--color-border)] text-[length:var(--text-md)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:outline-none transition-all"
                required
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <p className="text-[length:var(--text-sm)] text-[var(--color-danger)] font-medium">
              {error}
            </p>
          )}

          <Button
            className="w-full mt-1"
            type="submit"
            loading={loading}
          >
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
