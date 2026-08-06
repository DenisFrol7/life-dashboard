import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { addJournalTag, createJournalEntry, createTag, deleteJournalEntry, getJournalEntries, getTags, removeJournalTag, updateJournalEntry, type JournalEntry, type JournalEntryInput, type Tag } from '../api/journal'

const today = new Date().toLocaleDateString('en-CA')
const formatDate = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
const excerpt = (text: string, length = 180) => text.length > length ? `${text.slice(0, length).trim()}…` : text

export function BlogPage() {
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
    setLoading(true); setError(null)
    try { const [journal, availableTags] = await Promise.all([getJournalEntries({ from: from || undefined, to: to || undefined, pinned: pinnedOnly ? true : undefined, tag: tag || undefined }), getTags()]); setEntries(journal); setTags(availableTags); setSelected((current) => current ? journal.find((item) => item.id === current.id) ?? journal[0] ?? null : journal[0] ?? null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить блог') }
    finally { setLoading(false) }
  }, [from, pinnedOnly, tag, to])
  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => { const normalized = query.trim().toLocaleLowerCase('ru-RU'); return normalized ? entries.filter((entry) => `${entry.title ?? ''} ${entry.content}`.toLocaleLowerCase('ru-RU').includes(normalized)) : entries }, [entries, query])
  const remove = async (entry: JournalEntry) => { if (!window.confirm(`Удалить запись «${entry.title ?? formatDate(entry.entryDate)}»?`)) return; try { await deleteJournalEntry(entry.id); setSelected(null); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить запись') } }

  return <div className="journal-page">
    <section className="journal-toolbar"><div className="journal-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по записям" /></div><button className="primary-button" onClick={() => setEditing('new')}>+ Новая запись</button></section>
    <section className="journal-filters"><label>С даты<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>По дату<input type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></label><label>Тег<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">Все теги</option>{tags.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label><label className="pinned-filter"><input type="checkbox" checked={pinnedOnly} onChange={(event) => setPinnedOnly(event.target.checked)} />Только закреплённые</label>{(from || to || tag || pinnedOnly) && <button onClick={() => { setFrom(''); setTo(''); setTag(''); setPinnedOnly(false) }}>Сбросить</button>}</section>
    {error && <div className="notice error journal-error"><strong>Ошибка</strong><span>{error}</span></div>}
    <section className="journal-layout">
      <aside className="journal-list"><div className="journal-list-heading"><span>{visible.length} записей</span></div>{loading ? <div className="loading"><span /></div> : visible.length === 0 ? <div className="journal-empty">Записей не найдено.</div> : visible.map((entry) => <button className={selected?.id === entry.id ? 'active' : ''} key={entry.id} onClick={() => setSelected(entry)}><div><time>{formatDate(entry.entryDate)}</time>{entry.pinned && <span title="Закреплено">◆</span>}</div><strong>{entry.title ?? 'Без заголовка'}</strong><p>{excerpt(entry.content, 95)}</p><div className="entry-tags">{entry.tags.slice(0, 3).map((item) => <i key={item.id}>{item.name}</i>)}</div></button>)}</aside>
      <article className="journal-reader">{selected ? <><header><div><p className="eyebrow">{formatDate(selected.entryDate)}</p><h2>{selected.title ?? 'Без заголовка'}</h2></div><div><button onClick={() => setEditing(selected)}>✎ Редактировать</button><button onClick={() => void remove(selected)}>Удалить</button></div></header>{selected.tags.length > 0 && <div className="reader-tags">{selected.tags.map((item) => <span key={item.id}>#{item.name}</span>)}</div>}<div className="journal-content">{selected.content.split('\n').map((paragraph, index) => <p key={index}>{paragraph || <br />}</p>)}</div></> : <div className="reader-empty"><span>✎</span><h2>Ваш блог</h2><p>Выберите запись слева или создайте новую.</p></div>}</article>
    </section>
    {editing && <JournalForm entry={editing === 'new' ? undefined : editing} tags={tags} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
  </div>
}

function JournalForm({ entry, tags: initialTags, onClose, onSaved }: { entry?: JournalEntry; tags: Tag[]; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(entry?.entryDate ?? today)
  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [pinned, setPinned] = useState(entry?.pinned ?? false)
  const [tags, setTags] = useState(initialTags)
  const [selectedTags, setSelectedTags] = useState<number[]>(entry?.tags.map((item) => item.id) ?? [])
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addTag = async () => { const name = newTag.trim(); if (!name) return; try { const slug = name.toLocaleLowerCase('ru-RU').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, ''); const created = await createTag(name, slug); setTags((current) => [...current, created]); setSelectedTags((current) => [...current, created.id]); setNewTag('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось создать тег') } }
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(null); const input: JournalEntryInput = { entryDate: date, title: title || null, content, pinned }; try { const saved = entry ? await updateJournalEntry(entry.id, input) : await createJournalEntry(input); const currentIds = new Set(entry?.tags.map((item) => item.id) ?? []); const selectedIds = new Set(selectedTags); await Promise.all([...selectedIds].filter((id) => !currentIds.has(id)).map((id) => addJournalTag(saved.id, id))); await Promise.all([...currentIds].filter((id) => !selectedIds.has(id)).map((id) => removeJournalTag(saved.id, id))); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить запись') } finally { setSaving(false) } }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="journal-form" onSubmit={(event) => void submit(event)}><div className="form-heading"><div><p className="eyebrow">Блог</p><h2>{entry ? 'Редактирование' : 'Новая запись'}</h2></div><button type="button" onClick={onClose}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="journal-form-meta"><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /><label><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />Закрепить</label></div><input className="journal-title-input" maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Заголовок записи" /><textarea className="journal-editor" required value={content} onChange={(event) => setContent(event.target.value)} placeholder="О чём вы думаете сегодня?" />
    <fieldset className="tag-picker"><legend>Теги</legend><div>{tags.map((tag) => <label key={tag.id}><input type="checkbox" checked={selectedTags.includes(tag.id)} onChange={() => setSelectedTags((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])} />#{tag.name}</label>)}</div><div className="new-tag"><input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="Новый тег" /><button type="button" onClick={() => void addTag()}>Добавить</button></div></fieldset>
    <div className="form-buttons"><button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div></form></div>
}
