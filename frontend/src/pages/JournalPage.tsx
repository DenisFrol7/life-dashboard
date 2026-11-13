import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { addJournalTag, createJournalEntry, createTag, deleteJournalEntry, getJournalEntries, getTags, removeJournalTag, updateJournalEntry, type JournalEntry, type JournalEntryInput, type Tag } from '../api/journal'
import { useToast } from '../components/ToastContext'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { useFormMutation } from '../hooks/useFormMutation'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { usePageMutation } from '../hooks/usePageMutation'
import { localDate } from '../utils/localDay'
import { ArrowLeft, NotebookPen, Pencil, Pin, Plus, Search, Trash2, X } from 'lucide-react'
import './JournalPage.css'

const formatDate = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
const excerpt = (text: string, length = 180) => text.length > length ? `${text.slice(0, length).trim()}…` : text

export function BlogPage() {
  const requests = useLatestRequest()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reading, setReading] = useState(false)
  const listRef = useRef<HTMLElement>(null)
  const readerRef = useRef<HTMLElement>(null)
  const listTriggerRef = useRef<HTMLButtonElement | null>(null)
  const dialogTriggerRef = useRef<HTMLButtonElement | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const listPositionRef = useRef({ page: 0, list: 0 })
  const focusListRef = useRef(false)
  const focusAfterRefreshRef = useRef(false)
  const [editing, setEditing] = useState<JournalEntry | 'new' | null>(null)
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    await requests.run(() => Promise.all([getJournalEntries({ from: from || undefined, to: to || undefined, pinned: pinnedOnly ? true : undefined, tag: tag || undefined }), getTags()]), {
      onStart: () => { setLoading(true); setError(null) },
      onSuccess: ([journal, availableTags]) => {
        setEntries(journal); setTags(availableTags)
      },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить блог'),
      onFinish: () => setLoading(false),
    })
  }, [from, pinnedOnly, tag, to, requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])

  const visible = useMemo(() => { const normalized = query.trim().toLocaleLowerCase('ru-RU'); return normalized ? entries.filter((entry) => `${entry.title ?? ''} ${entry.content}`.toLocaleLowerCase('ru-RU').includes(normalized)) : entries }, [entries, query])
  const selected = visible.find(entry => entry.id === selectedId) ?? visible[0] ?? null
  const actions = usePageMutation(JSON.stringify([from, to, tag, pinnedOnly]), load, Boolean(editing) || loading)
  const openEntry = (entry: JournalEntry, trigger: HTMLButtonElement) => {
    listPositionRef.current = { page: window.scrollY, list: listRef.current?.scrollTop ?? 0 }
    listTriggerRef.current = trigger
    setSelectedId(entry.id)
    setReading(true)
  }
  const backToList = () => { focusListRef.current = true; setReading(false) }
  const openForm = (entry: JournalEntry | 'new', trigger: HTMLButtonElement) => { dialogTriggerRef.current = trigger; setEditing(entry) }
  const saved = (entry: JournalEntry) => { focusAfterRefreshRef.current = true; setSelectedId(entry.id); setEditing(null); void actions.refresh() }
  const resetFilters = () => { setQuery(''); setFrom(''); setTo(''); setTag(''); setPinnedOnly(false) }
  const filtered = Boolean(query.trim() || from || to || tag || pinnedOnly)
  useEffect(() => {
    if (reading && window.matchMedia('(max-width: 1200px)').matches) {
      readerRef.current?.focus({ preventScroll: true })
      readerRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [reading])
  useEffect(() => {
    if (loading || editing || actions.pending) return
    if (focusListRef.current && !reading) {
      focusListRef.current = false
      if (listRef.current) listRef.current.scrollTop = listPositionRef.current.list
      window.scrollTo({ top: listPositionRef.current.page })
      const trigger = listTriggerRef.current?.isConnected ? listTriggerRef.current : listRef.current?.querySelector<HTMLButtonElement>('.journal-entry-button') ?? addButtonRef.current
      trigger?.focus({ preventScroll: true })
    } else if (focusAfterRefreshRef.current) {
      focusAfterRefreshRef.current = false
      const readerAction = readerRef.current?.querySelector<HTMLButtonElement>('.journal-reader-actions button') ?? readerRef.current?.querySelector<HTMLButtonElement>('.journal-back-button')
      const trigger = dialogTriggerRef.current?.isConnected ? dialogTriggerRef.current : reading ? readerAction : addButtonRef.current
      trigger?.focus({ preventScroll: true })
    }
  }, [loading, editing, reading, actions.pending])
  const remove = async (entry: JournalEntry) => {
    const changed = await actions.run('delete', async () => {
      if (!window.confirm(`Удалить запись «${entry.title ?? formatDate(entry.entryDate)}»?`)) return false
      await deleteJournalEntry(entry.id)
      return true
    }, 'Не удалось удалить запись', 'Запись блога удалена')
    if (changed) backToList()
  }

  return <div className="journal-page" data-reading={reading}>
    <section className="journal-toolbar"><div className="journal-search"><Search aria-hidden="true" /><input type="search" aria-label="Поиск по записям" value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск по записям" /></div><button type="button" ref={addButtonRef} disabled={actions.disabled} className="primary-button icon-button journal-add-button" onClick={event => openForm('new', event.currentTarget)}><Plus aria-hidden="true" />Новая запись</button></section>
    <section className="journal-filters" aria-label="Фильтры записей"><label>С даты<input type="date" max={to || undefined} value={from} onChange={event => { if (!event.target.value || event.target.validity.valid) setFrom(event.target.value) }} /></label><label>По дату<input type="date" min={from || undefined} value={to} onChange={event => { if (!event.target.value || event.target.validity.valid) setTo(event.target.value) }} /></label><label className="journal-tag-filter">Тег<select value={tag} onChange={event => setTag(event.target.value)}><option value="">Все теги</option>{tags.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label><label className="journal-pinned-filter"><input type="checkbox" checked={pinnedOnly} onChange={event => setPinnedOnly(event.target.checked)} />Только закреплённые</label>{filtered && <button type="button" className="journal-reset-filters" onClick={resetFilters}>Сбросить</button>}</section>
    {actions.pending && <p className="muted" role="status">Обновляем данные…</p>}{actions.error && <div className="notice error journal-error" role="alert"><strong>Ошибка</strong><span>{actions.error}</span></div>}
    <section className="journal-layout" aria-busy={loading}>
      <aside ref={listRef} className="journal-list" aria-label="Список записей"><div className="journal-list-heading"><output aria-live="polite">{loading ? 'Загружаем записи…' : error ? 'Записи не загружены' : `Найдено: ${visible.length}`}</output></div>{loading ? <LoadingState message="Загружаем записи…" compact /> : error ? <ErrorState message={error} onRetry={() => void load()} compact /> : visible.length === 0 ? <div className="journal-empty"><NotebookPen aria-hidden="true" /><h2>{filtered ? 'Записей не найдено' : 'Ваш блог пока пуст'}</h2><p>{filtered ? 'Попробуйте изменить поиск или фильтры.' : 'Создайте первую запись и сохраните мысли за день.'}</p>{filtered && <button type="button" className="secondary-button" onClick={resetFilters}>Сбросить фильтры</button>}</div> : visible.map(entry => <button type="button" className={`journal-entry-button${selected?.id === entry.id ? ' active' : ''}`} aria-current={selected?.id === entry.id ? 'true' : undefined} key={entry.id} onClick={event => openEntry(entry, event.currentTarget)}><span className="journal-entry-meta"><time dateTime={entry.entryDate}>{formatDate(entry.entryDate)}</time>{entry.pinned && <span role="img" aria-label="Закреплено"><Pin aria-hidden="true" /></span>}</span><strong>{entry.title ?? 'Без заголовка'}</strong><span className="journal-entry-excerpt">{excerpt(entry.content, 95)}</span>{entry.tags.length > 0 && <span className="journal-entry-tags">{entry.tags.slice(0, 3).map(item => <i key={item.id}>{item.name}</i>)}{entry.tags.length > 3 && <i>+{entry.tags.length - 3}</i>}</span>}</button>)}</aside>
      <article ref={readerRef} className="journal-reader" tabIndex={-1} aria-label="Чтение записи">
        <button type="button" className="journal-back-button icon-button" onClick={backToList}><ArrowLeft aria-hidden="true" />К списку</button>
        {loading ? <LoadingState message="Загружаем запись…" compact /> : error ? <ErrorState title="Не удалось загрузить блог" message={error} onRetry={() => void load()} compact /> : selected ? <><header className="journal-reader-heading"><div><p className="eyebrow">{formatDate(selected.entryDate)}</p><h2>{selected.title ?? 'Без заголовка'}</h2></div><div className="journal-reader-actions"><button type="button" disabled={actions.disabled} className="icon-button" onClick={event => openForm(selected, event.currentTarget)}><Pencil aria-hidden="true" />Редактировать</button><button type="button" disabled={actions.disabled} className="icon-button" onClick={() => void remove(selected)}><Trash2 aria-hidden="true" />Удалить</button></div></header>{selected.tags.length > 0 && <div className="journal-reader-tags">{selected.tags.map(item => <span key={item.id}>#{item.name}</span>)}</div>}<div className="journal-content">{selected.content.split('\n').map((paragraph, index) => <p key={index}>{paragraph || <br />}</p>)}</div></> : <div className="journal-reader-empty"><NotebookPen aria-hidden="true" /><h2>{filtered ? 'Записей не найдено' : 'Ваш блог'}</h2><p>{filtered ? 'Измените поиск или фильтры, чтобы найти запись.' : 'Выберите запись из списка или создайте новую.'}</p></div>}</article>
    </section>
    {editing && <JournalForm entry={editing === 'new' ? undefined : editing} tags={tags} returnFocusTo={dialogTriggerRef.current} onClose={() => setEditing(null)} onSaved={saved} />}
  </div>
}

function JournalForm({ entry, tags: initialTags, returnFocusTo, onClose, onSaved }: { entry?: JournalEntry; tags: Tag[]; returnFocusTo: HTMLButtonElement | null; onClose: () => void; onSaved: (entry: JournalEntry) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { showToast } = useToast()
  const [date, setDate] = useState(() => entry?.entryDate ?? localDate())
  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [pinned, setPinned] = useState(entry?.pinned ?? false)
  const [tags, setTags] = useState(initialTags)
  const [selectedTags, setSelectedTags] = useState<number[]>(entry?.tags.map((item) => item.id) ?? [])
  const savedEntryRef = useRef(entry)
  const appliedTagIdsRef = useRef(new Set(entry?.tags.map(tag => tag.id) ?? []))
  const [newTag, setNewTag] = useState('')
  const [operation, setOperation] = useState<'tag' | 'entry' | null>(null)
  const mutations = useFormMutation()
  const { saving, pending } = mutations
  const [error, setError] = useState<string | null>(null)
  const closeForm = () => { mutations.dispose(); onClose() }
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const viewport = window.visualViewport
    const syncSize = () => {
      dialog.style.setProperty('--journal-dialog-height', `${viewport?.height ?? window.innerHeight}px`)
      dialog.style.setProperty('--journal-dialog-offset', `${viewport?.offsetTop ?? 0}px`)
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
  const addTag = async () => {
    const name = newTag.trim()
    if (pending || !name) return
    setError(null)
    setOperation('tag')
    await mutations.run('save', () => createTag(name, name.toLocaleLowerCase('ru-RU').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')), {
      onSuccess: (created) => { setTags((current) => [...current, created]); setSelectedTags((current) => [...current, created.id]); setNewTag('') },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось создать тег'),
    })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    if (!content.trim()) { setError('Добавьте текст записи.'); return }
    setOperation('entry')
    const input: JournalEntryInput = { entryDate: date, title: title || null, content, pinned }
    await mutations.run('save', async () => {
      const saved = savedEntryRef.current ? await updateJournalEntry(savedEntryRef.current.id, input) : await createJournalEntry(input)
      savedEntryRef.current = saved
      const currentIds = appliedTagIdsRef.current
      const selectedIds = new Set(selectedTags)
      for (const id of selectedIds) {
        if (currentIds.has(id)) continue
        await addJournalTag(saved.id, id)
        currentIds.add(id)
      }
      for (const id of [...currentIds]) {
        if (selectedIds.has(id)) continue
        await removeJournalTag(saved.id, id)
        currentIds.delete(id)
      }
      return saved
    }, {
      onSuccess: saved => { showToast(entry ? 'Запись блога обновлена' : 'Запись блога добавлена'); onSaved(saved) },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось сохранить запись'),
    })
  }
  return <dialog ref={dialogRef} className="journal-dialog" aria-labelledby="journal-form-title"
    onCancel={event => { event.preventDefault(); closeForm() }} onClick={event => { if (event.target === event.currentTarget) closeForm() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}><form className="journal-form" onSubmit={event => void submit(event)}>
    <header className="journal-form-heading"><div><p className="eyebrow">Блог</p><h2 id="journal-form-title">{entry ? 'Редактирование' : 'Новая запись'}</h2></div><button type="button" className="journal-form-close" aria-label="Закрыть форму" autoFocus onClick={closeForm}><X aria-hidden="true" /></button></header>
    <div className="journal-form-body">
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="journal-form-meta"><label>Дата записи<input required type="date" value={date} onChange={event => setDate(event.target.value)} /></label><label className="journal-pin-check"><input type="checkbox" checked={pinned} onChange={event => setPinned(event.target.checked)} />Закрепить</label></div>
      <label>Заголовок<input className="journal-title-input" maxLength={300} value={title} onChange={event => setTitle(event.target.value)} placeholder="Можно оставить пустым" /></label>
      <label>Текст записи<textarea className="journal-editor" required value={content} onChange={event => setContent(event.target.value)} placeholder="О чём вы думаете сегодня?" /></label>
      <fieldset className="journal-tag-picker" disabled={pending}><legend>Теги</legend><div className="journal-tag-options">{tags.map(tag => <label key={tag.id}><input type="checkbox" checked={selectedTags.includes(tag.id)} onChange={() => setSelectedTags(current => current.includes(tag.id) ? current.filter(id => id !== tag.id) : [...current, tag.id])} /><span>#{tag.name}</span></label>)}</div><div className="journal-new-tag"><label>Новый тег<input maxLength={100} value={newTag} onChange={event => setNewTag(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void addTag() } }} placeholder="Название тега" /></label><button type="button" disabled={pending || !newTag.trim()} onClick={() => void addTag()}>{pending && operation === 'tag' ? 'Добавляем…' : 'Добавить'}</button></div></fieldset>
    </div>
    <footer className="journal-form-actions"><button className="secondary-button" type="button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending}>{saving && operation === 'entry' ? 'Сохраняем…' : 'Сохранить'}</button></footer>
    </form></dialog>
}
