import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { BookOpen, Upload } from 'lucide-react'
import { createBook, deleteBook, putBookLibrary, removeBookLibrary, searchGoogleBooks, updateBook, uploadBookCover, type Book, type BookFormat, type BookInput, type BookLibraryInput, type GoogleBookCandidate } from '../api/books'
import type { LibraryStatus } from '../api/movies'
import { getApiErrorMessage } from '../api/client'
import { bookFormatLabels, bookStatusLabels } from '../pages/bookUi'
import { saveLibraryForm } from '../pages/libraryForm'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { SeriesFormDialog } from './SeriesFormDialog'
import { useToast } from './ToastContext'
import './BookForm.css'

const emptyBook: BookInput = { title: '', author: '', bookFormat: 'PAPER', pageCount: null, durationMinutes: null, releaseYear: null, genre: null, coverUrl: null, description: null, googleBooksId: null, isbn: null }
type Props = { book?: Book; returnFocusTo?: HTMLElement | null; onClose: () => void; onSaved: () => void; onDeleted?: () => void }

export function BookForm({ book, returnFocusTo, onClose, onSaved, onDeleted }: Props) {
  const { showToast } = useToast()
  const savedBookRef = useRef(book)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [item, setItem] = useState<BookInput>(book ? { title: book.title, author: book.author, bookFormat: book.bookFormat, pageCount: book.pageCount, durationMinutes: book.durationMinutes, releaseYear: book.releaseYear, genre: book.genre, coverUrl: book.coverUrl, description: book.description, googleBooksId: book.googleBooksId, isbn: book.isbn } : emptyBook)
  const [inLibrary, setInLibrary] = useState(book?.libraryEntryId != null)
  const [library, setLibrary] = useState<BookLibraryInput>({ status: book?.status ?? 'NOT_STARTED', rating: book?.rating ?? null, favorite: book?.favorite ?? false, startedAt: book?.startedAt ?? null, completedAt: book?.completedAt ?? null, personalNote: book?.personalNote ?? null })
  const [catalogQuery, setCatalogQuery] = useState('')
  const [candidates, setCandidates] = useState<GoogleBookCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searchCompleted, setSearchCompleted] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverFileName, setCoverFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { saving, deleting, pending } = mutations
  const catalogRequests = useLatestRequest()
  const uploadRequests = useLatestRequest()
  const created = !book && Boolean(savedBookRef.current)
  const busy = pending || searching || uploadingCover

  const cancelCatalog = () => { catalogRequests.invalidate(); setSearching(false); setCandidates([]); setSearchCompleted(false) }
  const cancelUpload = () => { uploadRequests.invalidate(); setUploadingCover(false); setCoverFileName('') }
  const closeForm = () => { mutations.dispose(); catalogRequests.dispose(); uploadRequests.dispose(); onClose() }
  const setItemValue = <K extends keyof BookInput>(key: K, value: BookInput[K]) => {
    cancelCatalog()
    if (key === 'coverUrl') cancelUpload()
    setItem(current => ({ ...current, [key]: value }))
  }
  const setLibraryValue = <K extends keyof BookLibraryInput>(key: K, value: BookLibraryInput[K]) => setLibrary(current => ({ ...current, [key]: value }))
  const changeFormat = (format: BookFormat) => {
    cancelCatalog()
    setItem(current => ({ ...current, bookFormat: format, pageCount: format === 'AUDIOBOOK' ? null : current.pageCount, durationMinutes: format === 'AUDIOBOOK' ? current.durationMinutes : null }))
  }
  const searchCatalog = async () => {
    const value = catalogQuery.trim()
    if (pending || created || value.length < 2) return
    await catalogRequests.run(() => searchGoogleBooks(value), {
      onStart: () => { setSearching(true); setSearchCompleted(false); setError(null); setCandidates([]) },
      onSuccess: results => { setCandidates(results); setSearchCompleted(true) },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось выполнить поиск в Google Books')),
      onFinish: () => setSearching(false),
    })
  }
  const selectCandidate = (candidate: GoogleBookCandidate) => {
    if (pending || created || candidate.existingBookId != null) return
    cancelCatalog(); cancelUpload(); setError(null)
    setItem(current => ({ ...current, title: candidate.title, author: candidate.author, pageCount: current.bookFormat === 'AUDIOBOOK' ? null : candidate.pageCount, releaseYear: candidate.releaseYear, genre: candidate.genre, coverUrl: candidate.coverUrl, description: candidate.description, googleBooksId: candidate.googleBooksId, isbn: candidate.isbn }))
  }
  const selectCover = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || pending) return
    cancelCatalog(); cancelUpload(); setError(null)
    if (!file.size) { setError('Файл обложки пуст. Выберите другое изображение.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Размер обложки не может превышать 5 МБ.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && !(file.type === '' && /\.(jpe?g|png|webp)$/i.test(file.name))) { setError('Выберите обложку в формате JPEG, PNG или WebP.'); return }
    void uploadRequests.run(() => uploadBookCover(file), {
      onStart: () => { setUploadingCover(true); setCoverFileName(file.name) },
      onSuccess: uploaded => setItem(current => ({ ...current, coverUrl: uploaded.coverUrl })),
      onError: reason => { setCoverFileName(''); setError(getApiErrorMessage(reason, 'Не удалось загрузить обложку')) },
      onFinish: () => setUploadingCover(false),
    })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError(null)
    if (!item.title.trim() || !item.author.trim()) { setError('Укажите название книги и автора.'); return }
    const input = { ...item, title: item.title.trim(), author: item.author.trim() }
    await mutations.run('save', () => saveLibraryForm({
      title: book?.title ?? input.title, inLibrary, wasInLibrary: book?.libraryEntryId != null,
      saveItem: async () => {
        const saved = savedBookRef.current ? await updateBook(savedBookRef.current.id, input) : await createBook(input)
        savedBookRef.current = saved
        return saved
      },
      putLibrary: id => putBookLibrary(id, library), removeLibrary: removeBookLibrary,
    }), {
      onSuccess: saved => { if (saved) { showToast(book ? 'Книга обновлена' : 'Книга добавлена'); onSaved() } },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось сохранить книгу')),
    })
  }
  const remove = async () => {
    if (!book || busy) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить «${book.title}» из каталога вместе с прогрессом и всей историей чтения?`)) return false
      await deleteBook(book.id)
      return true
    }, {
      onSuccess: deleted => { if (deleted) { showToast('Книга удалена'); (onDeleted ?? onSaved)() } },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось удалить книгу')),
    })
  }

  return <SeriesFormDialog title={book ? 'Редактирование книги' : 'Новая книга'} eyebrow="Книги" wide returnFocusTo={returnFocusTo} pending={pending} error={error} onClose={closeForm} onSubmit={event => void submit(event)} actions={<>
    {book && <button className="movie-dialog-delete" type="button" disabled={busy} onClick={() => void remove()}>{deleting ? 'Удаляем…' : 'Удалить книгу'}</button>}
    <button className="secondary-button" type="button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={busy}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
  </>}>
    {!book && <section className="book-form-search" aria-label="Поиск книги в Google Books"><div><label>Поиск в Google Books<input value={catalogQuery} disabled={created} onChange={event => { cancelCatalog(); setCatalogQuery(event.target.value) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void searchCatalog() } }} placeholder="Введите название книги или ISBN" /></label><button type="button" className="secondary-button" disabled={pending || searching || created || catalogQuery.trim().length < 2} onClick={() => void searchCatalog()}>{searching ? 'Ищем…' : 'Найти в Google Books'}</button></div>
      {created ? <p role="status">Книга уже создана. Повторное сохранение обновит её данные и библиотеку.</p> : item.googleBooksId && <p role="status">Издание выбрано. Проверьте данные и обложку.</p>}
      {searching && <p role="status">Ищем издания в Google Books…</p>}
      {candidates.length > 0 && <div className="book-form-results">{candidates.map(candidate => <button type="button" key={candidate.googleBooksId} disabled={pending || created || candidate.existingBookId != null} onClick={() => selectCandidate(candidate)}><span className="book-form-candidate-cover" aria-hidden="true"><BookOpen />{candidate.coverUrl && <img src={candidate.coverUrl} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true }} />}</span><span><strong>{candidate.title}</strong><small>{candidate.author}{candidate.publisher ? ` · ${candidate.publisher}` : ''}{candidate.publishedDate ? ` · ${candidate.publishedDate}` : ''}{candidate.isbn ? ` · ISBN ${candidate.isbn}` : ''}{candidate.existingBookId != null ? ' · Уже в каталоге' : ''}</small></span></button>)}</div>}
      {searchCompleted && candidates.length === 0 && <p role="status">Книга не найдена в Google Books. Проверьте ISBN или заполните данные вручную.</p>}
    </section>}
    <label>Название<input required maxLength={300} value={item.title} onChange={event => setItemValue('title', event.target.value)} /></label>
    <label>Автор<input required maxLength={300} value={item.author} onChange={event => setItemValue('author', event.target.value)} /></label>
    <div className="series-editor-grid"><label>Формат<select value={item.bookFormat} onChange={event => changeFormat(event.target.value as BookFormat)}>{Object.entries(bookFormatLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {item.bookFormat === 'AUDIOBOOK' ? <label>Продолжительность, минут<input required min="1" step="1" type="number" inputMode="numeric" value={item.durationMinutes ?? ''} onChange={event => setItemValue('durationMinutes', event.target.value ? Number(event.target.value) : null)} /></label> : <label>Количество страниц<input required min="1" step="1" type="number" inputMode="numeric" value={item.pageCount ?? ''} onChange={event => setItemValue('pageCount', event.target.value ? Number(event.target.value) : null)} /></label>}
      <label>Год<input min="1" step="1" type="number" inputMode="numeric" value={item.releaseYear ?? ''} onChange={event => setItemValue('releaseYear', event.target.value ? Number(event.target.value) : null)} /></label><label>Жанр<input maxLength={100} value={item.genre ?? ''} onChange={event => setItemValue('genre', event.target.value || null)} /></label>
    </div>
    <label>ISBN<input maxLength={20} value={item.isbn ?? ''} onChange={event => setItemValue('isbn', event.target.value || null)} placeholder="ISBN конкретного издания" /></label>
    <section className="book-form-cover" aria-label="Обложка книги"><label>URL обложки<input type="text" inputMode="url" value={item.coverUrl ?? ''} onChange={event => setItemValue('coverUrl', event.target.value || null)} /></label>
      <div className="book-form-cover-content">{item.coverUrl && <div className="book-form-cover-preview"><BookOpen aria-hidden="true" /><img key={item.coverUrl} src={item.coverUrl} alt="Обложка книги" onError={event => { event.currentTarget.hidden = true }} /></div>}
        <div className="book-form-upload"><input ref={fileInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={selectCover} /><button type="button" className="secondary-button icon-button" onClick={() => fileInputRef.current?.click()}><Upload aria-hidden="true" />{uploadingCover ? 'Выбрать другую обложку' : 'Выбрать файл обложки'}</button><p>JPEG, PNG или WebP, не более 5 МБ</p>{coverFileName && <p className="book-form-filename">{coverFileName}</p>}{uploadingCover && <p role="status">Загружаем обложку…</p>}</div>
      </div>
    </section>
    <label>Описание<textarea rows={4} value={item.description ?? ''} onChange={event => setItemValue('description', event.target.value || null)} /></label>
    <fieldset className="series-editor-section"><legend>Моя библиотека</legend><label className="series-editor-checkbox"><input type="checkbox" checked={inLibrary} onChange={event => setInLibrary(event.target.checked)} />Добавить в библиотеку</label>{inLibrary && <>
      <div className="series-editor-grid"><label>Статус<select value={library.status} onChange={event => setLibraryValue('status', event.target.value as LibraryStatus)}>{Object.entries(bookStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Оценка<select value={library.rating ?? ''} onChange={event => setLibraryValue('rating', event.target.value ? Number(event.target.value) : null)}><option value="">Без оценки</option>{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <option key={value}>{value}</option>)}</select></label></div>
      <label className="series-editor-checkbox"><input type="checkbox" checked={library.favorite} onChange={event => setLibraryValue('favorite', event.target.checked)} />В избранном</label><label>Заметка<textarea rows={3} value={library.personalNote ?? ''} onChange={event => setLibraryValue('personalNote', event.target.value || null)} /></label>
    </>}</fieldset>
  </SeriesFormDialog>
}
