import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { t } from '../i18n'
import { Button } from './ui'

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
          <AlertTriangle size={48} className="text-[var(--color-warning)] mb-4" />
          <h1 className="font-semibold text-[var(--color-text)] mb-2 text-[length:var(--text-xl)]">
            {t('error.title')}
          </h1>
          <p className="text-[var(--color-text-muted)] text-center mb-6 max-w-md text-[length:var(--text-md)]">
            {t('error.description')}
          </p>
          <Button
            onClick={this.handleReload}
            leftIcon={<RefreshCw size={20} />}
            size="lg"
          >
            {t('error.retry')}
          </Button>
          {this.state.error && (
            <details className="mt-6 max-w-lg w-full">
              <summary className="cursor-pointer text-[var(--color-text-muted)] text-[length:var(--text-sm)]">
                {t('error.details')}
              </summary>
              <pre className="mt-2 p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-card)] text-[var(--color-text-muted)] overflow-auto whitespace-pre-wrap text-[length:var(--text-xs)]">
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
