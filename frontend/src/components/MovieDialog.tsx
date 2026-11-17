import { useEffect, useId, useRef, type FormEventHandler, type ReactNode } from 'react'
import { X } from 'lucide-react'
import './MovieDialog.css'

type MovieDialogProps = {
  title: string
  eyebrow: string
  children: ReactNode
  actions: ReactNode
  onClose: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
  returnFocusTo: HTMLElement | null
  wide?: boolean
}

export function MovieDialog({ title, eyebrow, children, actions, onClose, onSubmit, returnFocusTo, wide = false }: MovieDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const viewport = window.visualViewport
    const syncSize = () => {
      dialog.style.setProperty('--movie-dialog-height', `${viewport?.height ?? window.innerHeight}px`)
      dialog.style.setProperty('--movie-dialog-offset', `${viewport?.offsetTop ?? 0}px`)
    }
    syncSize()
    dialog.showModal()
    viewport?.addEventListener('resize', syncSize)
    viewport?.addEventListener('scroll', syncSize)
    window.addEventListener('resize', syncSize)
    return () => {
      viewport?.removeEventListener('resize', syncSize)
      viewport?.removeEventListener('scroll', syncSize)
      window.removeEventListener('resize', syncSize)
      dialog.close()
      if (returnFocusTo?.isConnected) returnFocusTo.focus({ preventScroll: true })
    }
  }, [returnFocusTo])

  return <dialog ref={dialogRef} className={`movie-dialog${wide ? ' movie-dialog-wide' : ''}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
    <form className="movie-dialog-form" onSubmit={onSubmit}>
      <header className="movie-dialog-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id={titleId}>{title}</h2></div><button type="button" className="movie-dialog-close" aria-label="Закрыть форму" autoFocus onClick={onClose}><X aria-hidden="true" /></button></header>
      <div className="movie-dialog-body">{children}</div>
      <footer className="movie-dialog-actions">{actions}</footer>
    </form>
  </dialog>
}
