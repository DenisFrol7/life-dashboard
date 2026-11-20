import { useRef, useState, type FormEvent } from 'react'
import { createAnime, createShikimoriAnime, deleteAnime, previewShikimoriAnime, putAnimeLibrary, removeAnimeLibrary, searchShikimoriAnime, updateAnime, type AnimeDetails, type AnimeInput, type ShikimoriAnimeCandidate } from '../api/anime'
import type { LibraryInput, LibraryStatus, ReleaseStatus } from '../api/movies'
import { getApiErrorMessage } from '../api/client'
import { saveLibraryForm } from '../pages/libraryForm'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { useToast } from './ToastContext'
import { SeriesFormDialog } from './SeriesFormDialog'
import './AnimeForm.css'

const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю', COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено' }
const releaseLabels: Record<ReleaseStatus, string> = { ANNOUNCED: 'Анонсировано', ONGOING: 'Выходит', RELEASED: 'Вышло', ENDED: 'Завершено', CANCELLED: 'Отменено' }
const emptyAnime: AnimeInput = { title: '', originalTitle: null, releaseYear: null, description: null, coverUrl: null, releaseStatus: 'ONGOING' }
const emptyLibrary: LibraryInput = { status: 'PLANNED', rating: null, favorite: false, startedAt: null, completedAt: null, personalNote: null }
type Props = { anime?: AnimeDetails; returnFocusTo?: HTMLElement | null; onClose: () => void; onSaved: () => void; onDeleted?: () => void }

