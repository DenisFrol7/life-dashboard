import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Heart, Pencil, RefreshCw } from "lucide-react";
import { PlatformBadge } from "../components/PlatformBadge";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { getApiErrorMessage } from "../api/client";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { GameForm, GameSessionForm } from "./GamesPage";
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
  getSteamProgress,
  getXboxAchievements,
  getXboxAchievementGroups,
  getXboxProgress,
  putGameProfile,
  putXboxProgress,
  syncSteamProgress,
  syncXboxProgress,
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
  type SteamAchievement,
  type SteamProgress,
  type XboxAchievement,
  type XboxAchievementDetailsStatus,
  type XboxAchievementGroup,
  type XboxAchievementGroupInput,
  type XboxProgress,
} from "../api/games";
import type { LibraryStatus } from "../api/movies";
import "./GameDetailsPage.css";

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
const isXboxPlatform = (entry: GameLibrary) =>
  entry.platform.code.startsWith("XBOX_") ||
  entry.platform.code === "ORIGINAL_XBOX";
const supportsXboxProgress = (entry: GameLibrary) =>
  isXboxPlatform(entry) ||
  (entry.platform.code === "PC" &&
    ["MICROSOFT_STORE", "GAME_PASS"].includes(entry.source.code));
const isSteam = (entry: GameLibrary) => entry.source.code === "STEAM";
const xboxAchievementDiagnostic = (
  status: XboxAchievementDetailsStatus,
): { text: string; warning: boolean } | null => {
  switch (status) {
    case "AVAILABLE":
      return null;
    case "NOT_SYNCHRONIZED":
      return {
        text: "Подробный список ещё не проверялся. Нажмите «Обновить» в блоке прогресса Xbox.",
        warning: false,
      };
    case "NO_ACHIEVEMENTS":
      return {
        text: "OpenXBL сообщает, что у связанного Xbox Title ID нет списка достижений.",
        warning: false,
      };
    case "LEGACY_NOT_SUPPORTED":
      return {
        text: "Для этой старой Xbox-игры OpenXBL предоставляет только общие значения без списка и дат достижений.",
        warning: false,
      };
    case "DETAILS_UNAVAILABLE":
      return {
        text: "OpenXBL вернул общий прогресс, но не предоставил подробный список достижений для этого Title ID.",
        warning: true,
      };
    case "POSSIBLE_PC_VERSION":
      return {
        text: "Связанный Title ID похож на отдельную PC-версию игры. Проверьте Xbox-привязку этой копии.",
        warning: true,
      };
    case "TITLE_PLATFORM_MISMATCH":
      return {
        text: "Платформа связанного Title ID не совпадает с платформой этой копии игры. Возможно, выбрана другая Xbox-версия.",
        warning: true,
      };
  }
};

export function GameDetailsPage() {
  const contentId = Number(useParams().id);
  return <GameDetailsContent key={contentId} contentId={contentId} />;
}

