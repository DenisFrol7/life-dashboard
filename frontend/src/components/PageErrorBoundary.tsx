import { Component, type ReactNode } from 'react'
import { ErrorState } from './AsyncState'

export class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return <ErrorState
        title="Не удалось открыть раздел"
        message="Проверьте соединение и перезагрузите страницу. Также можно перейти в другой раздел через меню."
        onRetry={() => window.location.reload()}
        retryLabel="Перезагрузить страницу"
      />
    }
    return this.props.children
  }
}
