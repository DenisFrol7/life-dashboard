import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastType } from './ToastContext'
import { Check, CircleAlert, X } from 'lucide-react'

type Toast = { id: number; message: string; type: ToastType }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
  }, [])
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message, type }])
    timers.current.set(id, setTimeout(() => dismiss(id), 4000))
  }, [dismiss])
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear() }, [])

  return <ToastContext.Provider value={{ showToast }}>
    {children}
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => <div className={`toast ${toast.type}`} key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'}><span>{toast.type === 'success' ? <Check /> : <CircleAlert />}</span><p>{toast.message}</p><button type="button" aria-label="Закрыть уведомление" onClick={() => dismiss(toast.id)}><X /></button></div>)}
    </div>
  </ToastContext.Provider>
}