function GameDetailsContent({ contentId }: { contentId: number }) {
  const navigate = useNavigate();
  const requests = useLatestRequest();
  const editRef = useRef<HTMLButtonElement>(null);
  const restoreEditFocusRef = useRef(false);
  const [game, setGame] = useState<Game | null>(null);
  const [libraries, setLibraries] = useState<GameLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(
    null,
  );
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [addingSession, setAddingSession] = useState(false);
  const [progress, setProgress] = useState<XboxProgress | null>(null);
  const [xboxAchievements, setXboxAchievements] = useState<XboxAchievement[]>([]);
  const [syncingXbox, setSyncingXbox] = useState(false);
  const [xboxError, setXboxError] = useState<string | null>(null);
  const [xboxSyncNote, setXboxSyncNote] = useState<string | null>(null);
  const [steamProgress, setSteamProgress] = useState<SteamProgress | null>(null);
  const [syncingSteam, setSyncingSteam] = useState(false);
  const [steamError, setSteamError] = useState<string | null>(null);
  const [showSteamAchievements, setShowSteamAchievements] = useState(false);
  const [showXboxAchievements, setShowXboxAchievements] = useState(false);
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
  const [editingGame, setEditingGame] = useState(false);
  const [platforms, setPlatforms] = useState<Reference[]>([]);
  const [sources, setSources] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => requests.run(async () => {
      if (!Number.isSafeInteger(contentId) || contentId < 1)
        throw new Error("Некорректный идентификатор игры");
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
      const histories = await Promise.all(
        gameLibraries.map((entry) => getGamePlaythroughs(entry.id)),
      );
      return { selectedGame, gameLibraries, platformList, sourceList, allSessions, histories };
    }, {
      onStart: () => { setLoading(true); setError(null); },
      onSuccess: ({ selectedGame, gameLibraries, platformList, sourceList, allSessions, histories }) => {
        setGame(selectedGame);
        setLibraries(gameLibraries);
        setSelectedLibraryId((current) =>
          gameLibraries.some((item) => item.id === current)
            ? current
            : (gameLibraries.find(isXboxPlatform)?.id ??
              gameLibraries.find(supportsXboxProgress)?.id ??
              gameLibraries[0]?.id ??
              null),
        );
        setPlatforms(platformList);
        setSources(sourceList);
        setSessions(allSessions.filter((item) => item.contentId === contentId));
        setPlaythroughs(
          histories
            .flat()
            .sort(
              (left, right) =>
                new Date(right.completedAt).getTime() -
                new Date(left.completedAt).getTime(),
            ),
        );
      },
      onError: reason => setError(getApiErrorMessage(reason, "Не удалось загрузить игру")),
      onFinish: () => setLoading(false),
    }), [contentId, requests]);
  useEffect(() => {
    void load();
    return () => requests.invalidate();
  }, [load, requests]);
  useEffect(() => {
    if (restoreEditFocusRef.current && !editingGame && !loading) {
      restoreEditFocusRef.current = false;
      editRef.current?.focus({ preventScroll: true });
    }
  }, [editingGame, loading]);

  useEffect(() => {
    const selectedLibrary = libraries.find(
      (item) => item.id === selectedLibraryId,
    );
    let cancelled = false;
    setProgress(null);
    setXboxAchievements([]);
    setAchievementGroups([]);
    setXboxError(null);
    setXboxSyncNote(null);
    setSteamProgress(null);
    setSteamError(null);
    setShowAchievementDetails(false);
    setShowSteamAchievements(false);
    setShowXboxAchievements(false);
    if (selectedLibrary && supportsXboxProgress(selectedLibrary)) {
      void Promise.all([
        getXboxProgress(selectedLibrary.id),
        getXboxAchievementGroups(selectedLibrary.id),
        getXboxAchievements(selectedLibrary.id),
      ])
        .then(([xbox, groups, achievements]) => {
          if (cancelled) return;
          setProgress(xbox);
          setAchievementGroups(groups);
          setXboxAchievements(achievements);
        })
        .catch((reason) => {
          if (!cancelled)
            setError(
              reason instanceof Error
                ? reason.message
                : "Не удалось загрузить Xbox-прогресс",
            );
        });
    } else if (selectedLibrary && isSteam(selectedLibrary)) {
      void getSteamProgress(selectedLibrary.id)
        .then((steamData) => {
          if (!cancelled) setSteamProgress(steamData);
        })
        .catch((reason) => {
          if (!cancelled)
            setSteamError(
              reason instanceof Error
                ? reason.message
                : "Не удалось загрузить Steam-прогресс",
            );
        });
    }
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
  const toolbar = <div className="game-view-toolbar">
    <Link to="/games"><ArrowLeft aria-hidden="true" />Назад к играм</Link>
    <button ref={editRef} type="button" className="secondary-button icon-button" disabled={loading || Boolean(error) || !game} onClick={() => setEditingGame(true)}><Pencil aria-hidden="true" />Редактировать</button>
  </div>;
  if (loading || error || !game)
    return <div className="game-details-page game-view-page">{toolbar}{loading
      ? <LoadingState message="Загружаем страницу игры…" />
      : <ErrorState title="Не удалось открыть игру" message={error ?? "Игра не найдена"} onRetry={() => void load()} />}</div>;
  const xbox = library ? supportsXboxProgress(library) : false;
  const steam = library ? isSteam(library) : false;
  const sharedXboxAchievementSet = Boolean(
    library?.xboxTitleId != null &&
      libraries.some(
        (entry) =>
          entry.id !== library.id &&
          supportsXboxProgress(entry) &&
          entry.xboxTitleId === library.xboxTitleId,
      ),
  );
  const platformNames = [...new Set(libraries.map(entry => entry.platform.name))];
  const showRawgAttribution = Boolean(game.rawgSlug);
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
  const selectedPlaythroughCompletionDate = playthroughs.find(
    (item) => item.libraryEntryId === library?.id,
  )?.completedAt;
  const achievementCompletionDate =
    latestDlcCompletionDate ??
    library?.completedAt ??
    selectedPlaythroughCompletionDate ??
    progress?.lastUnlockedAt ??
    progress?.lastUpdatedAt;
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
  const recentSteamAchievements = (steamProgress?.achievements ?? [])
    .filter((item) => item.unlocked)
    .slice(0, 3);
  const recentXboxAchievements = xboxAchievements
    .filter((item) => item.unlocked)
    .slice(0, 3);
  const xboxDiagnostic = progress
    ? xboxAchievementDiagnostic(progress.achievementDetailsStatus)
    : null;
  const steamCompleted100 = Boolean(
    steamProgress &&
      steamProgress.totalAchievements > 0 &&
      steamProgress.achievementPercent >= 100,
  );

  const synchronizeSteam = async () => {
    if (!library || !isSteam(library) || library.steamAppId == null) return;
    setSyncingSteam(true);
    setSteamError(null);
    try {
      const synchronized = await syncSteamProgress(library.id);
      setSteamProgress(synchronized);
      await load();
    } catch (reason) {
      setSteamError(
        reason instanceof Error
          ? reason.message
          : "Не удалось синхронизировать достижения Steam",
      );
    } finally {
      setSyncingSteam(false);
    }
  };

  const synchronizeXbox = async () => {
    if (!library || !supportsXboxProgress(library)) return;
    setSyncingXbox(true);
    setXboxError(null);
    setXboxSyncNote(null);
    try {
      const synchronized = await syncXboxProgress(library.id);
      setProgress(synchronized.progress);
      setXboxAchievements(await getXboxAchievements(library.id));
      if (!synchronized.manualDlcGroupsPreserved) {
        setAchievementGroups(await getXboxAchievementGroups(library.id));
      }
      const diagnostic = xboxAchievementDiagnostic(
        synchronized.progress.achievementDetailsStatus,
      );
      setXboxSyncNote(
        `Связано с Xbox: ${synchronized.xboxTitle}${diagnostic ? `. ${diagnostic.text}` : ""}`,
      );
      if (synchronized.completionRecorded) await load();
    } catch (reason) {
      setXboxError(
        reason instanceof Error
          ? reason.message
          : "Не удалось синхронизировать достижения Xbox",
      );
    } finally {
      setSyncingXbox(false);
    }
  };

  return (
    <div className="game-details-page game-view-page">
      {toolbar}
      <section className="game-view-hero" aria-labelledby="game-view-title">
        <div className="game-view-overview">
          <div className="game-view-cover" role="img" aria-label={`Обложка игры «${game.title}»`}>
            <span aria-hidden="true">{game.title.slice(0, 1)}</span>
            {(game.coverUrl || game.backgroundUrl) && <img
              src={game.coverUrl || game.backgroundUrl!}
              alt="" decoding="async"
              onLoad={event => { event.currentTarget.hidden = false; }}
              onError={event => {
                if (game.backgroundUrl && event.currentTarget.getAttribute("src") !== game.backgroundUrl)
                  event.currentTarget.src = game.backgroundUrl;
                else event.currentTarget.hidden = true;
              }}
            />}
            {library?.favorite && <span className="game-view-favorite" role="img" aria-label="В избранном"><Heart aria-hidden="true" /></span>}
          </div>
          <div className="game-view-info">
            <h2 id="game-view-title">{game.title}</h2>
            <div className="platform-badges">
              {platformNames.map(name => <PlatformBadge key={name} name={name} />)}
            </div>
            <dl>
              <div>
                <dt>Разработчик</dt>
                <dd>{game.developer ?? "—"}</dd>
              </div>
              <div className="game-view-genre">
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
          {showRawgAttribution && (
            <div className="game-view-attributions">
              <a
                className="game-view-attribution"
                href={`https://rawg.io/games/${game.rawgSlug}`}
                target="_blank"
                rel="noreferrer"
              >
                Данные об игре: <strong>RAWG</strong>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          )}
        </div>
        <div className="game-view-personal">
          <div>
            <small>Статус</small>
            <strong className="game-view-status">
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
          <div className="game-view-score">
            <small>Моя оценка</small>
            <div className="game-view-rating">
              {library?.rating != null ? `${library.rating}/10` : "—"}
            </div>
          </div>
          <div className="game-view-note">
            <small>Заметки</small>
            <p>{library?.personalNote ?? "Заметок пока нет."}</p>
          </div>
        </div>
      </section>

      {xbox && (
        <section className="xbox-detail-row">
          <article className="detail-card xbox-progress-card">
            <div className="steam-progress-heading">
              <h2>Прогресс Xbox</h2>
              <button
                className="secondary-button icon-button"
                disabled={syncingXbox}
                onClick={() => void synchronizeXbox()}
              >
                <RefreshCw className={syncingXbox ? "spinning" : ""} />
                {syncingXbox
                  ? "Синхронизируем…"
                  : progress
                    ? "Обновить"
                    : "Загрузить из Xbox"}
              </button>
            </div>
            {sharedXboxAchievementSet && (
              <small className="steam-sync-date">
                Общий набор достижений для PC- и Xbox-копии
              </small>
            )}
            {xboxError && <div className="form-error">{xboxError}</div>}
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
                Нажмите «Загрузить из Xbox» или укажите прогресс вручную в настройках игры.
              </p>
            )}
            {xboxSyncNote && <small className="steam-sync-date">{xboxSyncNote}</small>}
          </article>
          <article className="detail-card achievement-summary">
            <h2>{xboxAchievements.length ? "Достижения Xbox" : "Достижения"}</h2>
            {xboxDiagnostic && (
              <p
                className={`achievement-diagnostic${xboxDiagnostic.warning ? " warning" : ""}`}
              >
                {xboxDiagnostic.text}
              </p>
            )}
            {progress && xboxAchievements.length ? (
              <>
                {recentXboxAchievements.length > 0 ? (
                  <div className="steam-recent-achievements">
                    {recentXboxAchievements.map((achievement) => (
                      <XboxAchievementRow
                        achievement={achievement}
                        compact
                        key={achievement.achievementId}
                      />
                    ))}
                  </div>
                ) : (
                  <p>Полученных достижений пока нет.</p>
                )}
                <strong>
                  {completed100
                    ? "✓ Получено 100%"
                    : `${progress.unlockedAchievements} из ${progress.totalAchievements} получено`}
                </strong>
                {progress.lastUnlockedAt && (
                  <span>
                    Последнее достижение: {formatDate(progress.lastUnlockedAt)}
                  </span>
                )}
                <button
                  className="achievement-details-button"
                  onClick={() => setShowXboxAchievements(true)}
                >
                  Все достижения
                </button>
              </>
            ) : progress ? (
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
                      ? formatDate(achievementCompletionDate)
                      : progress.lastUnlockedAt
                        ? formatDate(progress.lastUnlockedAt)
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

      {steam && library && (
        <section className="steam-detail-row">
          <article className="detail-card steam-progress-card">
            <div className="steam-progress-heading">
              <h2>Прогресс Steam</h2>
              {library.steamAppId != null && (
                <button
                  className="secondary-button icon-button"
                  disabled={syncingSteam}
                  onClick={() => void synchronizeSteam()}
                >
                  <RefreshCw className={syncingSteam ? "spinning" : ""} />
                  {syncingSteam
                    ? "Синхронизируем…"
                    : steamProgress
                      ? "Обновить"
                      : "Загрузить из Steam"}
                </button>
              )}
            </div>
            {steamError && <div className="form-error">{steamError}</div>}
            {library.steamAppId == null ? (
              <p className="muted">
                У этой копии нет Steam App ID. Добавьте её через импорт Steam.
              </p>
            ) : steamProgress ? (
              steamProgress.totalAchievements > 0 ? (
                <Progress
                  label="Достижения"
                  value={`${steamProgress.unlockedAchievements} / ${steamProgress.totalAchievements}`}
                  percent={steamProgress.achievementPercent}
                />
              ) : (
                <p className="muted">У этой игры нет достижений Steam.</p>
              )
            ) : (
              <p className="muted">
                Нажмите «Загрузить из Steam», чтобы получить достижения этой копии.
              </p>
            )}
            {steamProgress && (
              <small className="steam-sync-date">
                Обновлено: {formatDate(steamProgress.lastSyncedAt)}
              </small>
            )}
          </article>
          <article className="detail-card achievement-summary steam-achievement-summary">
            <h2>Достижения Steam</h2>
            {steamProgress && steamProgress.totalAchievements > 0 ? (
              <>
                {recentSteamAchievements.length > 0 ? (
                  <div className="steam-recent-achievements">
                    {recentSteamAchievements.map((achievement) => (
                      <SteamAchievementRow
                        achievement={achievement}
                        compact
                        key={achievement.apiName}
                      />
                    ))}
                  </div>
                ) : (
                  <p>Полученных достижений пока нет.</p>
                )}
                <strong>
                  {steamCompleted100
                    ? "✓ Получено 100%"
                    : `${steamProgress.unlockedAchievements} из ${steamProgress.totalAchievements} получено`}
                </strong>
                {steamProgress.lastUnlockedAt && (
                  <span>
                    Последнее достижение: {formatDate(steamProgress.lastUnlockedAt)}
                  </span>
                )}
                <button
                  className="achievement-details-button"
                  onClick={() => setShowSteamAchievements(true)}
                >
                  Все достижения
                </button>
              </>
            ) : (
              <p className="muted">
                {steamProgress ? "Достижений нет" : "Нет данных"}
              </p>
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
                    {supportsXboxProgress(entry) && (
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
          <button
            className="primary-button"
            disabled={!library}
            onClick={() => setAddingSession(true)}
          >
            + Добавить сессию
          </button>
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
                  {item.completionSource === "STEAM_ACHIEVEMENTS" && (
                    <small>Автоматически · 100% достижений Steam</small>
                  )}
                  {item.completionSource === "XBOX_ACHIEVEMENTS" && (
                    <small>Автоматически · 100% достижений Xbox</small>
                  )}
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

      <section className="detail-card sessions-table-card game-view-sessions">
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
                  <span className="game-view-session-note">{item.note ?? "—"}</span>
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
      {editingGame && (
        <GameForm
          game={game}
          library={library ?? undefined}
          platforms={platforms}
          sources={sources}
          progress={baseAchievements ?? progress}
          onClose={() => { restoreEditFocusRef.current = true; setEditingGame(false); }}
          onSaved={() => {
            restoreEditFocusRef.current = true;
            setEditingGame(false);
            void load();
          }}
          onDeleted={() => navigate("/games", { replace: true })}
        />
      )}
      {showAchievementDetails && library && (
        <AchievementGroupsModal
          libraryId={library.id}
          groups={achievementGroups}
          onClose={() => setShowAchievementDetails(false)}
          onSaved={() => void load()}
        />
      )}
      {showSteamAchievements && steamProgress && (
        <SteamAchievementsModal
          progress={steamProgress}
          onClose={() => setShowSteamAchievements(false)}
        />
      )}
      {showXboxAchievements && progress && xboxAchievements.length > 0 && (
        <XboxAchievementsModal
          achievements={xboxAchievements}
          progress={progress}
          onClose={() => setShowXboxAchievements(false)}
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
      {addingSession && library && (
        <GameSessionForm
          library={[library]}
          onClose={() => setAddingSession(false)}
          onSaved={() => {
            setAddingSession(false);
            void load();
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
      await putGameProfile(contentId, {
        status: saved.status,
        rating: saved.rating,
        favorite: saved.favorite,
        startedAt: saved.startedAt,
        completedAt: saved.completedAt,
        personalNote: saved.personalNote,
      });
      if (!entry && supportsXboxProgress(saved))
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

function SteamAchievementsModal({
  progress,
  onClose,
}: {
  progress: SteamProgress;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="steam-achievements-modal">
        <div className="form-heading">
          <div>
            <p className="eyebrow">Steam</p>
            <h2>Достижения</h2>
          </div>
          <button type="button" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="steam-achievements-modal-summary">
          <strong>
            {progress.unlockedAchievements} / {progress.totalAchievements}
          </strong>
          <span>{Math.round(progress.achievementPercent)}% получено</span>
        </div>
        <div className="steam-achievement-list">
          {progress.achievements.map((achievement) => (
            <SteamAchievementRow
              achievement={achievement}
              key={achievement.apiName}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function XboxAchievementsModal({
  achievements,
  progress,
  onClose,
}: {
  achievements: XboxAchievement[];
  progress: XboxProgress;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="steam-achievements-modal">
        <div className="form-heading">
          <div>
            <p className="eyebrow">Xbox</p>
            <h2>Достижения</h2>
          </div>
          <button type="button" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="steam-achievements-modal-summary">
          <strong>
            {progress.unlockedAchievements} / {progress.totalAchievements}
          </strong>
          <span>
            {Math.round(progress.achievementPercent)}% · {progress.earnedGamerscore} /{" "}
            {progress.totalGamerscore} G
          </span>
        </div>
        <div className="steam-achievement-list">
          {achievements.map((achievement) => (
            <XboxAchievementRow
              achievement={achievement}
              key={achievement.achievementId}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function XboxAchievementRow({
  achievement,
  compact = false,
}: {
  achievement: XboxAchievement;
  compact?: boolean;
}) {
  return (
    <article
      className={`steam-achievement xbox-achievement ${achievement.unlocked ? "unlocked" : "locked"}${compact ? " compact" : ""}`}
    >
      {achievement.iconUrl ? (
        <img src={achievement.iconUrl} alt="" loading="lazy" />
      ) : (
        <span className="steam-achievement-placeholder" aria-hidden="true">
          ◇
        </span>
      )}
      <div>
        <strong>
          {achievement.hidden && !achievement.unlocked
            ? "Скрытое достижение"
            : achievement.displayName}
        </strong>
        {!compact && (
          <p>
            {achievement.hidden && !achievement.unlocked
              ? achievement.lockedDescription || "Описание скрыто"
              : achievement.description || achievement.lockedDescription || "Без описания"}
          </p>
        )}
      </div>
      <div className="xbox-achievement-meta">
        {!compact && <b>{achievement.gamerscore} G</b>}
        <time>
          {achievement.unlocked
            ? formatDate(achievement.unlockedAt)
            : "Не получено"}
        </time>
      </div>
    </article>
  );
}

function SteamAchievementRow({
  achievement,
  compact = false,
}: {
  achievement: SteamAchievement;
  compact?: boolean;
}) {
  const image = achievement.unlocked
    ? achievement.iconUrl
    : achievement.lockedIconUrl;
  return (
    <article
      className={`steam-achievement ${achievement.unlocked ? "unlocked" : "locked"}${compact ? " compact" : ""}`}
    >
      {image ? (
        <img src={image} alt="" loading="lazy" />
      ) : (
        <span className="steam-achievement-placeholder" aria-hidden="true">
          ◇
        </span>
      )}
      <div>
        <strong>{achievement.displayName}</strong>
        {!compact && (
          <p>
            {achievement.hidden && !achievement.unlocked
              ? "Скрытое достижение"
              : achievement.description || "Без описания"}
          </p>
        )}
      </div>
      <time>
        {achievement.unlocked
          ? formatDate(achievement.unlockedAt)
          : "Не получено"}
      </time>
    </article>
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
