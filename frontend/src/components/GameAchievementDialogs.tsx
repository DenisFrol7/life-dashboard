import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Check, Lock } from 'lucide-react'
import { createXboxAchievementGroup, deleteXboxAchievementGroup, updateXboxAchievementGroup, type SteamProgress, type XboxAchievement, type XboxAchievementGroup, type XboxAchievementGroupInput, type XboxProgress } from '../api/games'
import { getApiErrorMessage } from '../api/client'
import { useFormMutation } from '../hooks/useFormMutation'
import { MovieDialog } from './MovieDialog'
import './GameAchievementDialogs.css'

const formatDate = (value: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value)) : 'Дата не указана'
const percentage = (value: number) => Math.round(Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0)
const activeElement = () => document.activeElement instanceof HTMLElement ? document.activeElement : null

function AchievementListDialog({ provider, gameTitle, unlocked, total, percent, gamerscore, children, onClose }: {
  provider: 'Steam' | 'Xbox'; gameTitle: string; unlocked: number; total: number; percent: number
  gamerscore?: string; children: ReactNode; onClose: () => void
}) {
  const [trigger] = useState(activeElement)
  return <MovieDialog title="Достижения" eyebrow={provider} wide returnFocusTo={trigger} onClose={onClose} onSubmit={event => event.preventDefault()}
    actions={<button type="button" className="secondary-button" onClick={onClose}>Закрыть</button>}>
    <p className="game-achievements-context">{gameTitle}</p>
    <div className="game-achievements-summary">
      <div><small>Получено достижений</small><strong>{unlocked} / {total}</strong></div>
      <div><small>Прогресс</small><strong>{percentage(percent)}%</strong></div>
      {gamerscore && <div className="game-achievements-score"><small>Gamerscore</small><strong>{gamerscore}</strong></div>}
    </div>
    <ul className="game-achievements-list" aria-label={`Достижения ${provider}`} tabIndex={0}>{children}</ul>
  </MovieDialog>
}

function AchievementItem({ name, description, image, unlocked, unlockedAt, gamerscore }: {
  name: string; description: string; image: string | null; unlocked: boolean; unlockedAt: string | null; gamerscore?: number
}) {
  return <li><article className="game-achievements-item" data-unlocked={unlocked}>
    <span className="game-achievements-icon" aria-hidden="true">◇{image && <img src={image} alt="" loading="lazy" decoding="async" onLoad={event => { event.currentTarget.hidden = false }} onError={event => { event.currentTarget.hidden = true }} />}</span>
    <div className="game-achievements-copy"><strong>{gamerscore != null && <><span className="game-achievements-title-score">{gamerscore}G</span>{' - '}</>}{name}</strong><p>{description}</p>
      <div className="game-achievements-meta"><span className="game-achievements-status">{unlocked ? <Check aria-hidden="true" /> : <Lock aria-hidden="true" />}{unlocked ? 'Получено' : 'Не получено'}</span>{unlocked && <time dateTime={unlockedAt ?? undefined}>{formatDate(unlockedAt)}</time>}</div>
    </div>
  </article></li>
}

export function SteamAchievementsModal({ progress, gameTitle, onClose }: { progress: SteamProgress; gameTitle: string; onClose: () => void }) {
  return <AchievementListDialog provider="Steam" gameTitle={gameTitle} unlocked={progress.unlockedAchievements} total={progress.totalAchievements} percent={progress.achievementPercent} onClose={onClose}>
    {progress.achievements.length ? progress.achievements.map(achievement => <AchievementItem key={achievement.apiName}
      name={achievement.displayName} description={achievement.hidden && !achievement.unlocked ? 'Скрытое достижение' : achievement.description || 'Без описания'}
      image={achievement.unlocked ? achievement.iconUrl : achievement.lockedIconUrl} unlocked={achievement.unlocked} unlockedAt={achievement.unlockedAt} />)
      : <li className="game-achievements-empty">Список достижений пока пуст.</li>}
  </AchievementListDialog>
}