export function AnimeForm({ anime, returnFocusTo, onClose, onSaved, onDeleted }: Props) {
  const { showToast } = useToast()
  const savedAnimeRef = useRef(anime)
  const [item, setItem] = useState<AnimeInput>(anime ? { title: anime.title, originalTitle: anime.originalTitle, releaseYear: anime.releaseYear, description: anime.description, coverUrl: anime.coverUrl, releaseStatus: anime.releaseStatus } : emptyAnime)
  const [entry, setEntry] = useState<LibraryInput>(anime?.userStatus ? { status: anime.userStatus, rating: anime.rating, favorite: anime.favorite, startedAt: anime.startedAt, completedAt: anime.completedAt, personalNote: anime.personalNote } : emptyLibrary)
  const [inLibrary, setInLibrary] = useState(Boolean(anime?.userStatus) || !anime)
  const [searchQuery, setSearchQuery] = useState('')
  const [candidates, setCandidates] = useState<ShikimoriAnimeCandidate[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [episodeCount, setEpisodeCount] = useState<number | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { saving, deleting, pending } = mutations
  const catalogRequests = useLatestRequest()
  const created = !anime && Boolean(savedAnimeRef.current)
  const cancelCatalog = () => { catalogRequests.invalidate(); setSearching(false); setCandidates([]) }
  const changeSearchQuery = (value: string) => { cancelCatalog(); setSearchQuery(value) }
  const closeForm = () => { mutations.dispose(); catalogRequests.dispose(); onClose() }
  const setItemValue = <K extends keyof AnimeInput>(key: K, value: AnimeInput[K]) => { cancelCatalog(); setItem(current => ({ ...current, [key]: value })) }
  const setEntryValue = <K extends keyof LibraryInput>(key: K, value: LibraryInput[K]) => setEntry(current => ({ ...current, [key]: value }))
  const searchCatalog = async () => {
    const value = searchQuery.trim()
    if (pending || created || value.length < 2) return
    await catalogRequests.run(() => searchShikimoriAnime(value), {
      onStart: () => { setSearching(true); setError(null); setCandidates([]) },
      onSuccess: setCandidates,
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось выполнить поиск в Shikimori')),
      onFinish: () => setSearching(false),
    })
  }
  const selectCandidate = async (candidate: ShikimoriAnimeCandidate) => {
    if (pending || created || candidate.existingContentId) return
    await catalogRequests.run(() => previewShikimoriAnime(candidate.shikimoriId), {
      onStart: () => { setSearching(true); setError(null) },
      onSuccess: details => {
        setSelectedId(details.shikimoriId)
        setEpisodeCount(details.episodeCount)
        setItem({ title: details.title, originalTitle: details.originalTitle, releaseYear: details.releaseYear, description: details.description, coverUrl: details.coverUrl, releaseStatus: details.releaseStatus })
        setCandidates([])
      },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось загрузить данные Shikimori')),
      onFinish: () => setSearching(false),
    })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || searching) return
    setError(null)
    if (!item.title.trim()) { setError('Укажите название аниме.'); return }
    await mutations.run('save', () => saveLibraryForm({
      title: anime?.title ?? item.title, inLibrary, wasInLibrary: Boolean(anime?.userStatus),
      saveItem: async () => {
        const saved = savedAnimeRef.current ? await updateAnime(savedAnimeRef.current.id, item) : selectedId ? await createShikimoriAnime(selectedId, item) : await createAnime(item)
        savedAnimeRef.current = saved
        return saved
      },
      putLibrary: id => putAnimeLibrary(id, entry), removeLibrary: removeAnimeLibrary,
    }), {
      onSuccess: saved => { if (saved) { showToast(anime ? 'Аниме обновлено' : 'Аниме добавлено'); onSaved() } },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось сохранить аниме')),
    })
  }
  const remove = async () => {
    if (!anime || pending || searching) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить «${anime.title}» вместе с сезонами?`)) return false
      await deleteAnime(anime.id)
      return true
    }, {
      onSuccess: deleted => { if (deleted) { showToast('Аниме удалено'); (onDeleted ?? onSaved)() } },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось удалить аниме')),
    })
  }
  return <SeriesFormDialog title={anime ? 'Редактирование аниме' : 'Новое аниме'} eyebrow="Аниме" wide returnFocusTo={returnFocusTo} pending={pending} error={error} onClose={closeForm} onSubmit={event => void submit(event)} actions={<>
    {anime && <button className="movie-dialog-delete" type="button" disabled={pending || searching} onClick={() => void remove()}>{deleting ? 'Удаляем…' : 'Удалить аниме'}</button>}
    <button className="secondary-button" type="button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending || searching}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
  </>}>
    <p className="anime-form-rule">Только многосерийное аниме. Полнометражные работы добавляются в раздел «Фильмы» как мультфильмы.</p>
    {!anime && <section className="anime-form-search" aria-label="Поиск аниме в Shikimori"><div><label>Поиск в Shikimori<input value={searchQuery} disabled={created} onChange={event => changeSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void searchCatalog() } }} placeholder="Введите название аниме" /></label><button className="secondary-button" type="button" disabled={pending || searching || created || searchQuery.trim().length < 2} onClick={() => void searchCatalog()}>{searching ? 'Ищем…' : 'Найти в Shikimori'}</button></div>
      {created ? <p role="status">Аниме уже создано. Повторное сохранение обновит его данные и библиотеку.</p> : selectedId && <p role="status">Данные загружены. Будет создано эпизодов: {episodeCount ?? 0}. Проверьте поля и укажите личный статус.</p>}
      {candidates.length > 0 && <div className="anime-form-results">{candidates.map(candidate => <button type="button" key={candidate.shikimoriId} disabled={pending || searching || created || Boolean(candidate.existingContentId)} onClick={() => void selectCandidate(candidate)}><span className="anime-form-candidate-cover" aria-hidden="true">◇{candidate.coverUrl && <img src={candidate.coverUrl} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true }} />}</span><span><strong>{candidate.title}</strong><small>{candidate.originalTitle && candidate.originalTitle !== candidate.title ? `${candidate.originalTitle} · ` : ''}{candidate.kind ?? 'anime'}{candidate.existingContentId ? ' · Уже в каталоге' : ''}</small></span></button>)}</div>}
    </section>}
    <label>Название<input required maxLength={300} value={item.title} onChange={event => setItemValue('title', event.target.value)} /></label>
    <label>Оригинальное название<input maxLength={300} value={item.originalTitle ?? ''} onChange={event => setItemValue('originalTitle', event.target.value || null)} /></label>
    <div className="series-editor-grid"><label>Год<input min="1900" step="1" type="number" inputMode="numeric" value={item.releaseYear ?? ''} onChange={event => setItemValue('releaseYear', event.target.value ? Number(event.target.value) : null)} /></label><label>Статус выпуска<select value={item.releaseStatus} onChange={event => setItemValue('releaseStatus', event.target.value as ReleaseStatus)}>{Object.entries(releaseLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
    <label>URL обложки<input type="url" value={item.coverUrl ?? ''} onChange={event => setItemValue('coverUrl', event.target.value || null)} /></label>
    <label>Описание<textarea rows={4} value={item.description ?? ''} onChange={event => setItemValue('description', event.target.value || null)} /></label>
    <fieldset className="series-editor-section"><legend>Моя библиотека</legend><label className="series-editor-checkbox"><input type="checkbox" checked={inLibrary} onChange={event => setInLibrary(event.target.checked)} />Добавить в библиотеку</label>{inLibrary && <><div className="series-editor-grid"><label>Статус<select value={entry.status} onChange={event => setEntryValue('status', event.target.value as LibraryStatus)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Оценка<select value={entry.rating ?? ''} onChange={event => setEntryValue('rating', event.target.value ? Number(event.target.value) : null)}><option value="">Без оценки</option>{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <option key={value}>{value}</option>)}</select></label></div><label className="series-editor-checkbox"><input type="checkbox" checked={entry.favorite} onChange={event => setEntryValue('favorite', event.target.checked)} />В избранном</label><label>Заметка<textarea rows={3} value={entry.personalNote ?? ''} onChange={event => setEntryValue('personalNote', event.target.value || null)} /></label></>}</fieldset>
  </SeriesFormDialog>
}
