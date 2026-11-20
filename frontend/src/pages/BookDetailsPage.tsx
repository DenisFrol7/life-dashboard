import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Clock3, Heart, Pencil, Plus } from 'lucide-react'
import { clearBookReadingHistory, getBook, type Book, type ReadingSession } from '../api/books'
import { getApiErrorMessage } from '../api/client'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { BookForm, ProgressForm, SessionForm } from './BooksPage'
import { bookFormatLabels, bookStatusLabels, progressText } from './bookUi'
import './BookDetailsPage.css'

const formatDate = (value: string) => Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Дата не указана'
const duration = (minutes: number) => `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`

export function BookDetailsPage() {
  const id = Number(useParams().id)
  return <BookDetailsContent key={id} id={id} />
}

function BookDetailsContent({ id }: { id: number }) {
  const navigate = useNavigate()
  const requests = useLatestRequest()
  const mutations = useFormMutation()
  const [book, setBook] = useState<Book | null>(null)
  const [editing, setEditing] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [session, setSession] = useState<ReadingSession | 'new' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const actionErrorRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const fallbackRef = useRef('.book-view-edit')
  const focusAfterRefreshRef = useRef(false)
  const formOpen = Boolean(editing || progressOpen || session)
  const { pending } = mutations
  const disabled = loading || Boolean(error) || pending || formOpen

  const load = useCallback(() => requests.run(async () => {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Некорректный идентификатор книги')
    const item = await getBook(id)
    if (item.id !== id) throw new Error('Некорректный ответ при загрузке книги')
    return item
  }, {
    onStart: () => { setLoading(true); setError(null) },
    onSuccess: setBook,
    onError: reason => setError(getApiErrorMessage(reason, 'Не удалось загрузить книгу')),
    onFinish: () => setLoading(false),
  }), [id, requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])
  useEffect(() => {
    if (!focusAfterRefreshRef.current || loading || formOpen || pending) return
    focusAfterRefreshRef.current = false
    const fallback = pageRef.current?.querySelector<HTMLButtonElement>(`${fallbackRef.current}:not(:disabled)`)
      ?? pageRef.current?.querySelector<HTMLButtonElement>('.book-view-edit:not(:disabled)')
    const trigger = error ? pageRef.current?.querySelector<HTMLButtonElement>('.async-error button')
      : triggerRef.current?.isConnected && !triggerRef.current.disabled ? triggerRef.current : fallback
    trigger?.focus({ preventScroll: true })
  }, [loading, formOpen, pending, book, error])
  useEffect(() => {
    if (actionError) { actionErrorRef.current?.scrollIntoView({ block: 'nearest' }); actionErrorRef.current?.focus({ preventScroll: true }) }
  }, [actionError])

  const captureTrigger = (trigger: HTMLButtonElement, fallback: string) => {
    triggerRef.current = trigger
    fallbackRef.current = fallback
    setActionError(null)
    setNotice(null)
  }
  const closeForms = (refresh = false) => {
    focusAfterRefreshRef.current = true
    setEditing(false); setProgressOpen(false); setSession(null)
    if (refresh) void load()
  }
  const retryLoad = () => { focusAfterRefreshRef.current = true; void load() }
  const clearHistory = async () => {
    if (!book || disabled) return
    setActionError(null); setNotice(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Очистить историю и прогресс «${book.title}»?\n\nВсе сеансы чтения или прослушивания и прогресс этой книги будут удалены. Карточка и личные поля сохранятся. Это действие нельзя отменить.`)) return null
      const updated = await clearBookReadingHistory(id)
      if (updated.id !== id) throw new Error('Некорректный ответ при очистке истории книги')
      return updated
    }, {
      onSuccess: updated => {
        if (!updated) return
        setBook(updated)
        setNotice('История и прогресс очищены.')
        fallbackRef.current = '.book-view-add-session'
        focusAfterRefreshRef.current = true
      },
      onError: reason => setActionError(getApiErrorMessage(reason, 'Не удалось очистить историю книги')),
    })
  }
  const sessions = useMemo(() => [...(book?.sessions ?? [])].sort((a, b) => (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0) || b.id - a.id), [book])
  const totalMinutes = sessions.reduce((sum, item) => sum + item.durationMinutes, 0)
  const audio = book?.bookFormat === 'AUDIOBOOK'
  const progress = Math.max(0, Math.min(100, book?.progressPercent ?? 0))
  const inLibrary = book?.libraryEntryId != null
  const hasHistory = Boolean(sessions.length || (book?.currentPage ?? 0) > 0 || (book?.currentMinute ?? 0) > 0)

  return <div ref={pageRef} className="book-view-page">
    <div className="book-view-toolbar"><Link className="icon-button" to="/books"><ArrowLeft aria-hidden="true" />Назад к книгам</Link>{book && <button type="button" className="secondary-button icon-button book-view-edit" disabled={disabled} onClick={event => { captureTrigger(event.currentTarget, '.book-view-edit'); setEditing(true) }}><Pencil aria-hidden="true" />Редактировать</button>}</div>
    {loading && !book ? <LoadingState message="Загружаем книгу…" /> : !book ? <ErrorState title="Не удалось открыть книгу" message={error ?? 'Книга не найдена'} onRetry={retryLoad} /> : <>
      {error && <ErrorState title="Не удалось обновить книгу" message={error} onRetry={retryLoad} compact />}
      {loading && <p className="book-view-loading" role="status">Обновляем сведения о книге…</p>}
      <section className="book-view-hero">
        <div className="book-view-cover"><span aria-hidden="true">{book.title.slice(0, 1)}</span>{book.coverUrl && <img key={book.coverUrl} src={book.coverUrl} alt={`Обложка книги «${book.title}»`} onError={event => { event.currentTarget.hidden = true }} />}{book.favorite && <span className="book-view-favorite" role="img" aria-label="В избранном"><Heart aria-hidden="true" /></span>}</div>
        <div className="book-view-info"><p className="eyebrow">{bookFormatLabels[book.bookFormat]}</p><h2>{book.title}</h2><p className="book-view-author">{book.author || 'Автор не указан'}</p><dl>
          <div><dt>Год</dt><dd>{book.releaseYear ?? 'Не указан'}</dd></div>
          <div><dt>{audio ? 'Продолжительность' : 'Объём'}</dt><dd>{audio ? book.durationMinutes != null ? duration(book.durationMinutes) : 'Не указана' : book.pageCount != null ? `${book.pageCount} страниц` : 'Не указан'}</dd></div>
          <div className="book-view-genre"><dt>Жанр</dt><dd>{book.genre || 'Не указан'}</dd></div>
        </dl></div>
        <div className="book-view-personal">
          <div><span>Статус</span><strong className="book-view-status">{inLibrary ? bookStatusLabels[book.status ?? 'NOT_STARTED'] : 'Не в библиотеке'}</strong>{book.status === 'COMPLETED' && book.completedAt && <small>Завершена: {formatDate(book.completedAt)}</small>}</div>
          <div className="book-view-score"><span>Моя оценка</span><strong className="book-view-rating">{book.rating != null ? `${book.rating}/10` : '—'}</strong></div>
          <div className="book-view-note"><span>Заметка</span><p>{book.personalNote || 'Заметок пока нет.'}</p></div>
        </div>
      </section>
      <section className="book-view-summary" aria-label={audio ? 'Прогресс и время прослушивания' : 'Прогресс и время чтения'}>
        <article className="book-view-panel book-view-progress"><h2>{audio ? 'Прогресс прослушивания' : 'Прогресс чтения'}</h2>
          <div className="book-view-progress-values"><strong>{progressText(book)}</strong><b>{Math.round(progress)}%</b></div>
          <div className="book-view-progress-bar" role="progressbar" aria-label={audio ? 'Прогресс прослушивания' : 'Прогресс чтения'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-valuetext={progressText(book)}><span style={{ width: `${progress}%` }} /></div>
          {!inLibrary && <p className="book-view-hint">Добавьте книгу в библиотеку через редактирование, чтобы отмечать прогресс и добавлять сеансы.</p>}
          <button type="button" className="secondary-button book-view-change-progress" disabled={disabled || !inLibrary} onClick={event => { captureTrigger(event.currentTarget, '.book-view-change-progress'); setProgressOpen(true) }}>Изменить прогресс</button>
        </article>
        <article className="book-view-panel book-view-time"><h2>{audio ? 'Время прослушивания' : 'Время чтения'}</h2><strong><Clock3 aria-hidden="true" />{duration(totalMinutes)}</strong><dl><div><dt>Сеансов</dt><dd>{sessions.length}</dd></div></dl>
          <button type="button" className="primary-button icon-button book-view-add-session" disabled={disabled || !inLibrary} onClick={event => { captureTrigger(event.currentTarget, '.book-view-add-session'); setSession('new') }}><Plus aria-hidden="true" />Добавить сеанс</button>
        </article>
      </section>
      {book.description && <section className="book-view-panel book-view-description"><h2>Описание</h2><p>{book.description}</p></section>}
      <section className="book-view-panel book-view-history" aria-busy={pending || loading}>
        <div className="book-view-history-heading"><div><p className="eyebrow">История</p><h2>{audio ? 'Сеансы прослушивания' : 'Сеансы чтения'}</h2></div>{hasHistory && <button type="button" className="danger-button book-view-clear-history" disabled={disabled} onClick={event => { captureTrigger(event.currentTarget, '.book-view-clear-history'); void clearHistory() }}>{pending ? 'Очищаем…' : 'Очистить историю и прогресс'}</button>}</div>
        {actionError && <div ref={actionErrorRef} className="book-view-action-error" role="alert" tabIndex={-1}>{actionError}</div>}
        {pending && <p className="book-view-loading" role="status">Очищаем историю и прогресс…</p>}
        {notice && <p className="book-view-notice" role="status">{notice}</p>}
        {sessions.length ? <ul className="book-view-session-list">{sessions.map(item => <li key={item.id} data-session-id={item.id}><button type="button" className="book-view-session" disabled={disabled} aria-label={`Изменить сеанс: ${formatDate(item.startedAt)}`} onClick={event => { captureTrigger(event.currentTarget, '.book-view-add-session'); setSession(item) }}>
          <span className="book-view-session-copy"><time dateTime={item.startedAt}>{formatDate(item.startedAt)}</time><span className="book-view-session-note" title={item.note || undefined}>{item.note || 'Без заметки'}</span></span>
          <span className="book-view-session-details"><span><small>{audio ? 'Прослушано' : 'Прочитано'}</small><b>{audio ? `${item.listenedMinutes} мин` : `${item.pagesRead} стр.`}</b></span><span><small>Время</small><b>{duration(item.durationMinutes)}</b></span></span><Pencil aria-hidden="true" />
        </button></li>)}</ul> : <p className="book-view-empty">{audio ? 'Сеансов прослушивания пока нет.' : 'Сеансов чтения пока нет.'}</p>}
      </section>
    </>}
    {editing && book && <BookForm book={book} onClose={() => closeForms()} onSaved={() => closeForms(true)} onDeleted={() => navigate('/books', { replace: true })} />}
    {progressOpen && book && <ProgressForm book={book} onClose={() => closeForms()} onSaved={() => closeForms(true)} />}
    {session && book && <SessionForm book={book} session={session === 'new' ? undefined : session} onClose={() => closeForms()} onSaved={() => closeForms(true)} />}
  </div>
}
