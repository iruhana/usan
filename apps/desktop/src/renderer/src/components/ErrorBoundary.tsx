import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { t } from '../i18n'
import { Button } from './ui'
import TitleBar from './layout/TitleBar'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Usan error boundary]', error, info.componentStack)
  }

  handleReload = () => {
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload()
      return
    }

    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col bg-[var(--color-bg)]" data-view="error-boundary">
          <TitleBar />
          <div className="flex flex-1 items-center justify-center p-6 sm:p-8">
            <section
              role="alert"
              aria-labelledby="app-error-title"
              aria-describedby="app-error-description app-error-help"
              className="w-full max-w-xl rounded-[calc(var(--radius-lg)*1.25)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-lg)] sm:p-8"
            >
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-warning)]/12">
                <AlertTriangle size={30} className="text-[var(--color-warning)]" />
              </div>
              <h1 id="app-error-title" className="text-[length:1.5rem] font-semibold text-[var(--color-text)]">
                {t('error.title')}
              </h1>
              <p id="app-error-description" className="mt-3 text-[length:var(--text-md)] leading-relaxed text-[var(--color-text-muted)]">
                {t('error.description')}
              </p>
              <div
                id="app-error-help"
                className="mt-4 space-y-2 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] px-4 py-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]"
              >
                <p>{t('error.recoveryHint')}</p>
                <p>{t('error.safeDataHint')}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  data-action="error-reload"
                  onClick={this.handleReload}
                  leftIcon={<RefreshCw size={18} />}
                  size="lg"
                >
                  {t('error.reloadApp')}
                </Button>
              </div>
              {this.state.error && (
                <details className="mt-6 w-full">
                  <summary className="cursor-pointer text-[length:var(--text-sm)] font-medium text-[var(--color-text-muted)]">
                    {t('error.details')}
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-3 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </section>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}