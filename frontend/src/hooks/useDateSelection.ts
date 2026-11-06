import { useState } from 'react'
import { useToday } from './useToday'

export function useDateSelection() {
  const today = useToday()
  const [selected, setDate] = useState<string | null>(null)
  return { today, date: selected ?? today, setDate, selectToday: () => setDate(null) }
}
