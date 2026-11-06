import { useEffect, useState } from 'react'
import { createLatestRequest } from '../utils/latestRequest'

export function useLatestRequest() {
  const [requests] = useState(createLatestRequest)
  useEffect(() => {
    requests.activate()
    return () => requests.dispose()
  }, [requests])
  return requests
}
