import { Monitor } from 'lucide-react'
import { FaXbox } from 'react-icons/fa'

export function PlatformBadge({ name, compact = false }: { name: string; compact?: boolean }) {
  const normalized = name.toLocaleUpperCase('en-US')
  const xbox = normalized.includes('XBOX')
  const pc = normalized === 'PC'
  return <span className={`platform-logo-badge ${xbox ? 'xbox' : pc ? 'pc' : 'generic'}${compact ? ' compact' : ''}`}>
    {xbox ? <FaXbox aria-hidden="true" /> : pc ? <Monitor aria-hidden="true" /> : null}
    <span>{name}</span>
  </span>
}
