import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Film, LoaderCircle } from 'lucide-react'
import { enrichKinopoiskMovies, importKinopoiskRatings, previewKinopoiskRatings, type KinopoiskMovieEnrichmentResult, type KinopoiskRatingsImportResult, type KinopoiskRatingsPreview } from '../api/movies'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { MovieDialog } from './MovieDialog'
import './KinopoiskRatingsDialog.css'

type Props = { onClose: () => void; onImported: () => void; returnFocusTo: HTMLElement | null }

export function KinopoiskRatingsDialog({ onClose, onImported, returnFocusTo }: Props) {
  const [profileId, setProfileId] = useState('')
  const [preview, setPreview] = useState<KinopoiskRatingsPreview | null>(null)
  const [result, setResult] = useState<KinopoiskRatingsImportResult | null>(null)
  const [enrichment, setEnrichment] = useState<KinopoiskMovieEnrichmentResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [operation, setOperation] = useState<'import' | 'enrich'>('import')
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLElement>(null)
  const requests = useLatestRequest()
  const mutations = useFormMutation()
  const { pending } = mutations
  const busy = loading || pending

  useEffect(() => {
    if (error) { errorRef.current?.scrollIntoView({ block: 'nearest' }); errorRef.current?.focus({ preventScroll: true }) }
  }, [error])
  useEffect(() => { resultRef.current?.scrollIntoView({ block: 'nearest' }) }, [result, enrichment])

  const close = () => {
    if (pending) return
    requests.dispose()
    mutations.dispose()
    onClose()
  }
  const changeProfile = (value: string) => {
    requests.invalidate()
    setProfileId(value)
    setPreview(null)
    setLoading(false)
    setError(null)
  }
  const load = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || result || !profileId.trim()) return
    if (!/^[A-Za-z0-9_-]+$/.test(profileId.trim())) { setError('Укажите ID профиля: латинские буквы, цифры, дефис или подчёркивание.'); return }
    await requests.run(() => previewKinopoiskRatings(profileId.trim()), {
      onStart: () => { setLoading(true); setError(null); setPreview(null) },
      onSuccess: setPreview,
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить оценки Кинопоиска'),
      onFinish: () => setLoading(false),
    })
  }
  const confirm = async () => {
    if (busy || !preview || preview.movieCount === 0 || result) return
    setOperation('import')
    setError(null)
    await mutations.run('save', async () => {
      if (!window.confirm(`Добавить ${preview.newCount} новых фильмов и обновить ${preview.existingCount} существующих?`)) return null
      return importKinopoiskRatings(preview.profileId)
    }, {
      onSuccess: imported => { if (imported) { setResult(imported); onImported() } },
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось импортировать фильмы'),
    })
  }
  const enrich = async () => {
    if (busy || result) return
    setOperation('enrich')
    setError(null)
    await mutations.run('save', () => enrichKinopoiskMovies(350), {
      onSuccess: updated => { setEnrichment(updated); onImported() },
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить подробные данные фильмов'),
    })
  }

  return <MovieDialog title="Импорт оценок" eyebrow="Кинопоиск" wide returnFocusTo={returnFocusTo} closeDisabled={pending} onClose={close} onSubmit={event => void load(event)} actions={<>
    <button className={result ? 'primary-button' : 'secondary-button'} type="button" disabled={pending} onClick={close}>{result ? 'Готово' : 'Закрыть'}</button>
    {!preview && !result && <button className="secondary-button" type="button" disabled={busy || enrichment?.remaining === 0} onClick={() => void enrich()}>{pending && operation === 'enrich' ? 'Обновляем…' : 'Загрузить подробные данные'}</button>}
    {preview && !result && <button className="primary-button" type="button" disabled={busy || preview.movieCount === 0} onClick={() => void confirm()}>{pending ? 'Импортируем…' : `Импортировать ${preview.movieCount} фильмов`}</button>}
  </>}>
    <div className="movie-ratings-content" aria-busy={busy}>
      {error && <div ref={errorRef} tabIndex={-1} className="form-error" role="alert">{error}</div>}
      {enrichment && <section ref={result ? undefined : resultRef} className="movie-ratings-result" role="status"><h3>Подробные данные обновлены</h3><dl className="movie-ratings-summary"><div><dt>Обновлено</dt><dd>{enrichment.updated}</dd></div><div><dt>Осталось</dt><dd>{enrichment.remaining}</dd></div></dl>{enrichment.quotaExhausted && <p>Достигнут лимит запросов Кинопоиска. Продолжите позже.</p>}</section>}
      {result ? <section ref={resultRef} className="movie-ratings-result" role="status"><h3>Импорт завершён</h3><dl className="movie-ratings-summary"><div><dt>Добавлено</dt><dd>{result.created}</dd></div><div><dt>Обновлено</dt><dd>{result.updated}</dd></div><div><dt>Пропущено</dt><dd>{result.skipped}</dd></div></dl><p>Фильмы и оценки доступны в каталоге.</p></section> : <>
        <p className="movie-ratings-hint">Загрузите оценки по ID профиля Кинопоиска. Перед импортом можно проверить список фильмов.</p>
        <div className="movie-ratings-profile"><label>ID профиля<input value={profileId} placeholder="Например, 1234567" autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event => changeProfile(event.target.value)} disabled={pending} /></label><button className="primary-button" type="submit" disabled={busy || !profileId.trim()}>{loading ? 'Загружаем…' : 'Загрузить оценки'}</button></div>
        {preview && <>
          <dl className="movie-ratings-summary"><div><dt>Всего оценок</dt><dd>{preview.totalRatings}</dd></div><div><dt>Фильмы</dt><dd>{preview.movieCount}</dd></div><div><dt>Уже в каталоге</dt><dd>{preview.existingCount}</dd></div><div><dt>Новые</dt><dd>{preview.newCount}</dd></div></dl>
          <p className="movie-ratings-hint">Сериалов исключено: {preview.seriesCount}. Дата просмотра недоступна и не будет добавлена в статистику дня.</p>
          {preview.movies.length > 0 ? <ul className="movie-ratings-list" aria-label="Фильмы для импорта">{preview.movies.map(item => <li key={item.filmId}>
            <div className="movie-ratings-cover"><Film aria-hidden="true" />{item.posterUrlPreview && <img src={item.posterUrlPreview} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true }} />}</div>
            <div className="movie-ratings-copy"><h3>{item.title}</h3>{item.originalTitle && item.originalTitle !== item.title && <p>{item.originalTitle}</p>}<p>{item.year ?? 'Год неизвестен'}{item.genre ? ` · ${item.genre}` : ''}</p></div>
            <div className="movie-ratings-personal"><strong aria-label={item.userRating != null ? `Оценка в Кинопоиске: ${item.userRating} из 10` : 'Без оценки'}>{item.userRating != null ? `${item.userRating}/10` : 'Без оценки'}</strong><span data-existing={Boolean(item.existingContentId)}>{item.existingContentId ? 'Обновить' : 'Добавить'}</span></div>
          </li>)}</ul> : <p className="movie-ratings-empty">В этом профиле нет фильмов для импорта.</p>}
        </>}
      </>}
      {busy && <p className="movie-ratings-progress" role="status"><LoaderCircle aria-hidden="true" /><span>{loading ? 'Загружаем оценки. Это может занять несколько минут.' : operation === 'import' ? 'Импортируем фильмы. Дождитесь завершения.' : 'Загружаем подробные данные. Дождитесь завершения.'}</span></p>}
    </div>
  </MovieDialog>
}
