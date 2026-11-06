import { useEffect, useState } from 'react'
import { localDate, watchLocalDay } from '../utils/localDay'

export function useToday() {
  const [today, setToday] = useState(() => localDate())
  useEffect(() => watchLocalDay(setToday), [])
  return today
}
