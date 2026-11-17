import { useEffect, useRef, useState, type FormEventHandler, type ReactNode } from 'react'
import { MovieDialog } from './MovieDialog'
import './SeriesFormDialog.css'

type Props = {
  title: string
  eyebrow: string
  context?: string
  error: string | null
  pending: boolean
  children: ReactNode
  actions: ReactNode
  onClose: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
  returnFocusTo?: HTMLElement | null
  wide?: boolean
}

export function SeriesFormDialog({ title, eyebrow, context, error, pending, children, actions, onClose, onSubmit, returnFocusTo, wide }: Props) {
  const [trigger] = useState(() => returnFocusTo ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null))
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (error) { errorRef.current?.scrollIntoView({ block: 'nearest' }); errorRef.current?.focus({ preventScroll: true }) }
  }, [error])
  return <MovieDialog title={title} eyebrow={eyebrow} wide={wide} returnFocusTo={trigger} onClose={onClose} onSubmit={onSubmit} actions={actions}>
    {error && <div ref={errorRef} tabIndex={-1} className="form-error" role="alert">{error}</div>}
    <fieldset className="series-editor-fields" aria-label={title} disabled={pending}>
      {context && <p className="series-editor-context">{context}</p>}
      {children}
    </fieldset>
  </MovieDialog>
}
