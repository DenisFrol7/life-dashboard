import { useEffect, useState, type FormEvent } from 'react'
import { createGameSession, deleteGameSession, getXboxAchievementGroups, initializeXboxProgress, updateGameSession, type GameLibrary, type GameSession, type XboxAchievementGroup } from '../api/games'
import { getApiErrorMessage } from '../api/client'
import { useFormMutation } from '../hooks/useFormMutation'
import { SeriesFormDialog } from './SeriesFormDialog'
import { useToast } from './ToastContext'
import './GameSessionForm.css'

const localDateTime = (value: string) => {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const supportsXboxProgress = (entry: GameLibrary) => entry.platform.code.startsWith('XBOX_') || entry.platform.code === 'ORIGINAL_XBOX'
  || entry.platform.code === 'PC' && ['MICROSOFT_STORE', 'GAME_PASS'].includes(entry.source.code)

export function GameSessionForm({ session, library, onClose, onSaved }: {
  session?: GameSession; library: GameLibrary[]; onClose: () => void; onSaved: () => void
}) {
  const { showToast } = useToast()
  const [initialStartedAt] = useState(() => session?.startedAt ?? new Date().toISOString())
  const [startedAt, setStartedAt] = useState(() => localDateTime(initialStartedAt))
  const [libraryId, setLibraryId] = useState(session?.libraryEntryId ?? library[0]?.id ?? 0)
  const [duration, setDuration] = useState(String(session?.durationMinutes ?? 60))
  const [note, setNote] = useState(session?.note ?? '')
  const [achievements, setAchievements] = useState(String(session?.unlockedAchievements ?? 0))
  const [gamerscore, setGamerscore] = useState(String(session?.earnedGamerscore ?? 0))
  const [groupId, setGroupId] = useState(session?.achievementGroupId ?? null)
  const [groupState, setGroupState] = useState<{ libraryId: number; values: XboxAchievementGroup[]; loading: boolean; error: string | null }>({ libraryId: 0, values: [], loading: false, error: null })
  const [groupRetry, setGroupRetry] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { pending, saving, deleting } = mutations
  const selectedEntry = library.find(entry => entry.id === libraryId)
  const achievementsEnabled = selectedEntry ? supportsXboxProgress(selectedEntry) : false
  const xboxTitleId = selectedEntry?.xboxTitleId
  const groups = groupState.libraryId === libraryId ? groupState.values : []
  const loadingGroups = achievementsEnabled && (groupState.libraryId !== libraryId || groupState.loading)
  const groupsError = groupState.libraryId === libraryId ? groupState.error : null
  const achievementValuesEntered = Number(achievements) > 0 || Number(gamerscore) > 0
  const cannotSave = pending || loadingGroups || !selectedEntry || (achievementValuesEntered && !groups.some(group => group.id === groupId))
  const close = () => { if (!pending) { mutations.dispose(); onClose() } }

  useEffect(() => {
    let active = true
    if (!achievementsEnabled) return
    setGroupState({ libraryId, values: [], loading: true, error: null })
    void (async () => {
      try {
        let values = await getXboxAchievementGroups(libraryId)
        if (!active) return
        if (values.length === 0 && xboxTitleId != null) {
          await initializeXboxProgress(libraryId)
          if (!active) return
          values = await getXboxAchievementGroups(libraryId)
        }
        if (!active) return
        setGroupState({ libraryId, values, loading: false, error: null })
        setGroupId(current => values.some(value => value.id === current) ? current : values.find(value => value.groupType === 'BASE_GAME')?.id ?? null)
      } catch (reason) {
        if (active) setGroupState({ libraryId, values: [], loading: false, error: getApiErrorMessage(reason, 'Не удалось подготовить разделы достижений') })
      }
    })()
    return () => { active = false }
  }, [achievementsEnabled, libraryId, xboxTitleId, groupRetry])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (cannotSave) return
    setError(null)
    const date = new Date(startedAt)
    if (!startedAt || !Number.isFinite(date.getTime())) { setError('Укажите дату и время начала сессии.'); return }
    const durationMinutes = Number(duration), unlockedAchievements = Number(achievements), earnedGamerscore = Number(gamerscore)
    if (![duration, achievements, gamerscore].every(value => value.trim()) || ![durationMinutes, unlockedAchievements, earnedGamerscore].every(value => Number.isInteger(value) && value >= 0 && value <= 2_147_483_647) || durationMinutes < 1) {
      setError('Укажите длительность целым числом от 1 минуты, а достижения и Gamerscore — целыми неотрицательными числами.')
      return
    }
    const input = {
      startedAt: startedAt === localDateTime(initialStartedAt) ? initialStartedAt : date.toISOString(),
      durationMinutes, note: note || null, unlockedAchievements, earnedGamerscore,
      achievementGroupId: unlockedAchievements === 0 && earnedGamerscore === 0 ? null : groupId,
    }
    await mutations.run('save', () => session ? updateGameSession(session.id, input) : createGameSession(libraryId, input), {
      onSuccess: () => { showToast(session ? 'Игровая сессия обновлена' : 'Игровая сессия добавлена'); onSaved() },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось сохранить игровую сессию')),
    })
  }
  const remove = async () => {
    if (!session || pending) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm('Удалить игровую сессию?')) return false
      await deleteGameSession(session.id)
      return true
    }, {
      onSuccess: removed => { if (removed) { showToast('Игровая сессия удалена'); onSaved() } },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось удалить игровую сессию')),
    })
  }
  return <SeriesFormDialog title={session ? 'Редактирование сессии' : 'Новая сессия'} eyebrow="Игровое время" context={selectedEntry?.title ?? session?.title}
    error={error} pending={pending} closeDisabled={pending} onClose={close} onSubmit={event => void submit(event)} actions={<>
      {session && <button type="button" className="movie-dialog-delete" disabled={pending} onClick={() => void remove()}>{deleting ? 'Удаляем…' : 'Удалить сессию'}</button>}
      <button type="button" className="secondary-button" disabled={pending} onClick={close}>Отмена</button>
      <button type="submit" className="primary-button" disabled={cannotSave}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
    </>}>
    <label>Игра и платформа<select required disabled={Boolean(session) || library.length === 1} value={selectedEntry ? libraryId : ''} onChange={event => {
      setLibraryId(Number(event.target.value)); setGroupId(null); setAchievements('0'); setGamerscore('0'); setError(null)
    }}><option value="" disabled>Выберите копию игры</option>{library.map(entry => <option key={entry.id} value={entry.id}>{entry.title} · {entry.platform.name} · {entry.source.name}</option>)}</select></label>
    {selectedEntry && <p className="series-editor-hint">{selectedEntry.platform.name} · {selectedEntry.source.name}</p>}
    <div className="series-editor-grid">
      <label>Начало<input required type="datetime-local" value={startedAt} onChange={event => setStartedAt(event.target.value)} /></label>
      <label>Продолжительность, минут<input required min={1} max={2_147_483_647} step={1} type="number" inputMode="numeric" value={duration} onChange={event => setDuration(event.target.value)} /></label>
    </div>
    {achievementsEnabled && <fieldset className="series-editor-section"><legend>Получено за эту сессию</legend>
      {loadingGroups && <p className="series-editor-hint" role="status">Подготавливаем разделы достижений…</p>}
      {groupsError && <><p className="form-error" role="alert">{groupsError}</p><button type="button" className="secondary-button game-session-retry" onClick={() => setGroupRetry(value => value + 1)}>Повторить загрузку разделов</button></>}
      {!loadingGroups && groups.length === 0 && <p className="series-editor-hint">{groupsError ? 'Можно сохранить сессию без достижений или повторить загрузку разделов.' : 'Можно сохранить сессию без достижений. Для их добавления сначала настройте прогресс Xbox у этой копии игры.'}</p>}
      <label>Раздел достижений<select required={achievementValuesEntered} disabled={loadingGroups || groups.length === 0} value={groupId ?? ''} onChange={event => setGroupId(Number(event.target.value))}>
        <option value="" disabled>{loadingGroups ? 'Подготавливаем разделы…' : groups.length ? 'Выберите раздел' : 'Разделы недоступны'}</option>
        {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select></label>
      <div className="series-editor-grid">
        <label>Достижений<input required min={0} max={2_147_483_647} step={1} type="number" inputMode="numeric" disabled={loadingGroups || groups.length === 0} value={achievements} onChange={event => setAchievements(event.target.value)} /></label>
        <label>Gamerscore<input required min={0} max={2_147_483_647} step={1} type="number" inputMode="numeric" disabled={loadingGroups || groups.length === 0} value={gamerscore} onChange={event => setGamerscore(event.target.value)} /></label>
      </div>
    </fieldset>}
    <label>Заметка<textarea maxLength={5000} rows={4} value={note} onChange={event => setNote(event.target.value)} /></label>
  </SeriesFormDialog>
}
