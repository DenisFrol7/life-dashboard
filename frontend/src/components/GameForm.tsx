import { useRef, useState, type FormEvent } from 'react'
import { createGame, createGameLibrary, createRawgGame, deleteGame, getSteamGridDbCovers, previewRawgGame, putGameProfile, putXboxProgress, searchRawgGames, searchSteamGridDbGames, updateGame, updateGameLibrary, updateRawgGame, type Game, type GameInput, type GameLibrary, type GameLibraryInput, type RawgGameCandidate, type Reference, type SteamGridDbCoverCandidate, type SteamGridDbGameCandidate, type XboxProgressInput } from '../api/games'
import type { LibraryInput, LibraryStatus } from '../api/movies'
import { getApiErrorMessage } from '../api/client'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { SeriesFormDialog } from './SeriesFormDialog'
import { useToast } from './ToastContext'
import './GameForm.css'

const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Играю', COMPLETED: 'Пройдено', PAUSED: 'На паузе', DROPPED: 'Брошено' }
const emptyGame: GameInput = { title: '', originalTitle: null, itemType: 'GAME', format: null, releaseYear: null, description: null, coverUrl: null, backgroundUrl: null, durationMinutes: null, releaseStatus: 'RELEASED', genre: null, developer: null, releaseDate: null, xboxPlayAnywhere: false, steamGridDbGameId: null, steamGridDbGridId: null }
const emptyProgress: XboxProgressInput = { totalAchievements: 0, unlockedAchievements: 0, totalGamerscore: 0, earnedGamerscore: 0 }
const localDate = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export function GameForm({ game, library, platforms, sources, progress, onClose, onSaved, onDeleted }: {
  game?: Game; library?: GameLibrary; platforms: Reference[]; sources: Reference[]; progress?: XboxProgressInput | null
  onClose: () => void; onSaved: () => void; onDeleted?: () => void
}) {
  const { showToast } = useToast()
  const savedGameRef = useRef(game)
  const savedLibraryRef = useRef(library)
  const changedRef = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const [item, setItem] = useState<GameInput>(game ? { ...game } : emptyGame)
  const defaultSource = library?.source.id ?? sources[0]?.id ?? 0
  const [entry, setEntry] = useState<GameLibraryInput>({
    platformId: library?.platform.id ?? platforms[0]?.id ?? 0, sourceId: defaultSource,
    accessType: library?.accessType ?? (sources.find(source => source.id === defaultSource)?.type === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'OWNED'),
    edition: library?.edition ?? null, acquiredAt: library?.acquiredAt ?? null, note: library?.note ?? null,
    legacyPlaytimeMinutes: library?.legacyPlaytimeMinutes ?? 0, status: library?.status ?? 'NOT_STARTED', startedAt: library?.startedAt ?? null, completedAt: library?.completedAt ?? null,
  })
  const [profile, setProfile] = useState<LibraryInput>({ status: library?.status ?? 'NOT_STARTED', rating: library?.rating ?? null, favorite: library?.favorite ?? false, startedAt: library?.startedAt ?? null, completedAt: library?.completedAt ?? null, personalNote: library?.personalNote ?? null })
  const [xboxProgress, setXboxProgress] = useState<XboxProgressInput>(() => progress ? {
    totalAchievements: progress.totalAchievements, unlockedAchievements: progress.unlockedAchievements,
    totalGamerscore: progress.totalGamerscore, earnedGamerscore: progress.earnedGamerscore,
  } : emptyProgress)
  const [inLibrary, setInLibrary] = useState(Boolean(library) || !game)
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { saving, deleting, pending } = mutations
  const [catalogQuery, setCatalogQuery] = useState('')
  const [candidates, setCandidates] = useState<RawgGameCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searchCompleted, setSearchCompleted] = useState(false)
  const [selectedRawgId, setSelectedRawgId] = useState(game?.rawgId ?? null)
  const [artworkQuery, setArtworkQuery] = useState(game?.originalTitle ?? game?.title ?? '')
  const [artworkGames, setArtworkGames] = useState<SteamGridDbGameCandidate[]>([])
  const [artworkCovers, setArtworkCovers] = useState<SteamGridDbCoverCandidate[]>([])
  const [artworkSearching, setArtworkSearching] = useState(false)
  const [artworkCompleted, setArtworkCompleted] = useState(false)
  const catalogRequests = useLatestRequest()
  const artworkRequests = useLatestRequest()
  const created = !game && Boolean(savedGameRef.current)
  const busy = pending || searching || artworkSearching
  const selectedPlatform = platforms.find(value => value.id === entry.platformId)
  const selectedSource = sources.find(value => value.id === entry.sourceId)
  const xboxEnabled = Boolean(selectedPlatform && selectedSource && (selectedPlatform.code.startsWith('XBOX_') || selectedPlatform.code === 'ORIGINAL_XBOX' || selectedPlatform.code === 'PC' && ['MICROSOFT_STORE', 'GAME_PASS'].includes(selectedSource.code)))
  const compatibleSources = sources.filter(value => entry.accessType === 'SUBSCRIPTION' ? value.type === 'SUBSCRIPTION' : value.type !== 'SUBSCRIPTION')
  const cancelCatalog = () => { catalogRequests.invalidate(); setSearching(false); setCandidates([]); setSearchCompleted(false) }
  const cancelArtwork = () => { artworkRequests.invalidate(); setArtworkSearching(false); setArtworkGames([]); setArtworkCovers([]); setArtworkCompleted(false) }
  const changeCatalogQuery = (value: string) => { cancelCatalog(); setCatalogQuery(value) }
  const changeArtworkQuery = (value: string) => { cancelArtwork(); setArtworkQuery(value) }
  const closeForm = () => {
    if (pending) return
    mutations.dispose(); catalogRequests.dispose(); artworkRequests.dispose()
    if (changedRef.current) onSaved(); else onClose()
  }
  const setItemValue = <K extends keyof GameInput>(key: K, value: GameInput[K]) => {
    if (key !== 'coverUrl' && key !== 'xboxPlayAnywhere') cancelCatalog()
    if (key === 'coverUrl') { artworkRequests.invalidate(); setArtworkSearching(false) }
    setItem(current => ({ ...current, [key]: value, ...(key === 'coverUrl' ? { steamGridDbGameId: null, steamGridDbGridId: null } : {}) }))
  }
  const setEntryValue = <K extends keyof GameLibraryInput>(key: K, value: GameLibraryInput[K]) => setEntry(current => ({ ...current, [key]: value }))
  const setProfileValue = <K extends keyof LibraryInput>(key: K, value: LibraryInput[K]) => setProfile(current => ({ ...current, [key]: value }))
  const searchRawg = async () => {
    const value = catalogQuery.trim()
    if (pending || created || value.length < 2) return
    await catalogRequests.run(() => searchRawgGames(value), {
      onStart: () => { setSearching(true); setSearchCompleted(false); setError(null); setCandidates([]) },
      onSuccess: results => { setCandidates(results); setSearchCompleted(true) },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось выполнить поиск в RAWG')),
      onFinish: () => setSearching(false),
    })
  }
  const selectRawgCandidate = async (candidate: RawgGameCandidate) => {
    if (pending || created || candidate.existingContentId != null && candidate.existingContentId !== savedGameRef.current?.id) return
    await catalogRequests.run(() => previewRawgGame(candidate.rawgId), {
      onStart: () => { setSearching(true); setError(null); cancelArtwork() },
      onSuccess: details => {
        if (details.existingContentId != null && details.existingContentId !== savedGameRef.current?.id) { setError('Эта игра RAWG уже связана с другой записью каталога'); return }
        setItem(current => ({ ...current, title: details.title, originalTitle: details.originalTitle, releaseYear: details.releaseYear, description: details.description, backgroundUrl: details.backgroundUrl, releaseStatus: details.releaseStatus, genre: details.genre, developer: details.developer, releaseDate: details.releaseDate }))
        changeArtworkQuery(details.originalTitle ?? details.title)
        setSelectedRawgId(details.rawgId); setCandidates([]); setSearchCompleted(false)
        titleRef.current?.focus({ preventScroll: true })
      },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось загрузить карточку RAWG')),
      onFinish: () => setSearching(false),
    })
  }
  const searchArtwork = async () => {
    const value = artworkQuery.trim()
    if (pending || value.length < 2) return
    await artworkRequests.run(() => searchSteamGridDbGames(value), {
      onStart: () => { setArtworkSearching(true); setArtworkCompleted(false); setError(null); setArtworkGames([]); setArtworkCovers([]) },
      onSuccess: results => { setArtworkGames(results); setArtworkCompleted(true) },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось выполнить поиск в SteamGridDB')),
      onFinish: () => setArtworkSearching(false),
    })
  }
  const selectArtworkGame = async (candidate: SteamGridDbGameCandidate) => {
    if (pending) return
    await artworkRequests.run(() => getSteamGridDbCovers(candidate.steamGridDbId), {
      onStart: () => { setArtworkSearching(true); setArtworkCompleted(false); setError(null); setArtworkCovers([]) },
      onSuccess: covers => { setArtworkCovers(covers); setArtworkGames([]); if (!covers.length) setError('Для этой игры нет вертикальных обложек 600×900') },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось загрузить обложки SteamGridDB')),
      onFinish: () => setArtworkSearching(false),
    })
  }
  const selectArtworkCover = (cover: SteamGridDbCoverCandidate) => {
    if (pending) return
    artworkRequests.invalidate(); setArtworkSearching(false)
    setItem(current => ({ ...current, coverUrl: cover.imageUrl, steamGridDbGameId: cover.steamGridDbGameId, steamGridDbGridId: cover.gridId }))
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError(null)
    if (!item.title.trim()) { setError('Укажите название игры.'); return }
    if (inLibrary && (!selectedPlatform || !compatibleSources.some(source => source.id === entry.sourceId))) { setError('Выберите платформу и подходящий источник игры.'); return }
    if (inLibrary && xboxEnabled && (!Object.values(xboxProgress).every(value => Number.isInteger(value) && value >= 0 && value <= 2_147_483_647) || xboxProgress.unlockedAchievements > xboxProgress.totalAchievements || xboxProgress.earnedGamerscore > xboxProgress.totalGamerscore)) { setError('Проверьте Xbox-прогресс: полученные достижения и Gamerscore не могут превышать общее количество.'); return }
    await mutations.run('save', async () => {
      const previous = savedGameRef.current
      const savedGame = previous
        ? selectedRawgId && selectedRawgId !== previous.rawgId ? await updateRawgGame(previous.id, selectedRawgId, item) : await updateGame(previous.id, item)
        : selectedRawgId ? await createRawgGame(selectedRawgId, item) : await createGame(item)
      savedGameRef.current = savedGame; changedRef.current = true
      if (inLibrary) {
        const copyProgress = { ...entry, status: profile.status, startedAt: profile.startedAt, completedAt: profile.completedAt }
        const savedEntry = savedLibraryRef.current ? await updateGameLibrary(savedLibraryRef.current.id, copyProgress) : await createGameLibrary(savedGame.id, copyProgress)
        savedLibraryRef.current = savedEntry
        await putGameProfile(savedGame.id, profile)
        if (xboxEnabled) await putXboxProgress(savedEntry.id, xboxProgress)
      }
    }, {
      onSuccess: () => { showToast(game ? 'Игра обновлена' : 'Игра добавлена'); onSaved() },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось сохранить игру')),
    })
  }
  const remove = async () => {
    if (!game || busy) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить «${game.title}» из общего каталога?`)) return false
      await deleteGame(game.id)
      return true
    }, {
      onSuccess: deleted => { if (deleted) { showToast('Игра удалена'); (onDeleted ?? onSaved)() } },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось удалить игру')),
    })
  }

  return <SeriesFormDialog title={game ? 'Редактирование игры' : 'Новая игра'} eyebrow="Игры" context={game?.title} wide error={error} pending={pending} closeDisabled={pending} onClose={closeForm} onSubmit={event => void submit(event)} actions={<>
    {game && <button type="button" className="movie-dialog-delete" disabled={busy} onClick={() => void remove()}>{deleting ? 'Удаляем…' : 'Удалить игру'}</button>}
    <button type="button" className="secondary-button" disabled={pending} onClick={closeForm}>Отмена</button><button type="submit" className="primary-button" disabled={busy}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
  </>}>
    <fieldset className="series-editor-section game-editor-search"><legend>Поиск в RAWG</legend>
      <div className="game-editor-search-row"><label>Название игры в RAWG<input value={catalogQuery} disabled={created} placeholder="Введите название игры" onChange={event => changeCatalogQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void searchRawg() } }} /></label>
        <button type="button" className="secondary-button" disabled={created || searching || catalogQuery.trim().length < 2} onClick={() => void searchRawg()}>{searching ? 'Ищем…' : 'Найти в RAWG'}</button></div>
      {searching && <p className="series-editor-hint" role="status">Загружаем данные RAWG…</p>}
      {created ? <p className="series-editor-hint">Карточка игры уже создана. Повторите сохранение, чтобы завершить запись данных копии.</p> : selectedRawgId && <p className="series-editor-hint">Игра связана с RAWG. Проверьте заполненные данные перед сохранением.</p>}
      {candidates.length > 0 && <ul className="game-editor-results" aria-label="Результаты поиска RAWG">{candidates.map(candidate => {
        const duplicate = candidate.existingContentId != null && candidate.existingContentId !== savedGameRef.current?.id
        return <li key={candidate.rawgId}><button type="button" data-rawg-id={candidate.rawgId} disabled={duplicate || searching} onClick={() => void selectRawgCandidate(candidate)}>
          <span className="game-editor-result-image" aria-hidden="true">🎮{candidate.backgroundUrl && <img src={candidate.backgroundUrl} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true }} />}</span>
          <span><strong>{candidate.title}</strong><small>{candidate.releaseDate?.slice(0, 4) ?? 'Год не указан'}{candidate.platforms.length ? ` · ${candidate.platforms.join(', ')}` : ''}{duplicate ? ' · Уже в каталоге' : ''}</small></span>
        </button></li>
      })}</ul>}
      {searchCompleted && candidates.length === 0 && <p className="series-editor-hint" role="status">Игра не найдена в RAWG. Можно заполнить данные вручную.</p>}
      {(candidates.length > 0 || selectedRawgId) && <a className="game-editor-attribution" href="https://rawg.io" target="_blank" rel="noreferrer">Данные и изображения: <strong>RAWG</strong><span aria-hidden="true">↗</span></a>}
    </fieldset>
    <fieldset className="series-editor-section game-editor-artwork"><legend>Вертикальная обложка SteamGridDB</legend>
      <div className="game-editor-search-row"><label>Название игры для поиска обложки<input value={artworkQuery} placeholder="Введите название игры" onChange={event => changeArtworkQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void searchArtwork() } }} /></label>
        <button type="button" className="secondary-button" disabled={artworkSearching || artworkQuery.trim().length < 2} onClick={() => void searchArtwork()}>{artworkSearching ? 'Ищем…' : 'Найти обложку'}</button></div>
      {artworkSearching && <p className="series-editor-hint" role="status">Загружаем обложки SteamGridDB…</p>}
      {artworkGames.length > 0 && <ul className="game-editor-results" aria-label="Игры SteamGridDB">{artworkGames.map(candidate => <li key={candidate.steamGridDbId}><button type="button" data-artwork-id={candidate.steamGridDbId} disabled={artworkSearching} onClick={() => void selectArtworkGame(candidate)}><span className="game-editor-result-image" aria-hidden="true">▥</span><span><strong>{candidate.name}</strong><small>{candidate.verified ? 'Проверенная запись' : 'Запись сообщества'}{candidate.types.length ? ` · ${candidate.types.join(', ')}` : ''}</small></span></button></li>)}</ul>}
      {artworkCompleted && artworkGames.length === 0 && !artworkSearching && <p className="series-editor-hint" role="status">Игра не найдена в SteamGridDB. Можно указать URL обложки ниже.</p>}
      {artworkCovers.length > 0 && <ul className="game-editor-covers" aria-label="Вертикальные обложки">{artworkCovers.map((cover, index) => <li key={cover.gridId}><button type="button" data-cover-id={cover.gridId} aria-pressed={item.steamGridDbGridId === cover.gridId} aria-label={`Выбрать обложку ${index + 1}${cover.authorName ? `, автор: ${cover.authorName}` : ''}`} onClick={() => selectArtworkCover(cover)}><span className="game-editor-cover-image" aria-hidden="true">▥<img src={cover.thumbnailUrl ?? cover.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true }} /></span>{item.steamGridDbGridId === cover.gridId && <span className="game-editor-cover-selected">Выбрано</span>}</button></li>)}</ul>}
      {item.coverUrl && <div className="game-editor-cover-preview"><span className="game-editor-cover-image" aria-hidden="true">▥<img key={item.coverUrl} src={item.coverUrl} alt="" onError={event => { event.currentTarget.hidden = true }} /></span><div><strong>Выбранная обложка</strong><button type="button" className="secondary-button" onClick={() => setItemValue('coverUrl', null)}>Убрать обложку</button></div></div>}
      <label>URL вертикальной обложки<input type="url" value={item.coverUrl ?? ''} onChange={event => setItemValue('coverUrl', event.target.value || null)} /></label>
      {(artworkCovers.length > 0 || item.steamGridDbGridId) && <a className="game-editor-attribution" href={item.steamGridDbGridId ? `https://www.steamgriddb.com/grid/${item.steamGridDbGridId}` : 'https://www.steamgriddb.com'} target="_blank" rel="noreferrer">Обложки: <strong>SteamGridDB</strong><span aria-hidden="true">↗</span></a>}
    </fieldset>
    <fieldset className="series-editor-section game-editor-details"><legend>Данные игры</legend>
      <label>Название<input ref={titleRef} required maxLength={300} value={item.title} onChange={event => setItemValue('title', event.target.value)} /></label>
      <label>Разработчик<input maxLength={200} value={item.developer ?? ''} onChange={event => setItemValue('developer', event.target.value || null)} /></label>
      <div className="series-editor-grid"><label>Дата выхода<input type="date" value={item.releaseDate ?? ''} onChange={event => { cancelCatalog(); setItem(current => ({ ...current, releaseDate: event.target.value || null, releaseYear: event.target.value ? Number(event.target.value.slice(0, 4)) : null })) }} /></label><label>Жанр<input maxLength={100} value={item.genre ?? ''} onChange={event => setItemValue('genre', event.target.value || null)} /></label></div>
      <label>Описание<textarea rows={4} value={item.description ?? ''} onChange={event => setItemValue('description', event.target.value || null)} /></label>
    </fieldset>
    <fieldset className="series-editor-section game-editor-library"><legend>Игра и выбранная копия</legend>
      <label className="series-editor-checkbox"><input type="checkbox" checked={inLibrary} onChange={event => setInLibrary(event.target.checked)} />{library ? 'Изменить выбранную копию' : 'Добавить в библиотеку'}</label>
      {library && !inLibrary && <p className="series-editor-hint">Сохранятся только изменения карточки игры. Копия останется в библиотеке.</p>}
      {inLibrary && <>
        <div className="series-editor-grid"><label>Платформа<select required value={selectedPlatform ? entry.platformId : ''} onChange={event => setEntryValue('platformId', Number(event.target.value))}><option value="" disabled>Выберите платформу</option>{platforms.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <label>Тип доступа<select value={entry.accessType} onChange={event => { const accessType = event.target.value as GameLibraryInput['accessType']; const source = sources.find(value => accessType === 'SUBSCRIPTION' ? value.type === 'SUBSCRIPTION' : value.type !== 'SUBSCRIPTION'); setEntry(current => ({ ...current, accessType, sourceId: source?.id ?? 0 })) }}><option value="OWNED">Куплена</option><option value="SUBSCRIPTION">Подписка</option></select></label>
          <label>Источник<select required value={compatibleSources.some(source => source.id === entry.sourceId) ? entry.sourceId : ''} onChange={event => setEntryValue('sourceId', Number(event.target.value))}><option value="" disabled>Выберите источник</option>{compatibleSources.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
          <label>Издание<input maxLength={200} value={entry.edition ?? ''} onChange={event => setEntryValue('edition', event.target.value || null)} /></label>
          <label>Статус выбранной копии<select value={profile.status} onChange={event => { const status = event.target.value as LibraryStatus; setProfile(current => ({ ...current, status, completedAt: status === 'COMPLETED' && !current.completedAt ? new Date().toISOString() : current.completedAt })) }}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Оценка<select value={profile.rating ?? ''} onChange={event => setProfileValue('rating', event.target.value ? Number(event.target.value) : null)}><option value="">Без оценки</option>{profile.rating === 0 && <option value={0}>0</option>}{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Дата прохождения выбранной копии<input disabled={profile.status !== 'COMPLETED'} type="date" value={localDate(profile.completedAt)} onChange={event => setProfileValue('completedAt', event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null)} /></label>
        </div>
        <div className="game-editor-flags"><label className="series-editor-checkbox"><input type="checkbox" checked={profile.favorite} onChange={event => setProfileValue('favorite', event.target.checked)} />В избранном</label>{xboxEnabled && <label className="series-editor-checkbox"><input type="checkbox" checked={item.xboxPlayAnywhere} onChange={event => setItemValue('xboxPlayAnywhere', event.target.checked)} />Xbox Play Anywhere</label>}</div>
        <label>Личная заметка<textarea rows={3} value={profile.personalNote ?? ''} onChange={event => setProfileValue('personalNote', event.target.value || null)} /></label>
      </>}
    </fieldset>
    {inLibrary && xboxEnabled && <fieldset className="series-editor-section game-editor-xbox"><legend>Xbox-прогресс</legend><div className="series-editor-grid">
      <label>Получено достижений<input required min={0} max={xboxProgress.totalAchievements} step={1} type="number" inputMode="numeric" value={xboxProgress.unlockedAchievements} onChange={event => setXboxProgress(current => ({ ...current, unlockedAchievements: Number(event.target.value) }))} /></label>
      <label>Всего достижений<input required min={0} max={2_147_483_647} step={1} type="number" inputMode="numeric" value={xboxProgress.totalAchievements} onChange={event => setXboxProgress(current => ({ ...current, totalAchievements: Number(event.target.value) }))} /></label>
      <label>Получено Gamerscore<input required min={0} max={xboxProgress.totalGamerscore} step={1} type="number" inputMode="numeric" value={xboxProgress.earnedGamerscore} onChange={event => setXboxProgress(current => ({ ...current, earnedGamerscore: Number(event.target.value) }))} /></label>
      <label>Всего Gamerscore<input required min={0} max={2_147_483_647} step={1} type="number" inputMode="numeric" value={xboxProgress.totalGamerscore} onChange={event => setXboxProgress(current => ({ ...current, totalGamerscore: Number(event.target.value) }))} /></label>
    </div></fieldset>}
  </SeriesFormDialog>
}
