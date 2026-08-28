import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Pencil } from "lucide-react";
import { PlatformBadge } from "../components/PlatformBadge";
import {
  createGameLibrary,
  createGamePlaythrough,
  createXboxAchievementGroup,
  deleteGameLibrary,
  deleteGamePlaythrough,
  deleteXboxAchievementGroup,
  getGameCatalog,
  getGameLibrary,
  getGamePlaythroughs,
  getGameSessions,
  getPlatforms,
  getSources,
  getXboxAchievementGroups,
  getXboxProgress,
  putXboxProgress,
  updateGameLibrary,
  updateGamePlaythrough,
  updateXboxAchievementGroup,
  type Game,
  type GameLibrary,
  type GameLibraryInput,
  type GamePlaythrough,
  type GamePlaythroughInput,
  type GameSession,
  type Reference,
  type XboxAchievementGroup,
  type XboxAchievementGroupInput,
  type XboxProgress,
} from "../api/games";
import type { LibraryStatus } from "../api/movies";

const statusLabels: Record<LibraryStatus, string> = {
  NOT_STARTED: "Не начата",
  PLANNED: "В планах",
  IN_PROGRESS: "Играю",
  COMPLETED: "Пройдена",
  PAUSED: "На паузе",
  DROPPED: "Брошена",
};
const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "—";
const formatMinutes = (minutes: number) =>
  `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
const isXbox = (entry: GameLibrary) =>
  entry.platform.code.startsWith("XBOX_") ||
  entry.platform.code === "ORIGINAL_XBOX";

export function GameDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const contentId = Number(id);
  const [game, setGame] = useState<Game | null>(null);
  const [libraries, setLibraries] = useState<GameLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(
    null,
  );
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [progress, setProgress] = useState<XboxProgress | null>(null);
  const [playthroughs, setPlaythroughs] = useState<GamePlaythrough[]>([]);
  const [editingPlaythrough, setEditingPlaythrough] = useState<
    GamePlaythrough | "new" | null
  >(null);
  const [achievementGroups, setAchievementGroups] = useState<
    XboxAchievementGroup[]
  >([]);
  const [showAchievementDetails, setShowAchievementDetails] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<
    GameLibrary | "new" | null
  >(null);
  const [platforms, setPlatforms] = useState<Reference[]>([]);
  const [sources, setSources] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalog, entries, allSessions, platformList, sourceList] =
        await Promise.all([
          getGameCatalog(),
          getGameLibrary(),
          getGameSessions(),
          getPlatforms(),
          getSources(),
        ]);
      const selectedGame =
        catalog.find((item) => item.id === contentId) ?? null;
      const gameLibraries = entries.filter(
        (item) => item.contentId === contentId,
      );
      if (!selectedGame) throw new Error("Игра не найдена");
      setGame(selectedGame);
      setLibraries(gameLibraries);
      setSelectedLibraryId((current) =>
        gameLibraries.some((item) => item.id === current)
          ? current
          : (gameLibraries.find(isXbox)?.id ?? gameLibraries[0]?.id ?? null),
      );
      setPlatforms(platformList);
      setSources(sourceList);
      setSessions(allSessions.filter((item) => item.contentId === contentId));
      const histories = await Promise.all(
        gameLibraries.map((entry) => getGamePlaythroughs(entry.id)),
      );
      setPlaythroughs(
        histories
          .flat()
          .sort(
            (left, right) =>
              new Date(right.completedAt).getTime() -
              new Date(left.completedAt).getTime(),
          ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось загрузить игру",
      );
    } finally {
      setLoading(false);
    }
  }, [contentId]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const selectedLibrary = libraries.find(
      (item) => item.id === selectedLibraryId,
    );
    if (!selectedLibrary || !isXbox(selectedLibrary)) {
      setProgress(null);
      setAchievementGroups([]);
      return;
    }
    let cancelled = false;
    void Promise.all([
      getXboxProgress(selectedLibrary.id),
      getXboxAchievementGroups(selectedLibrary.id),
    ])
      .then(([xbox, groups]) => {
        if (cancelled) return;
        setProgress(xbox);
        setAchievementGroups(groups);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить Xbox-прогресс",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [libraries, selectedLibraryId]);

  const library =
    libraries.find((item) => item.id === selectedLibraryId) ??
    libraries[0] ??
    null;
  const selectedSessions = useMemo(
    () =>
      library
        ? sessions.filter((item) => item.libraryEntryId === library.id)
        : [],
    [sessions, library],
  );
  const totalMinutes = useMemo(
    () =>
      selectedSessions.reduce((sum, item) => sum + item.durationMinutes, 0) +
      (library?.legacyPlaytimeMinutes ?? 0),
    [selectedSessions, library],
  );
  const latestSession = selectedSessions[0];
  const lastAchievement = selectedSessions.find(
    (item) => item.unlockedAchievements > 0 || item.earnedGamerscore > 0,
  );
  if (loading)
    return (
      <div className="loading">
        <span />
        Загружаем страницу игры…
      </div>
    );
  if (error || !game)
    return (
      <div className="notice error">
        <strong>Не удалось открыть игру</strong>
        <span>{error ?? "Игра не найдена"}</span>
      </div>
    );
  const xbox = library ? isXbox(library) : false;
  const hasXbox = libraries.some(isXbox);
  const hasPc = libraries.some((entry) => entry.platform.code === "PC");
  const achievementPercent = progress?.achievementPercent ?? 0;
  const completed100 = Boolean(progress && achievementPercent >= 100);
  const baseAchievements = achievementGroups.find(
    (item) => item.groupType === "BASE_GAME",
  );
  const dlcAchievements = achievementGroups.filter(
    (item) => item.groupType === "DLC",
  );
  const latestDlcCompletionDate = dlcAchievements.reduce<string | null>(
    (latest, item) => {
      if (!item.completedAt) return latest;
      return !latest || new Date(item.completedAt) > new Date(latest)
        ? item.completedAt
        : latest;
    },
    null,
  );
  const dlcSummary = dlcAchievements.reduce(
    (sum, item) => ({
      totalAchievements: sum.totalAchievements + item.totalAchievements,
      unlockedAchievements:
        sum.unlockedAchievements + item.unlockedAchievements,
      totalGamerscore: sum.totalGamerscore + item.totalGamerscore,
      earnedGamerscore: sum.earnedGamerscore + item.earnedGamerscore,
    }),
    {
      totalAchievements: 0,
      unlockedAchievements: 0,
      totalGamerscore: 0,
      earnedGamerscore: 0,
    },
  );

  return (
    <div className="game-details-page">
      <div className="game-details-toolbar">
        <Link to="/games">
          <ArrowLeft />
          Назад к играм
        </Link>
        <button
          className="secondary-button icon-button"
          onClick={() => navigate(`/games?edit=${game.id}`)}
        >
          <Pencil />
          Редактировать
        </button>
      </div>
      <section className="game-hero-card">
        <div
          className="game-detail-cover"
          style={
            game.coverUrl
              ? { backgroundImage: `url(${game.coverUrl})` }
              : undefined
          }
        >
          <span>{game.title.slice(0, 1)}</span>
        </div>
        <div className="game-main-info">
          <h1>{game.title}</h1>
          <div className="platform-badges">
            {hasXbox && <PlatformBadge name="Xbox" />}
            {hasPc && <PlatformBadge name="PC" />}
          </div>
          <dl>
            <div>
              <dt>Разработчик</dt>
              <dd>{game.developer ?? "—"}</dd>
            </div>
            <div>
              <dt>Жанр</dt>
              <dd>{game.genre ?? "—"}</dd>
            </div>
            <div>
              <dt>Дата выхода</dt>
              <dd>
                {game.releaseDate
                  ? formatDate(game.releaseDate)
                  : (game.releaseYear ?? "—")}
              </dd>
            </div>
          </dl>
        </div>
        <div className="game-personal-info">
          <div>
            <small>Статус</small>
            <strong className="detail-status">
              ● {library ? statusLabels[library.status] : "Не в библиотеке"}
            </strong>
            {library?.status === "COMPLETED" && (
              <span>
                Дата прохождения:{" "}
                {formatDate(
                  library.completedAt ?? playthroughs[0]?.completedAt,
                )}
              </span>
            )}
          </div>
          <div>
            <small>Моя оценка</small>
            <div className="detail-rating">
              {library?.rating ? `${library.rating}/10` : "—"}
            </div>
          </div>
          <div>
            <small>Заметки</small>
            <p>{library?.personalNote ?? "Заметок пока нет."}</p>
          </div>
        </div>
      </section>

      {xbox && (
        <section className="xbox-detail-row">
          <article className="detail-card xbox-progress-card">
            <h2>Прогресс Xbox</h2>
            {progress ? (
              <div className="xbox-progress-columns">
                <Progress
                  label="Достижения"
                  value={`${progress.unlockedAchievements} / ${progress.totalAchievements}`}
                  percent={progress.achievementPercent}
                />
                <Progress
                  label="Gamerscore"
                  value={`${progress.earnedGamerscore} / ${progress.totalGamerscore} G`}
                  percent={progress.gamerscorePercent}
                />
              </div>
            ) : (
              <p className="muted">
                Сначала укажите Xbox-прогресс в настройках игры.
              </p>
            )}
          </article>
          <article className="detail-card achievement-summary">
            <h2>Достижения</h2>
            {progress ? (
              <>
                <div className="achievement-compact-list">
                  {baseAchievements && (
                    <AchievementCompact
                      label="Основная игра"
                      unlocked={baseAchievements.unlockedAchievements}
                      total={baseAchievements.totalAchievements}
                      earned={baseAchievements.earnedGamerscore}
                      score={baseAchievements.totalGamerscore}
                    />
                  )}
                  {dlcAchievements.length > 0 && (
                    <AchievementCompact
                      label={`Дополнения · ${dlcAchievements.length}`}
                      unlocked={dlcSummary.unlockedAchievements}
                      total={dlcSummary.totalAchievements}
                      earned={dlcSummary.earnedGamerscore}
                      score={dlcSummary.totalGamerscore}
                    />
                  )}
                </div>
                <strong>
                  {completed100
                    ? "✓ Получено 100%"
                    : `${progress.earnedGamerscore} G получено`}
                </strong>
                {progress.unlockedAchievements > 0 && (
                  <span>
                    {completed100
                      ? formatDate(
                          latestDlcCompletionDate ?? progress.lastUpdatedAt,
                        )
                      : lastAchievement
                        ? formatDate(lastAchievement.startedAt)
                        : formatDate(progress.lastUpdatedAt)}
                  </span>
                )}
                {!completed100 && (
                  <p>{`Осталось ${Math.max(0, Math.round(100 - achievementPercent))}% достижений`}</p>
                )}
                <button
                  className="achievement-details-button"
                  onClick={() => setShowAchievementDetails(true)}
                >
                  Подробнее
                </button>
              </>
            ) : (
              <p className="muted">Нет данных</p>
            )}
          </article>
        </section>
      )}

      <section className="game-detail-grid">
        <article className="detail-card library-copies-card">
          <div className="library-card-heading">
            <h2>Библиотека</h2>
            <button onClick={() => setEditingLibrary("new")}>+ Добавить</button>
          </div>
          {libraries.length ? (
            <div className="library-copy-list">
              {libraries.map((entry) => (
                <button
                  className={entry.id === library?.id ? "active" : ""}
                  key={entry.id}
                  onClick={() => setSelectedLibraryId(entry.id)}
                >
                  <span>
                    <strong>{entry.source.name}</strong>
                    <small>
                      {entry.platform.name}
                      {entry.edition ? ` · ${entry.edition}` : ""}
                    </small>
                    {isXbox(entry) && (
                      <small>
                        Xbox Play Anywhere ·{" "}
                        {game.xboxPlayAnywhere ? "Да" : "Нет"}
                      </small>
                    )}
                  </span>
                  <em>
                    {entry.accessType === "SUBSCRIPTION"
                      ? "Подписка"
                      : "Куплено"}
                  </em>
                  <i
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingLibrary(entry);
                    }}
                  >
                    ✎
                  </i>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">Игра не добавлена в библиотеку.</p>
          )}
        </article>
        <article className="detail-card total-playtime">
          <h2>Время выбранной копии</h2>
          <strong>◷ {formatMinutes(totalMinutes)}</strong>
          <small>Последняя сессия</small>
          <span>
            {latestSession
              ? formatDate(latestSession.startedAt)
              : "Сессий пока нет"}
          </span>
        </article>
        <article className="detail-card">
          <h2>История прохождений</h2>
          <div className="playthrough-list">
            {playthroughs.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setEditingPlaythrough(item)}
              >
                <b>{item.playthroughNumber}</b>
                <span>
                  <strong>Пройдена</strong>
                  <small>
                    {libraries.find(
                      (entry) => entry.id === item.libraryEntryId,
                    )?.platform.name ?? "Неизвестная платформа"}
                    {" · "}
                    {libraries.find(
                      (entry) => entry.id === item.libraryEntryId,
                    )?.source.name ?? "Неизвестный источник"}
                  </small>
                  <small>{formatDate(item.completedAt)}</small>
                  {item.note && <small>{item.note}</small>}
                </span>
                <em>{formatMinutes(item.playtimeMinutes)}</em>
              </button>
            ))}
          </div>
          {library && (
            <button
              className="secondary-button playthrough-button"
              onClick={() => setEditingPlaythrough("new")}
            >
              Отметить прохождение
            </button>
          )}
        </article>
      </section>

      <section className="detail-card sessions-table-card">
        <h2>
          Последние игровые сессии ·{" "}
          {library?.platform.name ?? "копия не выбрана"}
        </h2>
        {selectedSessions.length ? (
          <>
            <div className="sessions-table">
              <div className="sessions-head">
                <span>Дата</span>
                <span>Время</span>
                <span>Длительность</span>
                <span>Достижения</span>
                <span>Gamerscore</span>
                <span>Заметка</span>
              </div>
              {selectedSessions.slice(0, 5).map((item) => (
                <div key={item.id}>
                  <span>{formatDate(item.startedAt)}</span>
                  <span>
                    {new Date(item.startedAt).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>{formatMinutes(item.durationMinutes)}</span>
                  <span className={item.unlockedAchievements ? "positive" : ""}>
                    +{item.unlockedAchievements}
                  </span>
                  <span className={item.earnedGamerscore ? "positive" : ""}>
                    +{item.earnedGamerscore} G
                  </span>
                  <span>{item.note ?? "—"}</span>
                </div>
              ))}
            </div>
            <Link className="all-sessions-link" to="/games">
              Показать все сессии
            </Link>
          </>
        ) : (
          <p className="muted">Игровых сессий у этой копии пока нет.</p>
        )}
      </section>
      {showAchievementDetails && library && (
        <AchievementGroupsModal
          libraryId={library.id}
          groups={achievementGroups}
          onClose={() => setShowAchievementDetails(false)}
          onSaved={() => void load()}
        />
      )}
      {editingPlaythrough && library && (
        <PlaythroughModal
          libraryId={
            editingPlaythrough === "new"
              ? library.id
              : editingPlaythrough.libraryEntryId
          }
          playthrough={
            editingPlaythrough === "new" ? undefined : editingPlaythrough
          }
          onClose={() => setEditingPlaythrough(null)}
          onSaved={() => {
            setEditingPlaythrough(null);
            void load();
          }}
        />
      )}
      {editingLibrary && (
        <LibraryEntryModal
          contentId={game.id}
          entry={editingLibrary === "new" ? undefined : editingLibrary}
          platforms={platforms}
          sources={sources}
          onClose={() => setEditingLibrary(null)}
          onSaved={(id) => {
            setEditingLibrary(null);
            if (libraries.some((entry) => entry.id === id)) void load();
            else setSelectedLibraryId(id);
          }}
        />
      )}
    </div>
  );
}

function LibraryEntryModal({
  contentId,
  entry,
  platforms,
  sources,
  onClose,
  onSaved,
}: {
  contentId: number;
  entry?: GameLibrary;
  platforms: Reference[];
  sources: Reference[];
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const defaultPlatform = entry?.platform.id ?? platforms[0]?.id ?? 0;
  const defaultSource =
    entry?.source.id ??
    sources.find((item) => item.type !== "SUBSCRIPTION")?.id ??
    sources[0]?.id ??
    0;
  const [input, setInput] = useState<GameLibraryInput>({
    platformId: defaultPlatform,
    sourceId: defaultSource,
    accessType: entry?.accessType ?? "OWNED",
    edition: entry?.edition ?? null,
    acquiredAt: entry?.acquiredAt ?? null,
    note: entry?.note ?? null,
    legacyPlaytimeMinutes: entry?.legacyPlaytimeMinutes ?? 0,
    status: entry?.status ?? "NOT_STARTED",
    startedAt: entry?.startedAt ?? null,
    completedAt: entry?.completedAt ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const compatibleSources = sources.filter((item) =>
    input.accessType === "SUBSCRIPTION"
      ? item.type === "SUBSCRIPTION"
      : item.type !== "SUBSCRIPTION",
  );
  const setValue = <K extends keyof GameLibraryInput>(
    key: K,
    value: GameLibraryInput[K],
  ) => setInput((current) => ({ ...current, [key]: value }));
  const changeAccessType = (accessType: GameLibraryInput["accessType"]) => {
    const source = sources.find((item) =>
      accessType === "SUBSCRIPTION"
        ? item.type === "SUBSCRIPTION"
        : item.type !== "SUBSCRIPTION",
    );
    setInput((current) => ({
      ...current,
      accessType,
      sourceId: source?.id ?? current.sourceId,
    }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = entry
        ? await updateGameLibrary(entry.id, input)
        : await createGameLibrary(contentId, input);
      if (!entry && isXbox(saved))
        await putXboxProgress(saved.id, {
          totalAchievements: 0,
          unlockedAchievements: 0,
          totalGamerscore: 0,
          earnedGamerscore: 0,
        });
      onSaved(saved.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось сохранить запись библиотеки",
      );
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (
      !entry ||
      !window.confirm(
        `Удалить запись «${entry.source.name} · ${entry.platform.name}»? Игровые сессии этой копии также будут удалены.`,
      )
    )
      return;
    setSaving(true);
    setError(null);
    try {
      await deleteGameLibrary(entry.id);
      onSaved(entry.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось удалить запись библиотеки",
      );
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <form
        className="habit-form library-entry-form"
        onSubmit={(event) => void submit(event)}
      >
        <div className="form-heading">
          <div>
            <p className="eyebrow">Моя библиотека</p>
            <h2>{entry ? "Редактирование копии" : "Добавить копию игры"}</h2>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-grid">
          <label>
            Платформа
            <select
              required
              value={input.platformId}
              onChange={(event) =>
                setValue("platformId", Number(event.target.value))
              }
            >
              {platforms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Тип доступа
            <select
              value={input.accessType}
              onChange={(event) =>
                changeAccessType(
                  event.target.value as GameLibraryInput["accessType"],
                )
              }
            >
              <option value="OWNED">Куплена</option>
              <option value="SUBSCRIPTION">Подписка</option>
            </select>
          </label>
          <label>
            Магазин или источник
            <select
              required
              value={input.sourceId}
              onChange={(event) =>
                setValue("sourceId", Number(event.target.value))
              }
            >
              {compatibleSources.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Издание
            <input
              value={input.edition ?? ""}
              onChange={(event) =>
                setValue("edition", event.target.value || null)
              }
              placeholder="Standard Edition"
            />
          </label>
          <label>
            Статус этой копии
            <select
              value={input.status}
              onChange={(event) => {
                const status = event.target.value as LibraryStatus;
                setInput((current) => ({
                  ...current,
                  status,
                  completedAt:
                    status === "COMPLETED" && !current.completedAt
                      ? new Date().toISOString()
                      : status === "COMPLETED"
                        ? current.completedAt
                        : null,
                }));
              }}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Дата прохождения этой копии
            <input
              disabled={input.status !== "COMPLETED"}
              type="date"
              value={input.completedAt?.slice(0, 10) ?? ""}
              onChange={(event) =>
                setValue(
                  "completedAt",
                  event.target.value
                    ? new Date(`${event.target.value}T12:00:00`).toISOString()
                    : null,
                )
              }
            />
          </label>
          <label>
            Время до начала учёта, часов
            <input
              min="0"
              type="number"
              value={Math.floor(input.legacyPlaytimeMinutes / 60)}
              onChange={(event) =>
                setValue(
                  "legacyPlaytimeMinutes",
                  Math.max(0, Number(event.target.value)) * 60 +
                    (input.legacyPlaytimeMinutes % 60),
                )
              }
            />
          </label>
          <label>
            Минут
            <input
              min="0"
              max="59"
              type="number"
              value={input.legacyPlaytimeMinutes % 60}
              onChange={(event) =>
                setValue(
                  "legacyPlaytimeMinutes",
                  Math.floor(input.legacyPlaytimeMinutes / 60) * 60 +
                    Math.min(59, Math.max(0, Number(event.target.value))),
                )
              }
            />
          </label>
        </div>
        <div className="form-buttons">
          {entry && (
            <button
              className="danger-button"
              disabled={saving}
              type="button"
              onClick={() => void remove()}
            >
              Удалить
            </button>
          )}
          <button className="secondary-button" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PlaythroughModal({
  libraryId,
  playthrough,
  onClose,
  onSaved,
}: {
  libraryId: number;
  playthrough?: GamePlaythrough;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [input, setInput] = useState<GamePlaythroughInput>({
    completedAt: playthrough?.completedAt ?? new Date().toISOString(),
    note: playthrough?.note ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (playthrough) await updateGamePlaythrough(playthrough.id, input);
      else await createGamePlaythrough(libraryId, input);
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось сохранить прохождение",
      );
      setSaving(false);
    }
  };
  const remove = async () => {
    if (
      !playthrough ||
      !window.confirm("Удалить эту запись из истории прохождений?")
    )
      return;
    setSaving(true);
    setError(null);
    try {
      await deleteGamePlaythrough(playthrough.id);
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось удалить прохождение",
      );
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <form
        className="habit-form playthrough-form"
        onSubmit={(event) => void submit(event)}
      >
        <div className="form-heading">
          <div>
            <p className="eyebrow">История игры</p>
            <h2>
              {playthrough ? "Изменить прохождение" : "Добавить прохождение"}
            </h2>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <label>
          Дата прохождения
          <input
            required
            type="date"
            value={input.completedAt.slice(0, 10)}
            onChange={(event) =>
              setInput((current) => ({
                ...current,
                completedAt: new Date(
                  `${event.target.value}T12:00:00`,
                ).toISOString(),
              }))
            }
          />
        </label>
        <label>
          Заметка
          <textarea
            maxLength={5000}
            rows={3}
            value={input.note ?? ""}
            onChange={(event) =>
              setInput((current) => ({
                ...current,
                note: event.target.value || null,
              }))
            }
          />
        </label>
        <div className="form-buttons">
          {playthrough && (
            <button
              className="danger-button"
              disabled={saving}
              type="button"
              onClick={() => void remove()}
            >
              Удалить
            </button>
          )}
          <button className="secondary-button" type="button" onClick={onClose}>
            Отмена
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Progress({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  return (
    <div className="detail-progress">
      <small>{label}</small>
      <strong>{value}</strong>
      <div>
        <span style={{ width: `${percent}%` }} />
      </div>
      <em>{Math.round(percent)}%</em>
    </div>
  );
}

function AchievementCompact({
  label,
  unlocked,
  total,
  earned,
  score,
}: {
  label: string;
  unlocked: number;
  total: number;
  earned: number;
  score: number;
}) {
  return (
    <div>
      <span>{label}</span>
      <b>
        {unlocked}/{total}
      </b>
      <em>
        {earned}/{score} G
      </em>
    </div>
  );
}

const emptyGroup: XboxAchievementGroupInput = {
  name: "",
  totalAchievements: 0,
  unlockedAchievements: 0,
  totalGamerscore: 0,
  earnedGamerscore: 0,
  completedAt: null,
};

function AchievementGroupsModal({
  libraryId,
  groups,
  onClose,
  onSaved,
}: {
  libraryId: number;
  groups: XboxAchievementGroup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<XboxAchievementGroup | "new" | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async (group: XboxAchievementGroup) => {
    if (
      group.groupType === "BASE_GAME" ||
      !window.confirm(`Удалить дополнение «${group.name}»?`)
    )
      return;
    try {
      await deleteXboxAchievementGroup(group.id);
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось удалить дополнение",
      );
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="achievement-groups-modal">
        <div className="form-heading">
          <div>
            <p className="eyebrow">Xbox</p>
            <h2>Достижения по разделам</h2>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="achievement-group-list">
          {groups.map((group) => (
            <article key={group.id}>
              <div>
                <small>
                  {group.groupType === "BASE_GAME" ? "Основная игра" : "DLC"}
                </small>
                <h3>{group.name}</h3>
                {group.groupType === "DLC" && group.completedAt && (
                  <span>Пройдено: {formatDate(group.completedAt)}</span>
                )}
              </div>
              <div>
                <b>
                  {group.unlockedAchievements} / {group.totalAchievements}
                </b>
                <span>
                  достижений · {Math.round(group.achievementPercent)}%
                </span>
              </div>
              <div>
                <b>
                  {group.earnedGamerscore} / {group.totalGamerscore} G
                </b>
                <span>Gamerscore · {Math.round(group.gamerscorePercent)}%</span>
              </div>
              <button onClick={() => setEditing(group)}>Изменить</button>
              {group.groupType === "DLC" && (
                <button
                  className="group-delete"
                  onClick={() => void remove(group)}
                >
                  ×
                </button>
              )}
            </article>
          ))}
        </div>
        {editing ? (
          <AchievementGroupForm
            group={editing === "new" ? undefined : editing}
            saving={saving}
            setSaving={setSaving}
            setError={setError}
            libraryId={libraryId}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              onSaved();
            }}
          />
        ) : (
          <button
            className="primary-button add-dlc-button"
            onClick={() => setEditing("new")}
          >
            + Добавить DLC
          </button>
        )}
      </div>
    </div>
  );
}

function AchievementGroupForm({
  group,
  libraryId,
  saving,
  setSaving,
  setError,
  onCancel,
  onSaved,
}: {
  group?: XboxAchievementGroup;
  libraryId: number;
  saving: boolean;
  setSaving: (value: boolean) => void;
  setError: (value: string | null) => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [input, setInput] = useState<XboxAchievementGroupInput>(
    group
      ? {
          name: group.name,
          totalAchievements: group.totalAchievements,
          unlockedAchievements: group.unlockedAchievements,
          totalGamerscore: group.totalGamerscore,
          earnedGamerscore: group.earnedGamerscore,
          completedAt: group.completedAt,
        }
      : emptyGroup,
  );
  const setValue = <K extends keyof XboxAchievementGroupInput>(
    key: K,
    value: XboxAchievementGroupInput[K],
  ) => setInput((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (group) await updateXboxAchievementGroup(group.id, input);
      else await createXboxAchievementGroup(libraryId, input);
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось сохранить раздел достижений",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      className="achievement-group-form"
      onSubmit={(event) => void submit(event)}
    >
      <label>
        Название
        <input
          required
          disabled={group?.groupType === "BASE_GAME"}
          value={input.name}
          onChange={(event) => setValue("name", event.target.value)}
        />
      </label>
      {group?.groupType !== "BASE_GAME" && (
        <label>
          Дата прохождения DLC
          <input
            type="date"
            value={input.completedAt ? input.completedAt.slice(0, 10) : ""}
            onChange={(event) =>
              setValue(
                "completedAt",
                event.target.value
                  ? new Date(`${event.target.value}T12:00:00`).toISOString()
                  : null,
              )
            }
          />
        </label>
      )}
      <div>
        <label>
          Получено достижений
          <input
            min="0"
            max={input.totalAchievements}
            type="number"
            value={input.unlockedAchievements}
            onChange={(event) =>
              setValue("unlockedAchievements", Number(event.target.value))
            }
          />
        </label>
        <label>
          Всего достижений
          <input
            min="0"
            type="number"
            value={input.totalAchievements}
            onChange={(event) =>
              setValue("totalAchievements", Number(event.target.value))
            }
          />
        </label>
        <label>
          Получено Gamerscore
          <input
            min="0"
            max={input.totalGamerscore}
            type="number"
            value={input.earnedGamerscore}
            onChange={(event) =>
              setValue("earnedGamerscore", Number(event.target.value))
            }
          />
        </label>
        <label>
          Всего Gamerscore
          <input
            min="0"
            type="number"
            value={input.totalGamerscore}
            onChange={(event) =>
              setValue("totalGamerscore", Number(event.target.value))
            }
          />
        </label>
      </div>
      <div className="form-buttons">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Отмена
        </button>
        <button className="primary-button" disabled={saving}>
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
