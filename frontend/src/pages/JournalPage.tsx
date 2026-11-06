import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { addJournalTag, createJournalEntry, createTag, deleteJournalEntry, getJournalEntries, getTags, removeJournalTag, updateJournalEntry, type JournalEntry, type JournalEntryInput, type Tag } from '../api/journal'
import { useToast } from '../components/ToastContext'
import { useFormMutation } from '../hooks/useFormMutation'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { usePageMutation } from '../hooks/usePageMutation'
import { localDate } from '../utils/localDay'
import { NotebookPen, Pencil, Pin, Plus, Search, Trash2, X } from 'lucide-react'

const formatDate = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
const excerpt = (text: string, length = 180) => text.length > length ? `${text.slice(0, length).trim()}…` : text

export function BlogPage() {
  const requests = useLatestRequest()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selected, setSelected] = useState<JournalEntry | null>(null)
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
        setSelected((current) => current ? journal.find((item) => item.id === current.id) ?? journal[0] ?? null : journal[0] ?? null)
      },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить блог'),
      onFinish: () => setLoading(false),
    })
  }, [from, pinnedOnly, tag, to, requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])

  const visible = useMemo(() => { const normalized = query.trim().toLocaleLowerCase('ru-RU'); return normalized ? entries.filter((entry) => `${entry.title ?? ''} ${entry.content}`.toLocaleLowerCase('ru-RU').includes(normalized)) : entries }, [entries, query])
  const actions = usePageMutation(JSON.stringify([from, to, tag, pinnedOnly]), load, Boolean(editing) || loading)
  const remove = (entry: JournalEntry) => actions.run('delete', async () => {
    if (!window.confirm(`Удалить запись «${entry.title ?? formatDate(entry.entryDate)}»?`)) return false
    await deleteJournalEntry(entry.id)
    return true
  }, 'Не удалось удалить запись', 'Запись блога удалена')

  return <div className="journal-page">
    <section className="journal-toolbar"><div className="journal-search"><span><Search /></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по записям" /></div><button disabled={actions.disabled} className="primary-button icon-button" onClick={() => setEditing('new')}><Plus />Новая запись</button></section>
    <section className="journal-filters"><label>С даты<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>По дату<input type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></label><label>Тег<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">Все теги</option>{tags.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label><label className="pinned-filter"><input type="checkbox" checked={pinnedOnly} onChange={(event) => setPinnedOnly(event.target.checked)} />Только закреплённые</label>{(from || to || tag || pinnedOnly) && <button onClick={() => { setFrom(''); setTo(''); setTag(''); setPinnedOnly(false) }}>Сбросить</button>}</section>
    {actions.pending && <p className="muted" role="status">Обновляем данные…</p>}{(error || actions.error) && <div className="notice error journal-error" role="alert"><strong>Ошибка</strong><span>{error ?? actions.error}</span></div>}
    <section className="journal-layout">
      <aside className="journal-list"><div className="journal-list-heading"><span>{visible.length} записей</span></div>{loading ? <div className="loading"><span /></div> : visible.length === 0 ? <div className="journal-empty">Записей не найдено.</div> : visible.map((entry) => <button className={selected?.id === entry.id ? 'active' : ''} key={entry.id} onClick={() => setSelected(entry)}><div><time>{formatDate(entry.entryDate)}</time>{entry.pinned && <span title="Закреплено"><Pin /></span>}</div><strong>{entry.title ?? 'Без заголовка'}</strong><p>{excerpt(entry.content, 95)}</p><div className="entry-tags">{entry.tags.slice(0, 3).map((item) => <i key={item.id}>{item.name}</i>)}</div></button>)}</aside>
      <article className="journal-reader">{selected ? <><header><div><p className="eyebrow">{formatDate(selected.entryDate)}</p><h2>{selected.title ?? 'Без заголовка'}</h2></div><div><button disabled={actions.disabled} className="icon-button" onClick={() => setEditing(selected)}><Pencil />Редактировать</button><button disabled={actions.disabled} className="icon-button" onClick={() => void remove(selected)}><Trash2 />Удалить</button></div></header>{selected.tags.length > 0 && <div className="reader-tags">{selected.tags.map((item) => <span key={item.id}>#{item.name}</span>)}</div>}<div className="journal-content">{selected.content.split('\n').map((paragraph, index) => <p key={index}>{paragraph || <br />}</p>)}</div></> : <div className="reader-empty"><span><NotebookPen /></span><h2>Ваш блог</h2><p>Выберите запись слева или создайте новую.</p></div>}</article>
    </section>
    {editing && <JournalForm entry={editing === 'new' ? undefined : editing} tags={tags} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void actions.refresh() }} />}
  </div>
}

function JournalForm({ entry, tags: initialTags, onClose, onSaved }: { entry?: JournalEntry; tags: Tag[]; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast()
  const [date, setDate] = useState(() => entry?.entryDate ?? localDate())
  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [pinned, setPinned] = useState(entry?.pinned ?? false)
  const [tags, setTags] = useState(initialTags)
  const [selectedTags, setSelectedTags] = useState<number[]>(entry?.tags.map((item) => item.id) ?? [])
  const [newTag, setNewTag] = useState('')
  const mutations = useFormMutation()
  const { saving, pending } = mutations
  const [error, setError] = useState<string | null>(null)
  const closeForm = () => { mutations.dispose(); onClose() }
  const addTag = async () => {
    const name = newTag.trim()
    if (pending || !name) return
    setError(null)
    await mutations.run('save', () => createTag(name, name.toLocaleLowerCase('ru-RU').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')), {
      onSuccess: (created) => { setTags((current) => [...current, created]); setSelectedTags((current) => [...current, created.id]); setNewTag('') },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось создать тег'),
    })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    const input: JournalEntryInput = { entryDate: date, title: title || null, content, pinned }
    await mutations.run('save', async () => {
      const saved = entry ? await updateJournalEntry(entry.id, input) : await createJournalEntry(input)
      const currentIds = new Set(entry?.tags.map((item) => item.id) ?? [])
      const selectedIds = new Set(selectedTags)
      await Promise.all([...selectedIds].filter((id) => !currentIds.has(id)).map((id) => addJournalTag(saved.id, id)))
      await Promise.all([...currentIds].filter((id) => !selectedIds.has(id)).map((id) => removeJournalTag(saved.id, id)))
    }, {
      onSuccess: () => { showToast(entry ? 'Запись блога обновлена' : 'Запись блога добавлена'); onSaved() },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось сохранить запись'),
    })
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><form className="journal-form" onSubmit={(event) => void submit(event)}><div className="form-heading"><div><p className="eyebrow">Блог</p><h2>{entry ? 'Редактирование' : 'Новая запись'}</h2></div><button type="button" aria-label="Закрыть" onClick={closeForm}><X /></button></div>{error && <div className="form-error">{error}</div>}<div className="journal-form-meta"><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /><label><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />Закрепить</label></div><input className="journal-title-input" maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Заголовок записи" /><textarea className="journal-editor" required value={content} onChange={(event) => setContent(event.target.value)} placeholder="О чём вы думаете сегодня?" />
    <fieldset className="tag-picker" disabled={pending}><legend>Теги</legend><div>{tags.map((tag) => <label key={tag.id}><input type="checkbox" checked={selectedTags.includes(tag.id)} onChange={() => setSelectedTags((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])} />#{tag.name}</label>)}</div><div className="new-tag"><input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="Новый тег" /><button type="button" disabled={pending || !newTag.trim()} onClick={() => void addTag()}>Добавить</button></div></fieldset>
    <div className="form-buttons"><button className="secondary-button" type="button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div></form></div>
}
