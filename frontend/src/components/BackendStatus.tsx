import { useEffect, useState } from 'react'
import { checkBackend } from '../api/health'
import { watchBackendStatus, type BackendStatus as ConnectionStatus } from '../utils/backendStatus'

const labels: Record<ConnectionStatus, string> = {
  checking: 'Проверка backend…',
  connected: 'Backend подключён',
  unavailable: 'Backend недоступен',
}

export function BackendStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('checking')
  useEffect(() => watchBackendStatus(checkBackend, setStatus), [])

  return (
    <div className={`backend-status backend-status--${status}`} role="status">
      <span className="status-dot" aria-hidden="true" /> {labels[status]}
    </div>
  )
}
