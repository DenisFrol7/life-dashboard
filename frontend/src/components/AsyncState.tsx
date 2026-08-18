type LoadingStateProps = { message?: string; compact?: boolean }
type ErrorStateProps = { title?: string; message: string; onRetry?: () => void; compact?: boolean }
type EmptyStateProps = { title: string; message: string; icon?: string; compact?: boolean }

export function LoadingState({ message = 'Загружаем данные…', compact = false }: LoadingStateProps) {
  return <div className={`async-state async-loading${compact ? ' compact' : ''}`} role="status"><span className="async-spinner" />{message}</div>
}

export function ErrorState({ title = 'Не удалось загрузить данные', message, onRetry, compact = false }: ErrorStateProps) {
  return <div className={`async-state async-error${compact ? ' compact' : ''}`} role="alert"><span className="async-state-icon" aria-hidden="true">!</span><div><strong>{title}</strong><p>{message}</p>{onRetry && <button type="button" onClick={onRetry}>Повторить</button>}</div></div>
}

export function EmptyState({ title, message, icon = '○', compact = false }: EmptyStateProps) {
  return <div className={`async-state async-empty${compact ? ' compact' : ''}`}><span className="async-state-icon" aria-hidden="true">{icon}</span><div><strong>{title}</strong><p>{message}</p></div></div>
}
