import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { t } from '../i18n'

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
    console.error('[우산 에러]', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[var(--color-bg)] p-8">
          <AlertTriangle size={48} className="text-amber-500 mb-4" />
          <h1
            className="font-bold text-[var(--color-text)] mb-2"
            style={{ fontSize: 'var(--font-size-xl)' }}
          >
            {t('error.title')}
          </h1>
          <p
            className="text-[var(--color-text-muted)] text-center mb-6 max-w-md"
            style={{ fontSize: 'var(--font-size-sm)' }}
          >
            {t('error.description')}
          </p>
          <button
            onClick={this.handleReload}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary)] text-white font-medium hover:opacity-90 transition-all"
            style={{ fontSize: 'var(--font-size-sm)', minHeight: '48px' }}
          >
            <RefreshCw size={20} />
            {t('error.retry')}
          </button>
          {this.state.error && (
            <details className="mt-6 max-w-lg w-full">
              <summary
                className="cursor-pointer text-[var(--color-text-muted)]"
                style={{ fontSize: 'calc(12px * var(--font-scale))' }}
              >
                {t('error.details')}
              </summary>
              <pre
                className="mt-2 p-3 rounded-lg bg-[var(--color-bg-card)] text-[var(--color-text-muted)] overflow-auto whitespace-pre-wrap"
                style={{ fontSize: 'calc(11px * var(--font-scale))' }}
              >
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
