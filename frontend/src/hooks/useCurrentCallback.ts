import { useCallback, useLayoutEffect, useRef } from 'react'

export function useCurrentCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
  const current = useRef(callback)
  useLayoutEffect(() => { current.current = callback }, [callback])
  return useCallback((...args: Args) => current.current(...args), [])
}