export function XboxAchievementsModal({ achievements, progress, gameTitle, onClose }: { achievements: XboxAchievement[]; progress: XboxProgress; gameTitle: string; onClose: () => void }) {
  return <AchievementListDialog provider="Xbox" gameTitle={gameTitle} unlocked={progress.unlockedAchievements} total={progress.totalAchievements} percent={progress.achievementPercent}
    gamerscore={`${progress.earnedGamerscore} / ${progress.totalGamerscore} G`} onClose={onClose}>
    {achievements.length ? achievements.map(achievement => <AchievementItem key={achievement.achievementId}
      name={achievement.hidden && !achievement.unlocked ? 'Скрытое достижение' : achievement.displayName}
      description={achievement.hidden && !achievement.unlocked ? achievement.lockedDescription || 'Описание скрыто' : achievement.description || achievement.lockedDescription || 'Без описания'}
      image={achievement.iconUrl} unlocked={achievement.unlocked} unlockedAt={achievement.unlockedAt} gamerscore={achievement.gamerscore} />)
      : <li className="game-achievements-empty">Список достижений пока пуст.</li>}
  </AchievementListDialog>
}

const emptyGroup: XboxAchievementGroupInput = { name: '', totalAchievements: 0, unlockedAchievements: 0, totalGamerscore: 0, earnedGamerscore: 0, completedAt: null }

