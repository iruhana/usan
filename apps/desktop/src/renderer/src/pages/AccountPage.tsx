import { useState, useEffect } from 'react'
import { User, LogOut, Mail, Lock, UserPlus } from 'lucide-react'
import { useAuthStore } from '../stores/auth.store'
import { t } from '../i18n'

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
      <div className="max-w-md mx-auto p-8">
        <div className="flex items-center gap-3 mb-8">
          <User size={32} className="text-[var(--color-primary)]" />
          <h1 className="font-bold" style={{ fontSize: 'var(--font-size-xl)' }}>
            {t('account.title')}
          </h1>
        </div>

        <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6">
          {/* Profile card */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
              <User size={32} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="font-semibold" style={{ fontSize: 'var(--font-size-base)' }}>
                {user.displayName || user.email || t('account.unknownUser')}
              </p>
              {user.email && (
                <p className="text-[var(--color-text-muted)]" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {user.email}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={logout}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-all"
            style={{ minHeight: 'var(--min-target)', fontSize: 'var(--font-size-sm)' }}
          >
            <LogOut size={20} />
            {t('account.logout')}
          </button>
        </div>
      </div>
    )
  }

  // Login/Signup form
  return (
    <div className="max-w-md mx-auto p-8">
      <div className="flex items-center gap-3 mb-8">
        <User size={32} className="text-[var(--color-primary)]" />
        <h1 className="font-bold" style={{ fontSize: 'var(--font-size-xl)' }}>
          {t('account.title')}
        </h1>
      </div>

      <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] p-6">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              mode === 'login'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'
            }`}
            style={{ minHeight: 'var(--min-target)', fontSize: 'var(--font-size-sm)' }}
          >
            {t('account.login')}
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-3 rounded-xl font-medium transition-all ${
              mode === 'signup'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'
            }`}
            style={{ minHeight: 'var(--min-target)', fontSize: 'var(--font-size-sm)' }}
          >
            {t('account.signup')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <div>
              <label className="block mb-1 text-[var(--color-text-muted)]" style={{ fontSize: 'var(--font-size-sm)' }}>
                {t('account.displayName')}
              </label>
              <div className="relative">
                <UserPlus size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('account.displayNamePlaceholder')}
                  className="w-full h-14 pl-11 pr-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-all"
                  style={{ fontSize: 'var(--font-size-sm)' }}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block mb-1 text-[var(--color-text-muted)]" style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('account.email')}
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('account.emailPlaceholder')}
                className="w-full h-14 pl-11 pr-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-all"
                style={{ fontSize: 'var(--font-size-sm)' }}
                required
              />
            </div>
          </div>

          <div>
            <label className="block mb-1 text-[var(--color-text-muted)]" style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('account.password')}
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('account.passwordPlaceholder')}
                className="w-full h-14 pl-11 pr-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-all"
                style={{ fontSize: 'var(--font-size-sm)' }}
                required
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 font-medium" style={{ fontSize: 'var(--font-size-sm)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-all"
            style={{ minHeight: 'var(--min-target)', fontSize: 'var(--font-size-sm)' }}
          >
            {loading
              ? t('account.loading')
              : mode === 'login'
                ? t('account.loginButton')
                : t('account.signupButton')}
          </button>
        </form>
      </div>
    </div>
  )
}
