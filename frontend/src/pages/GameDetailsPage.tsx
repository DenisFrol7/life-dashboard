import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronRight, Clock3, Heart, Pencil, Plus, RefreshCw } from "lucide-react";
import { PlatformBadge } from "../components/PlatformBadge";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { getApiErrorMessage } from "../api/client";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { useFormMutation } from "../hooks/useFormMutation";
import { GameForm, GameSessionForm } from "./GamesPage";
import {
  createGameLibrary,
  createGamePlaythrough,
  deleteGameLibrary,
  deleteGamePlaythrough,
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
  type Game,
  type GameLibrary,
  type GameLibraryInput,
  type GamePlaythrough,
  type GamePlaythroughInput,
  type GameSession,
  type Reference,
  type SteamProgress,
  type XboxAchievement,
  type XboxAchievementDetailsStatus,
  type XboxAchievementGroup,
  type XboxProgress,
} from "../api/games";
import type { LibraryStatus } from "../api/movies";
import { AchievementGroupsModal, SteamAchievementsModal, XboxAchievementsModal } from "../components/GameAchievementDialogs";
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
  const progressRequests = useLatestRequest();
  const syncMutations = useFormMutation();
  const editRef = useRef<HTMLButtonElement>(null);
  const restoreEditFocusRef = useRef(false);
  const collectionRef = useRef<HTMLElement>(null);
  const collectionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const collectionFallbackRef = useRef('.game-view-library-add');
  const restoreCollectionFocusRef = useRef(false);
  const [game, setGame] = useState<Game | null>(null);
  const [libraries, setLibraries] = useState<GameLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(
    null,
  );
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [addingSession, setAddingSession] = useState(false);
  const [progress, setProgress] = useState<XboxProgress | null>(null);
  const [xboxAchievements, setXboxAchievements] = useState<XboxAchievement[]>([]);
  const [syncProvider, setSyncProvider] = useState<"XBOX" | "STEAM" | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [xboxError, setXboxError] = useState<string | null>(null);
  const [xboxSyncNote, setXboxSyncNote] = useState<string | null>(null);
  const [steamProgress, setSteamProgress] = useState<SteamProgress | null>(null);
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
  const collectionFormOpen = Boolean(editingLibrary || editingPlaythrough || addingSession);
  const selectedLibraryRef = useRef(selectedLibraryId);
  selectedLibraryRef.current = selectedLibraryId;
  const syncingXbox = syncMutations.pending && syncProvider === "XBOX";
  const syncingSteam = syncMutations.pending && syncProvider === "STEAM";

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
    if (!restoreCollectionFocusRef.current || collectionFormOpen || loading) return;
    restoreCollectionFocusRef.current = false;
    const previous = collectionTriggerRef.current;
    const fallback = collectionRef.current?.querySelector<HTMLButtonElement>(collectionFallbackRef.current)
      ?? collectionRef.current?.querySelector<HTMLButtonElement>('.game-view-library-add');
    const target = error ? document.querySelector<HTMLButtonElement>('.game-view-page > .async-error button')
      : previous?.isConnected && !previous.disabled ? previous : fallback;
    target?.focus({ preventScroll: true });
  }, [collectionFormOpen, loading, error]);

  const closeCollectionForms = (refresh = false) => {
    restoreCollectionFocusRef.current = true;
    setEditingLibrary(null); setEditingPlaythrough(null); setAddingSession(false);
    if (refresh) void load();
  };

  const loadProgress = useCallback((preserveState = false) => {
    const selectedLibrary = libraries.find(
      (item) => item.id === selectedLibraryId,
    );
    return progressRequests.run(async () => {
      if (selectedLibrary && supportsXboxProgress(selectedLibrary)) {
        const [xbox, groups, achievements] = await Promise.all([
          getXboxProgress(selectedLibrary.id),
          getXboxAchievementGroups(selectedLibrary.id),
          getXboxAchievements(selectedLibrary.id),
        ]);
        return { xbox, groups, achievements, steam: null };
      }
      const steam = selectedLibrary && isSteam(selectedLibrary)
        ? await getSteamProgress(selectedLibrary.id) : null;
      return { xbox: null, groups: [], achievements: [], steam };
    }, {
      onStart: () => {
        if (preserveState) { setXboxError(null); setSteamError(null); return; }
        setProgressLoading(true);
        setProgress(null); setXboxAchievements([]); setAchievementGroups([]);
        setXboxError(null); setXboxSyncNote(null); setSteamProgress(null); setSteamError(null);
        setShowAchievementDetails(false); setShowSteamAchievements(false); setShowXboxAchievements(false);
      },
      onSuccess: data => {
        setProgress(data.xbox); setAchievementGroups(data.groups);
        setXboxAchievements(data.achievements); setSteamProgress(data.steam);
      },
      onError: reason => {
        const message = getApiErrorMessage(reason, "Не удалось загрузить прогресс игры");
        if (selectedLibrary && supportsXboxProgress(selectedLibrary)) setXboxError(message);
        else setSteamError(message);
      },
      onFinish: () => setProgressLoading(false),
    });
  }, [libraries, selectedLibraryId, progressRequests]);
  useEffect(() => {
    void loadProgress();
    return () => progressRequests.invalidate();
  }, [loadProgress, progressRequests]);

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
    if (!library || !isSteam(library) || library.steamAppId == null || progressLoading) return;
    const libraryId = library.id;
    await syncMutations.run('save', async () => {
      setSyncProvider("STEAM"); setSteamError(null);
      return syncSteamProgress(libraryId);
    }, {
      onSuccess: synchronized => {
        if (selectedLibraryRef.current !== libraryId) return;
        progressRequests.invalidate(); setProgressLoading(false);
        setSteamProgress(synchronized);
        void load();
      },
      onError: reason => {
        if (selectedLibraryRef.current === libraryId)
          setSteamError(getApiErrorMessage(reason, "Не удалось синхронизировать достижения Steam"));
      },
    });
  };

  const synchronizeXbox = async () => {
    if (!library || !supportsXboxProgress(library) || progressLoading) return;
    const libraryId = library.id;
    await syncMutations.run('save', async () => {
      setSyncProvider("XBOX"); setXboxError(null); setXboxSyncNote(null);
      const synchronized = await syncXboxProgress(libraryId);
      const [achievements, groups] = await Promise.all([
        getXboxAchievements(libraryId),
        synchronized.manualDlcGroupsPreserved ? Promise.resolve(null) : getXboxAchievementGroups(libraryId),
      ]);
      return { synchronized, achievements, groups };
    }, {
      onSuccess: ({ synchronized, achievements, groups }) => {
        if (selectedLibraryRef.current !== libraryId) return;
        progressRequests.invalidate(); setProgressLoading(false);
        setProgress(synchronized.progress); setXboxAchievements(achievements);
        if (groups) setAchievementGroups(groups);
        const diagnostic = xboxAchievementDiagnostic(
          synchronized.progress.achievementDetailsStatus,
        );
        setXboxSyncNote(
          `Связано с Xbox: ${synchronized.xboxTitle}${diagnostic ? `. ${diagnostic.text}` : ""}`,
        );
        if (synchronized.completionRecorded) void load();
      },
      onError: reason => {
        if (selectedLibraryRef.current === libraryId)
          setXboxError(getApiErrorMessage(reason, "Не удалось синхронизировать достижения Xbox"));
      },
    });
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
        <section className="game-view-progress-set" data-provider="XBOX" aria-label="Xbox">
          <article className="game-view-progress-panel">
            <div className="game-view-progress-heading">
              <h2>Прогресс Xbox</h2>
              <button
                type="button"
                className="secondary-button icon-button"
                disabled={progressLoading || syncMutations.pending}
                aria-busy={syncingXbox}
                onClick={() => void synchronizeXbox()}
              >
                <RefreshCw aria-hidden="true" className={syncingXbox ? "spinning" : ""} />
                {syncingXbox
                  ? "Синхронизируем…"
                  : progress
                    ? "Обновить"
                    : "Загрузить из Xbox"}
              </button>
            </div>
            {sharedXboxAchievementSet && (
              <small className="game-view-progress-note">
                Общий набор достижений для PC- и Xbox-копии
              </small>
            )}
            {xboxError && <div className="game-view-progress-error" role="alert"><p>{xboxError}</p>{!progress && <button type="button" className="secondary-button" disabled={syncMutations.pending} onClick={() => void loadProgress()}>Повторить загрузку</button>}</div>}
            {progressLoading ? <LoadingState message="Загружаем прогресс Xbox…" compact /> : progress ? (
              <div className="game-view-metrics">
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
              <p className="game-view-progress-message">
                Нажмите «Загрузить из Xbox» или укажите прогресс вручную в настройках игры.
              </p>
            )}
            {xboxSyncNote && <small className="game-view-progress-note">{xboxSyncNote}</small>}
          </article>
          <article className="game-view-achievement-panel">
            <h2>{xboxAchievements.length ? "Достижения Xbox" : "Достижения"}</h2>
            {progressLoading ? <p className="game-view-progress-message" role="status">Загружаем достижения…</p> : <>
              {xboxDiagnostic && (
                <p
                  className={`game-view-achievement-notice${xboxDiagnostic.warning ? " warning" : ""}`}
                >
                  {xboxDiagnostic.text}
                </p>
              )}
              {progress && xboxAchievements.length ? (
                <>
                  {recentXboxAchievements.length > 0 ? (
                    <div className="game-view-recent">
                      {recentXboxAchievements.map((achievement) => (
                        <AchievementPreview title={achievement.hidden && !achievement.unlocked ? "??????? ??????????" : achievement.displayName} image={achievement.iconUrl} unlockedAt={achievement.unlockedAt} key={achievement.achievementId} />
                      ))}
                    </div>
                  ) : (
                    <p>Полученных достижений пока нет.</p>
                  )}
                  <strong className="game-view-achievement-total">
                    {completed100
                      ? "✓ Получено 100%"
                      : `${progress.unlockedAchievements} из ${progress.totalAchievements} получено`}
                  </strong>
                  {progress.lastUnlockedAt && (
                    <span className="game-view-achievement-date">
                      Последнее достижение: {formatDate(progress.lastUnlockedAt)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="game-view-achievement-action"
                    disabled={syncMutations.pending}
                    onClick={() => setShowXboxAchievements(true)}
                  >
                    Все достижения
                  </button>
                </>
              ) : progress ? (
                <>
                  <div className="game-view-achievement-groups">
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
                  <strong className="game-view-achievement-total">
                    {completed100
                      ? "✓ Получено 100%"
                      : `${progress.earnedGamerscore} G получено`}
                  </strong>
                  {progress.unlockedAchievements > 0 && (
                    <span className="game-view-achievement-date">
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
                    type="button"
                    className="game-view-achievement-action"
                    disabled={syncMutations.pending}
                    onClick={() => setShowAchievementDetails(true)}
                  >
                    Подробнее
                  </button>
                </>
              ) : (
                <p className="game-view-progress-message">Нет данных</p>
              )}
            </>}
          </article>
        </section>
      )}

      {steam && library && (
        <section className="game-view-progress-set" data-provider="STEAM" aria-label="Steam">
          <article className="game-view-progress-panel">
            <div className="game-view-progress-heading">
              <h2>Прогресс Steam</h2>
              {library.steamAppId != null && (
                <button
                  type="button"
                  className="secondary-button icon-button"
                  disabled={progressLoading || syncMutations.pending}
                  aria-busy={syncingSteam}
                  onClick={() => void synchronizeSteam()}
                >
                  <RefreshCw aria-hidden="true" className={syncingSteam ? "spinning" : ""} />
                  {syncingSteam
                    ? "Синхронизируем…"
                    : steamProgress
                      ? "Обновить"
                      : "Загрузить из Steam"}
                </button>
              )}
            </div>
            {steamError && <div className="game-view-progress-error" role="alert"><p>{steamError}</p>{!steamProgress && <button type="button" className="secondary-button" disabled={syncMutations.pending} onClick={() => void loadProgress()}>Повторить загрузку</button>}</div>}
            {progressLoading ? <LoadingState message="Загружаем прогресс Steam…" compact /> : library.steamAppId == null ? (
              <p className="game-view-progress-message">
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
                <p className="game-view-progress-message">У этой игры нет достижений Steam.</p>
              )
            ) : (
              <p className="game-view-progress-message">
                Нажмите «Загрузить из Steam», чтобы получить достижения этой копии.
              </p>
            )}
            {steamProgress && (
              <small className="game-view-progress-note">
                Обновлено: {formatDate(steamProgress.lastSyncedAt)}
              </small>
            )}
          </article>
          <article className="game-view-achievement-panel">
            <h2>Достижения Steam</h2>
            {progressLoading ? <p className="game-view-progress-message" role="status">Загружаем достижения…</p> : steamProgress && steamProgress.totalAchievements > 0 ? (
              <>
                {recentSteamAchievements.length > 0 ? (
                  <div className="game-view-recent">
                    {recentSteamAchievements.map((achievement) => (
                      <AchievementPreview title={achievement.displayName} image={achievement.iconUrl} unlockedAt={achievement.unlockedAt} key={achievement.apiName} />
                    ))}
                  </div>
                ) : (
                  <p>Полученных достижений пока нет.</p>
                )}
                <strong className="game-view-achievement-total">
                  {steamCompleted100
                    ? "✓ Получено 100%"
                    : `${steamProgress.unlockedAchievements} из ${steamProgress.totalAchievements} получено`}
                </strong>
                {steamProgress.lastUnlockedAt && (
                  <span className="game-view-achievement-date">
                    Последнее достижение: {formatDate(steamProgress.lastUnlockedAt)}
                  </span>
                )}
                <button
                  type="button"
                  className="game-view-achievement-action"
                  disabled={syncMutations.pending}
                  onClick={() => setShowSteamAchievements(true)}
                >
                  Все достижения
                </button>
              </>
            ) : (
              <p className="game-view-progress-message">
                {steamProgress ? "Достижений нет" : "Нет данных"}
              </p>
            )}
          </article>
        </section>
      )}

      <section ref={collectionRef} className="game-view-collection" aria-label="Библиотека и история игры" onClickCapture={event => {
        const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
        if (button) {
          collectionTriggerRef.current = button;
          collectionFallbackRef.current = button.dataset.focusFallback ?? '.game-view-library-add';
        }
      }}>
        <article className="game-view-library">
          <div className="game-view-library-heading">
            <h2>Библиотека</h2>
            <button type="button" className="secondary-button icon-button game-view-library-add" data-focus-fallback=".game-view-library-add" onClick={() => setEditingLibrary("new")}><Plus aria-hidden="true" />Добавить</button>
          </div>
          {libraries.length ? (
            <ul className="game-view-copies" aria-label="Копии игры">
              {libraries.map((entry) => (
                <li className="game-view-copy" data-selected={entry.id === library?.id} key={entry.id}>
                  <button type="button" className="game-view-copy-select" data-library-id={entry.id} aria-pressed={entry.id === library?.id}
                    aria-label={`Выбрать копию: ${entry.platform.name} · ${entry.source.name}`}
                    data-focus-fallback={`.game-view-copy-select[data-library-id="${entry.id}"]`} onClick={() => setSelectedLibraryId(entry.id)}>
                    <strong>{entry.source.name}</strong>
                    <span>
                      {entry.platform.name}
                      {entry.edition ? ` · ${entry.edition}` : ""}
                    </span>
                    {supportsXboxProgress(entry) && (
                      <small>
                        Xbox Play Anywhere ·{" "}
                        {game.xboxPlayAnywhere ? "Да" : "Нет"}
                      </small>
                    )}
                    <span className="game-view-copy-access">
                      {entry.accessType === "SUBSCRIPTION"
                        ? "Подписка"
                        : "Куплено"}
                    </span>
                  </button>
                  <button type="button" className="game-view-copy-edit" data-library-id={entry.id}
                    data-focus-fallback={`.game-view-copy-edit[data-library-id="${entry.id}"]`}
                    aria-label={`Редактировать копию: ${entry.platform.name} · ${entry.source.name}`} onClick={() => setEditingLibrary(entry)}><Pencil aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="game-view-collection-empty">Игра не добавлена в библиотеку.</p>
          )}
        </article>
        <article className="game-view-playtime">
          <h2>Время выбранной копии</h2>
          {library && <p className="game-view-selected-copy">{library.platform.name} · {library.source.name}</p>}
          <strong className="game-view-playtime-value"><Clock3 aria-hidden="true" /><span>{formatMinutes(totalMinutes)}</span></strong>
          <dl><div><dt>Последняя сессия</dt><dd>
            {latestSession
              ? formatDate(latestSession.startedAt)
              : "Сессий пока нет"}
          </dd></div></dl>
          <button
            type="button" className="primary-button icon-button game-view-session-add" data-focus-fallback=".game-view-session-add"
            disabled={!library}
            onClick={() => setAddingSession(true)}
          >
            <Plus aria-hidden="true" />Добавить сессию
          </button>
        </article>
        <article className="game-view-history">
          <h2>История прохождений</h2>
          {playthroughs.length ? <ul className="game-view-playthroughs">
            {playthroughs.map((item) => (
              <li key={item.id}><button
                type="button"
                className="game-view-history-item" data-playthrough-id={item.id}
                data-focus-fallback=".game-view-history-add"
                aria-label={`Изменить прохождение №${item.playthroughNumber} от ${formatDate(item.completedAt)}`}
                onClick={() => setEditingPlaythrough(item)}
              >
                <span className="game-view-playthrough-number" aria-hidden="true">{item.playthroughNumber}</span>
                <span className="game-view-playthrough-copy">
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
                  <time dateTime={item.completedAt}>{formatDate(item.completedAt)}</time>
                  {item.completionSource === "STEAM_ACHIEVEMENTS" && (
                    <small>Автоматически · 100% достижений Steam</small>
                  )}
                  {item.completionSource === "XBOX_ACHIEVEMENTS" && (
                    <small>Автоматически · 100% достижений Xbox</small>
                  )}
                  {item.note && <span className="game-view-playthrough-note">{item.note}</span>}
                  <b className="game-view-playthrough-duration"><Clock3 aria-hidden="true" />{formatMinutes(item.playtimeMinutes)}</b>
                </span>
                <ChevronRight aria-hidden="true" />
              </button></li>
            ))}
          </ul> : <p className="game-view-collection-empty">Прохождений пока нет.</p>}
          {library && (
            <button
              type="button" className="secondary-button game-view-history-add" data-focus-fallback=".game-view-history-add"
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
          gameTitle={game.title}
          libraryId={library.id}
          groups={achievementGroups}
          onClose={() => { setShowAchievementDetails(false); void loadProgress(true); }}
          onChanged={setAchievementGroups}
        />
      )}
      {showSteamAchievements && steamProgress && (
        <SteamAchievementsModal
          gameTitle={game.title}
          progress={steamProgress}
          onClose={() => setShowSteamAchievements(false)}
        />
      )}
      {showXboxAchievements && progress && xboxAchievements.length > 0 && (
        <XboxAchievementsModal
          gameTitle={game.title}
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
          onClose={() => closeCollectionForms()}
          onSaved={() => closeCollectionForms(true)}
        />
      )}
      {editingLibrary && (
        <LibraryEntryModal
          contentId={game.id}
          entry={editingLibrary === "new" ? undefined : editingLibrary}
          platforms={platforms}
          sources={sources}
          onClose={() => closeCollectionForms()}
          onSaved={(id) => {
            if (!libraries.some((entry) => entry.id === id)) {
              setSelectedLibraryId(id);
              collectionFallbackRef.current = `.game-view-copy-select[data-library-id="${id}"]`;
            }
            closeCollectionForms(true);
          }}
        />
      )}
      {addingSession && library && (
        <GameSessionForm
          library={[library]}
          onClose={() => closeCollectionForms()}
          onSaved={() => closeCollectionForms(true)}
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

function AchievementPreview({ title, image, unlockedAt }: { title: string; image: string | null; unlockedAt: string | null }) {
  return <article className="game-view-achievement-row">
    <span className="game-view-achievement-icon" aria-hidden="true">◇{image && <img src={image} alt="" loading="lazy" decoding="async" onLoad={event => { event.currentTarget.hidden = false; }} onError={event => { event.currentTarget.hidden = true; }} />}</span>
    <div><strong>{title}</strong><time dateTime={unlockedAt ?? undefined}>{formatDate(unlockedAt)}</time></div>
  </article>;
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
  const clamped = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  return (
    <div className="game-view-meter">
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{Math.round(clamped)}%</em>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped)} aria-valuetext={`${value} (${Math.round(clamped)}%)`}>
        <span style={{ width: `${clamped}%` }} />
      </div>
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