export function AchievementGroupsModal({ libraryId, groups, gameTitle, onClose, onChanged }: {
  libraryId: number; groups: XboxAchievementGroup[]; gameTitle: string; onClose: () => void; onChanged: (groups: XboxAchievementGroup[]) => void
}) {
  const [trigger] = useState(activeElement)
  const [editing, setEditing] = useState<XboxAchievementGroup | 'new' | null>(null)
  const [draft, setDraft] = useState<XboxAchievementGroupInput>(emptyGroup)
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const contentRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const returnToGroupRef = useRef<number | 'new' | null>(null)
  useEffect(() => {
    if (editing) {
      const input = contentRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')
      input?.focus({ preventScroll: true })
      input?.scrollIntoView({ block: 'nearest' })
    } else if (returnToGroupRef.current != null) {
      const dialog = contentRef.current?.closest('dialog')
      const target = returnToGroupRef.current === 'new' ? '.game-achievements-add' : `[data-edit-group="${returnToGroupRef.current}"]`
      const button = dialog?.querySelector<HTMLButtonElement>(target) ?? dialog?.querySelector<HTMLButtonElement>('.game-achievements-add')
      button?.focus({ preventScroll: true })
      button?.scrollIntoView({ block: 'nearest' })
      returnToGroupRef.current = null
    }
  }, [editing])
  useEffect(() => {
    if (error) { errorRef.current?.scrollIntoView({ block: 'nearest' }); errorRef.current?.focus({ preventScroll: true }) }
  }, [error])
  const openEditor = (group: XboxAchievementGroup | 'new') => {
    setError(null)
    returnToGroupRef.current = group === 'new' ? 'new' : group.id
    setDraft(group === 'new' ? { ...emptyGroup } : { name: group.name, totalAchievements: group.totalAchievements, unlockedAchievements: group.unlockedAchievements, totalGamerscore: group.totalGamerscore, earnedGamerscore: group.earnedGamerscore, completedAt: group.completedAt })
    setEditing(group)
  }
  const change = <K extends keyof XboxAchievementGroupInput>(key: K, value: XboxAchievementGroupInput[K]) => setDraft(current => ({ ...current, [key]: value }))
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setError(null)
    await mutations.run('save', () => editing === 'new' ? createXboxAchievementGroup(libraryId, draft) : updateXboxAchievementGroup(editing.id, draft), {
      onSuccess: saved => {
        onChanged(editing === 'new' ? [...groups, saved] : groups.map(group => group.id === saved.id ? saved : group))
        setEditing(null)
      },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось сохранить раздел достижений')),
    })
  }
  const remove = async (group: XboxAchievementGroup) => {
    if (group.groupType === 'BASE_GAME') return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить дополнение «${group.name}»?`)) return false
      await deleteXboxAchievementGroup(group.id)
      return true
    }, {
      onSuccess: removed => { if (removed) onChanged(groups.filter(item => item.id !== group.id)) },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось удалить дополнение')),
    })
  }
  return <MovieDialog title={editing ? editing === 'new' ? 'Новое дополнение' : 'Раздел достижений' : 'Достижения по разделам'} eyebrow="Xbox" wide returnFocusTo={trigger}
    onClose={onClose} closeDisabled={mutations.pending} onSubmit={event => void save(event)}
    actions={editing ? <><button type="button" className="secondary-button" disabled={mutations.pending} onClick={() => { setError(null); setEditing(null) }}>Отмена</button><button type="submit" className="primary-button" disabled={mutations.pending}>{mutations.saving ? 'Сохраняем…' : 'Сохранить'}</button></>
      : <><button type="button" className="secondary-button" disabled={mutations.pending} onClick={onClose}>Закрыть</button><button type="button" className="primary-button game-achievements-add" disabled={mutations.pending} onClick={() => openEditor('new')}>Добавить DLC</button></>}>
    <div ref={contentRef} className="game-achievements-content">
      <p className="game-achievements-context">{gameTitle}</p>
      {error && <div ref={errorRef} className="form-error" role="alert" tabIndex={-1}>{error}</div>}
      {editing ? <fieldset className="game-achievements-editor" disabled={mutations.pending} aria-label="Раздел достижений">
        <label>Название<input required disabled={editing !== 'new' && editing.groupType === 'BASE_GAME'} value={draft.name} onChange={event => change('name', event.target.value)} /></label>
        {(editing === 'new' || editing.groupType !== 'BASE_GAME') && <label>Дата прохождения DLC<input type="date" value={draft.completedAt?.slice(0, 10) ?? ''} onChange={event => change('completedAt', event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null)} /></label>}
        <div className="game-achievements-editor-grid">
          <label>Получено достижений<input required min={0} max={draft.totalAchievements} step={1} type="number" inputMode="numeric" value={draft.unlockedAchievements} onChange={event => change('unlockedAchievements', Number(event.target.value))} /></label>
          <label>Всего достижений<input required min={0} step={1} type="number" inputMode="numeric" value={draft.totalAchievements} onChange={event => change('totalAchievements', Number(event.target.value))} /></label>
          <label>Получено Gamerscore<input required min={0} max={draft.totalGamerscore} step={1} type="number" inputMode="numeric" value={draft.earnedGamerscore} onChange={event => change('earnedGamerscore', Number(event.target.value))} /></label>
          <label>Всего Gamerscore<input required min={0} step={1} type="number" inputMode="numeric" value={draft.totalGamerscore} onChange={event => change('totalGamerscore', Number(event.target.value))} /></label>
        </div>
      </fieldset> : <div className="game-achievements-groups">
        {groups.length ? groups.map(group => <article key={group.id}>
          <div className="game-achievements-group-title"><small>{group.groupType === 'BASE_GAME' ? 'Основная игра' : 'DLC'}</small><h3>{group.name}</h3>{group.groupType === 'DLC' && group.completedAt && <span>Пройдено: {formatDate(group.completedAt)}</span>}</div>
          <div className="game-achievements-group-values"><div><strong>{group.unlockedAchievements} / {group.totalAchievements}</strong><span>достижений · {percentage(group.achievementPercent)}%</span></div><div><strong>{group.earnedGamerscore} / {group.totalGamerscore} G</strong><span>Gamerscore · {percentage(group.gamerscorePercent)}%</span></div></div>
          <div className="game-achievements-group-actions"><button type="button" className="secondary-button" disabled={mutations.pending} data-edit-group={group.id} onClick={() => openEditor(group)}>Изменить</button>{group.groupType === 'DLC' && <button type="button" className="game-achievements-delete" disabled={mutations.pending} aria-label={`Удалить дополнение «${group.name}»`} onClick={() => void remove(group)}>Удалить DLC</button>}</div>
        </article>) : <p className="game-achievements-empty">Разделов достижений пока нет.</p>}
      </div>}
    </div>
  </MovieDialog>
}
