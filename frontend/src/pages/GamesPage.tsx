import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ChevronDown, Download, Gamepad2, Heart, ListChecks, Plus, RefreshCw, Search, X } from "lucide-react";
import {
  createGame,
  createGameLibrary,
  createRawgGame,
  deleteGame,
  getGameCatalog,
  getGameLibrary,
  getGameSessions,
  getPlatforms,
  getSources,
  getSteamLibrarySummary,
  getSteamGridDbCovers,
  getXboxLibrarySummary,
  importXboxGames,
  importSteamGames,
  prepareXboxImport,
  prepareSteamImport,
  previewRawgGame,
  previewSteamImport,
  previewXboxImport,
  putGameProfile,
  putXboxProgress,
  searchRawgGames,
  searchSteamGridDbGames,
  syncRecentSteamProgress,
  syncLinkedXboxProgress,
  updateGame,
  updateGameLibrary,
  updateRawgGame,
  type Game,
  type GameInput,
  type GameLibrary,
  type GameLibraryInput,
  type GameSession,
  type Reference,
  type RawgGameCandidate,
  type SteamGridDbCoverCandidate,
  type SteamGridDbGameCandidate,
  type SteamImportMatch,
  type SteamImportPreview,
  type SteamImportSelection,
  type SteamLibrarySummary,
  type SteamRecentSyncResult,
  type XboxBulkSyncResult,
  type XboxImportMatch,
  type XboxImportPreview,
  type XboxImportSelection,
  type XboxProgress,
  type XboxProgressInput,
} from "../api/games";
import type { LibraryInput, LibraryStatus } from "../api/movies";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { useToast } from "../components/ToastContext";
import { useLatestRequest } from "../hooks/useLatestRequest";
import { useFormMutation } from "../hooks/useFormMutation";
import { getApiErrorMessage } from "../api/client";
import { GameSessionForm } from "../components/GameSessionForm";
import "./GamesPage.css";

const statusLabels: Record<LibraryStatus, string> = {
  NOT_STARTED: "Не начато",
  PLANNED: "В планах",
  IN_PROGRESS: "Играю",
  COMPLETED: "Пройдено",
  PAUSED: "На паузе",
  DROPPED: "Брошено",
};
const emptyGame: GameInput = {
  title: "",
  originalTitle: null,
  itemType: "GAME",
  format: null,
  releaseYear: null,
  description: null,
  coverUrl: null,
  backgroundUrl: null,
  durationMinutes: null,
  releaseStatus: "RELEASED",
  genre: null,
  developer: null,
  releaseDate: null,
  xboxPlayAnywhere: false,
  steamGridDbGameId: null,
  steamGridDbGridId: null,
};
const emptyProgress: XboxProgressInput = {
  totalAchievements: 0,
  unlockedAchievements: 0,
  totalGamerscore: 0,
  earnedGamerscore: 0,
};
const isXbox = (code: string) =>
  code.startsWith("XBOX_") || code === "ORIGINAL_XBOX";
const supportsXboxProgress = (entry: GameLibrary) =>
  isXbox(entry.platform.code) ||
  (entry.platform.code === "PC" &&
    ["MICROSOFT_STORE", "GAME_PASS"].includes(entry.source.code));
type AchievementProvider = "XBOX" | "STEAM";
type GameQualityIssueKind =
  | "RAWG"
  | "COVER"
  | "STEAM_LINK"
  | "XBOX_LINK"
  | "STEAM_PROGRESS"
  | "XBOX_PROGRESS"
  | "XBOX_DETAILS";
type GameQualityRow = {
  game: Game;
  issues: GameQualityIssueKind[];
};
type GameFilters = {
  query: string;
  status: LibraryStatus | "GAME_PASS" | "";
  platform: string;
  source: string;
};

const GAME_FILTERS_STORAGE_KEY = "life-dashboard.games.filters";
const GAME_VISIBLE_COUNT_STORAGE_KEY = "life-dashboard.games.visible-count";
const GAME_PAGE_SIZE = 50;
const gameQualityIssueLabels: Record<GameQualityIssueKind, string> = {
  RAWG: "Нет RAWG",
  COVER: "Нет вертикальной обложки",
  STEAM_LINK: "Steam не привязан",
  XBOX_LINK: "Xbox не привязан",
  STEAM_PROGRESS: "Steam-достижения не проверены",
  XBOX_PROGRESS: "Xbox-достижения не проверены",
  XBOX_DETAILS: "Нет списка Xbox",
};
const gameFilterStatuses = new Set<LibraryStatus | "GAME_PASS" | "">([
  "",
  "NOT_STARTED",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "PAUSED",
  "DROPPED",
  "GAME_PASS",
]);
const emptyGameFilters: GameFilters = {
  query: "",
  status: "",
  platform: "",
  source: "",
};

function readGameFilters(): GameFilters {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(GAME_FILTERS_STORAGE_KEY) ?? "{}",
    ) as Partial<GameFilters>;
    return {
      query: typeof saved.query === "string" ? saved.query : "",
      status:
        typeof saved.status === "string" && gameFilterStatuses.has(saved.status)
          ? saved.status
          : "",
      platform: typeof saved.platform === "string" ? saved.platform : "",
      source: typeof saved.source === "string" ? saved.source : "",
    };
  } catch {
    return emptyGameFilters;
  }
}

function readVisibleGameCount() {
  const saved = Number(sessionStorage.getItem(GAME_VISIBLE_COUNT_STORAGE_KEY));
  return Number.isInteger(saved) && saved >= GAME_PAGE_SIZE
    ? saved
    : GAME_PAGE_SIZE;
}

function newestBy<T>(items: T[], timestamp: (item: T) => string) {
  return items.reduce<T | undefined>((latest, item) => {
    if (!latest) return item;
    return Date.parse(timestamp(item)) > Date.parse(timestamp(latest))
      ? item
      : latest;
  }, undefined);
}

export function GamesPage() {
  const navigate = useNavigate();
  const requests = useLatestRequest();
  const pageRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const sessionAddRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogWasOpenRef = useRef(false);
  const [statisticsExpanded, setStatisticsExpanded] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [savedFilters] = useState(readGameFilters);
  const legacyGamePassFilterRef = useRef(savedFilters.status === "GAME_PASS");
  const [games, setGames] = useState<Game[]>([]);
  const [library, setLibrary] = useState<Record<number, GameLibrary>>({});
  const [libraryEntries, setLibraryEntries] = useState<GameLibrary[]>([]);
  const [platforms, setPlatforms] = useState<Reference[]>([]);
  const [sources, setSources] = useState<Reference[]>([]);
  const [xbox, setXbox] = useState<Record<number, XboxProgress | null>>({});
  const [steam, setSteam] = useState<Record<number, SteamLibrarySummary>>({});
  const [xboxBase, setXboxBase] = useState<
    Record<number, XboxProgressInput | null>
  >({});
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [editing, setEditing] = useState<Game | "new" | null>(null);
  const [editingSession, setEditingSession] = useState<
    GameSession | "new" | null
  >(null);
  const [steamImportOpen, setSteamImportOpen] = useState(false);
  const [xboxImportOpen, setXboxImportOpen] = useState(false);
  const [qualityCheckOpen, setQualityCheckOpen] = useState(false);
  const [syncingSteamRecent, setSyncingSteamRecent] = useState(false);
  const [steamRecentResult, setSteamRecentResult] =
    useState<SteamRecentSyncResult | null>(null);
  const [syncingXbox, setSyncingXbox] = useState(false);
  const [xboxSyncResult, setXboxSyncResult] =
    useState<XboxBulkSyncResult | null>(null);
  const [achievementProviderByGame, setAchievementProviderByGame] = useState<
    Record<number, AchievementProvider>
  >({});
  const [query, setQuery] = useState(savedFilters.query);
  const [status, setStatus] = useState<LibraryStatus | "">(
    savedFilters.status === "GAME_PASS" ? "" : savedFilters.status,
  );
  const [platform, setPlatform] = useState(savedFilters.platform);
  const [source, setSource] = useState(savedFilters.source);
  const [visibleCount, setVisibleCount] = useState(readVisibleGameCount);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => requests.run(() => Promise.all([getGameCatalog(), getGameLibrary(), getPlatforms(), getSources(), getGameSessions(), getXboxLibrarySummary(), getSteamLibrarySummary()]), {
    onStart: () => { setLoading(true); setError(null); },
    onSuccess: ([catalog, entries, platformList, sourceList, sessionList, xboxSummary, steamSummary]) => {
      setGames(catalog);
      setLibraryEntries(entries);
      setLibrary(
        Object.fromEntries(entries.map((entry) => [entry.contentId, entry])),
      );
      setPlatforms(platformList);
      setSources(sourceList);
      if (legacyGamePassFilterRef.current) {
        const gamePassSource = sourceList.find(item => item.code === "GAME_PASS");
        setSource(gamePassSource ? String(gamePassSource.id) : "");
        legacyGamePassFilterRef.current = false;
      }
      setSessions(sessionList);
      setXbox(
        Object.fromEntries(
          xboxSummary.map((summary) => [
            summary.libraryEntryId,
            summary.progress,
          ]),
        ),
      );
      setSteam(
        Object.fromEntries(
          steamSummary.map((summary) => [summary.libraryEntryId, summary]),
        ),
      );
      setXboxBase(
        Object.fromEntries(
          xboxSummary.map((summary) => {
            const base = summary.baseGame;
            return [
              summary.libraryEntryId,
              base
                ? {
                    totalAchievements: base.totalAchievements,
                    unlockedAchievements: base.unlockedAchievements,
                    totalGamerscore: base.totalGamerscore,
                    earnedGamerscore: base.earnedGamerscore,
                  }
                : null,
            ];
          }),
        ),
      );
      setInitialized(true);
    },
    onError: reason => setError(getApiErrorMessage(reason, "Не удалось загрузить игры")),
    onFinish: () => setLoading(false),
  }), [requests]);
  useEffect(() => { void load(); return () => requests.invalidate(); }, [load, requests]);
  const dialogOpen = Boolean(editing || editingSession || steamImportOpen || xboxImportOpen || qualityCheckOpen);
  useEffect(() => {
    if (dialogOpen) { dialogWasOpenRef.current = true; return; }
    if (!dialogWasOpenRef.current || loading) return;
    dialogWasOpenRef.current = false;
    const fallback = triggerRef.current?.dataset.sessionId ? sessionAddRef.current : addRef.current;
    (triggerRef.current?.isConnected ? triggerRef.current : fallback)?.focus({ preventScroll: true });
  }, [dialogOpen, loading]);
  useEffect(() => {
    setAchievementProviderByGame({});
  }, [platform, source]);
  useEffect(() => {
    if (legacyGamePassFilterRef.current) return;
    try {
      sessionStorage.setItem(
        GAME_FILTERS_STORAGE_KEY,
        JSON.stringify({ query, status, platform, source } satisfies GameFilters),
      );
    } catch {
      // Фильтры продолжат работать без сохранения, если хранилище недоступно.
    }
  }, [platform, query, source, status]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        GAME_VISIBLE_COUNT_STORAGE_KEY,
        String(visibleCount),
      );
    } catch {
      // Количество показанных игр сбросится после возврата, если хранилище недоступно.
    }
  }, [visibleCount]);
  useEffect(() => {
    const editId = Number(searchParams.get("edit"));
    const game = games.find((item) => item.id === editId);
    if (game) {
      setEditing(game);
      setSearchParams({}, { replace: true });
    }
  }, [games, searchParams, setSearchParams]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return games.filter((game) => {
      const entry = library[game.id];
      const copies = libraryEntries.filter(
        (item) => item.contentId === game.id,
      );
      const matchesStatus = !status || entry?.status === status;
      const matchesLocation =
        (!platform && !source) ||
        copies.some(
          (item) =>
            (!platform || String(item.platform.id) === platform) &&
            (!source || String(item.source.id) === source),
        );
      return (
        (!normalized ||
          game.title.toLocaleLowerCase("ru-RU").includes(normalized)) &&
        matchesStatus &&
        matchesLocation
      );
    });
  }, [games, library, libraryEntries, platform, query, source, status]);
  const visibleGames = visible.slice(0, visibleCount);
  const qualityRows = useMemo<GameQualityRow[]>(() => {
    const libraryContentIds = new Set(
      libraryEntries.map((entry) => entry.contentId),
    );
    return games
      .filter((game) => libraryContentIds.has(game.id))
      .map((game) => {
        const copies = libraryEntries.filter(
          (entry) => entry.contentId === game.id,
        );
        const issues: GameQualityIssueKind[] = [];
        if (game.rawgId == null && !game.rawgSlug) issues.push("RAWG");
        if (!game.coverUrl) issues.push("COVER");
        if (
          copies.some(
            (entry) => entry.source.code === "STEAM" && entry.steamAppId == null,
          )
        )
          issues.push("STEAM_LINK");
        if (
          copies.some((entry) => supportsXboxProgress(entry) && entry.xboxTitleId == null)
        )
          issues.push("XBOX_LINK");
        if (
          copies.some(
            (entry) =>
              entry.source.code === "STEAM" &&
              entry.steamAppId != null &&
              steam[entry.id] == null,
          )
        )
          issues.push("STEAM_PROGRESS");
        if (
          copies.some(
            (entry) =>
              supportsXboxProgress(entry) &&
              entry.xboxTitleId != null &&
              xbox[entry.id] == null,
          )
        )
          issues.push("XBOX_PROGRESS");
        if (
          copies.some((entry) => {
            if (!supportsXboxProgress(entry) || entry.xboxTitleId == null)
              return false;
            const status = xbox[entry.id]?.achievementDetailsStatus;
            return (
              status === "NOT_SYNCHRONIZED" ||
              status === "DETAILS_UNAVAILABLE" ||
              status === "POSSIBLE_PC_VERSION" ||
              status === "TITLE_PLATFORM_MISMATCH"
            );
          })
        )
          issues.push("XBOX_DETAILS");
        return { game, issues };
      })
      .filter((row) => row.issues.length > 0)
      .sort(
        (left, right) =>
          right.issues.length - left.issues.length ||
          left.game.title.localeCompare(right.game.title, "ru"),
      );
  }, [games, libraryEntries, steam, xbox]);
  const sessionPlaytime = sessions.reduce(
    (sum, item) => sum + item.durationMinutes,
    0,
  );
  const countGamesBy = (predicate: (entry: GameLibrary) => boolean) =>
    new Set(libraryEntries.filter(predicate).map((item) => item.contentId))
      .size;
  const xboxGames = countGamesBy((item) => isXbox(item.platform.code));
  const xboxProgressGames = countGamesBy(supportsXboxProgress);
  const pcGames = countGamesBy((item) => item.platform.code === "PC");
  const gamePassGames = countGamesBy(
    (item) => item.source.code === "GAME_PASS",
  );
  const steamGames = countGamesBy((item) => item.source.code === "STEAM");
  const eaGames = countGamesBy((item) => item.source.code === "EA_APP");
  const epicGames = countGamesBy(
    (item) => item.source.code === "EPIC_GAMES_STORE",
  );
  const ubisoftGames = countGamesBy(
    (item) => item.source.code === "UBISOFT_CONNECT",
  );
  const xboxAchievements = Object.values(xbox).reduce(
    (sum, item) => sum + (item?.unlockedAchievements ?? 0),
    0,
  );
  const steamAchievements = Object.values(steam).reduce(
    (sum, item) => sum + item.unlockedAchievements,
    0,
  );
  const totalGamerscore = Object.values(xbox).reduce(
    (sum, item) => sum + (item?.earnedGamerscore ?? 0),
    0,
  );
  const updateRecentSteamProgress = async () => {
    setSyncingSteamRecent(true);
    try {
      const result = await syncRecentSteamProgress();
      setSteamRecentResult(result);
      if (result.updated + result.initiallySynced + result.playtimeUpdated > 0)
        await load();
      const message =
        `Steam: недавних обновлено ${result.updated}, впервые загружено ` +
        `${result.initiallySynced}, время обновлено у ${result.playtimeUpdated}, ` +
        `осталось ${result.remainingUnsynced}`;
      showToast(
        result.failed > 0 ? `${message}, ошибок ${result.failed}` : message,
        result.failed > 0 ? "error" : "success",
      );
    } catch (reason) {
      showToast(
        reason instanceof Error
          ? reason.message
          : "Не удалось обновить достижения Steam",
        "error",
      );
    } finally {
      setSyncingSteamRecent(false);
    }
  };
  const updateXboxProgress = async () => {
    setSyncingXbox(true);
    try {
      const result = await syncLinkedXboxProgress();
      setXboxSyncResult(result);
      if (
        result.updated +
          result.initialized +
          result.completionsRecorded +
          result.playtimeUpdated >
        0
      )
        await load();
      const message =
        `Xbox: обновлено ${result.updated}, впервые загружено ${result.initialized}, ` +
        `уже актуально ${result.upToDate}, время обновлено ${result.playtimeUpdated}, ` +
        `в историю добавлено время ${result.playthroughPlaytimeUpdated}, ` +
        `без связи ${result.skippedUnlinked}`;
      const hasErrors = result.failed > 0 || result.playtimeSyncFailed;
      showToast(
        hasErrors
          ? `${message}, ошибок достижений ${result.failed}${result.playtimeSyncFailed ? ", время не загружено" : ""}`
          : message,
        hasErrors ? "error" : "success",
      );
    } catch (reason) {
      showToast(
        reason instanceof Error
          ? reason.message
          : "Не удалось обновить достижения Xbox",
        "error",
      );
    } finally {
      setSyncingXbox(false);
    }
  };
  return (
    <div ref={pageRef} className="games-library-page" onClickCapture={event => { if (!dialogOpen && event.target instanceof Element) { const button = event.target.closest<HTMLButtonElement>("button"); if (button) triggerRef.current = button; } }}>
      <section className="games-catalog-toolbar" aria-label="Управление каталогом игр">
        <div className="games-catalog-tabs" role="group" aria-label="Статус игры">{([
          ["", "Все"], ["IN_PROGRESS", "Играю"], ["COMPLETED", "Пройдено"], ["NOT_STARTED", "Не начато"], ["PLANNED", "В планах"], ["PAUSED", "На паузе"], ["DROPPED", "Брошено"],
        ] as const).map(([value, label]) => <button type="button" key={value || "all"} aria-pressed={status === value} onClick={() => { setStatus(value); setVisibleCount(GAME_PAGE_SIZE); }}>{label}</button>)}</div>
        <div className="games-catalog-search"><Search aria-hidden="true" /><input type="search" aria-label="Найти игру" value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(GAME_PAGE_SIZE); }} placeholder="Найти игру" /></div>
        <button ref={addRef} type="button" className="primary-button icon-button games-catalog-add" disabled={loading || Boolean(error)} onClick={() => setEditing("new")}><Plus aria-hidden="true" />Добавить игру</button>
        <div className="games-catalog-options">
          <div className="games-catalog-filters"><label>Платформа<select value={platform} onChange={event => { setPlatform(event.target.value); setVisibleCount(GAME_PAGE_SIZE); }}><option value="">Все платформы</option>{platforms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Источник<select value={source} onChange={event => { setSource(event.target.value); setVisibleCount(GAME_PAGE_SIZE); }}><option value="">Все источники</option>{sources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
          <div className="games-catalog-tools"><button type="button" className="games-catalog-tools-toggle" aria-expanded={toolsExpanded} aria-controls="games-catalog-tools" onClick={() => setToolsExpanded(value => !value)}>Импорт и синхронизация<ChevronDown aria-hidden="true" /></button><div id="games-catalog-tools" className="games-catalog-tools-actions" data-expanded={toolsExpanded}>
            <button type="button" className="secondary-button icon-button" disabled={loading || Boolean(error) || syncingXbox || syncingSteamRecent || xboxProgressGames === 0} onClick={() => void updateXboxProgress()} title="Обновить достижения и время связанных Xbox-игр"><RefreshCw aria-hidden="true" className={syncingXbox ? "spinning" : undefined} />{syncingXbox ? "Обновляем Xbox…" : "Обновить Xbox"}</button>
            <button type="button" className="secondary-button icon-button" disabled={loading || Boolean(error)} onClick={() => setXboxImportOpen(true)}><Download aria-hidden="true" />Импорт Xbox</button>
            <button type="button" className="secondary-button icon-button" disabled={loading || Boolean(error) || syncingSteamRecent || syncingXbox || steamGames === 0} onClick={() => void updateRecentSteamProgress()} title="Обновить недавние игры и загрузить достижения для 10 новых"><RefreshCw aria-hidden="true" className={syncingSteamRecent ? "spinning" : undefined} />{syncingSteamRecent ? "Обновляем Steam…" : "Обновить Steam"}</button>
            <button type="button" className="secondary-button icon-button" disabled={loading || Boolean(error)} onClick={() => setSteamImportOpen(true)}><Download aria-hidden="true" />Импорт Steam</button>
          </div></div>
        </div>
      </section>
      <section className="games-catalog-layout">
        <div className="games-catalog-main">
          {xboxSyncResult && (
            <div
              className={`notice steam-recent-sync-summary${xboxSyncResult.failed || xboxSyncResult.playtimeSyncFailed ? " error" : ""}`}
            >
              <strong>Данные Xbox проверены</strong>
              <span>
                Связано: {xboxSyncResult.linkedCopies} из {xboxSyncResult.totalXboxCopies} ·
                обновлено: {xboxSyncResult.updated} · впервые загружено:{" "}
                {xboxSyncResult.initialized} · уже актуально: {xboxSyncResult.upToDate} ·
                время обновлено: {xboxSyncResult.playtimeUpdated}
              </span>
              {xboxSyncResult.playtimeUnavailable > 0 && (
                <span>
                  Время недоступно: {xboxSyncResult.playtimeUnavailable}
                  {xboxSyncResult.playtimeSyncFailed ? " — запрос OpenXBL не выполнен" : ""}
                </span>
              )}
              {xboxSyncResult.playthroughPlaytimeUpdated > 0 && (
                <span>
                  Время добавлено в историю прохождений:{" "}
                  {xboxSyncResult.playthroughPlaytimeUpdated}
                </span>
              )}
              {xboxSyncResult.skippedUnlinked > 0 && (
                <span>Без связи с Xbox: {xboxSyncResult.skippedUnlinked}</span>
              )}
              {xboxSyncResult.completionsRecorded > 0 && (
                <span>
                  Добавлено прохождений: {xboxSyncResult.completionsRecorded}
                </span>
              )}
              {xboxSyncResult.games
                .filter((item) => item.status === "FAILED")
                .map((item) => (
                  <small key={item.libraryEntryId}>
                    {item.title}: {item.message}
                  </small>
                ))}
            </div>
          )}
          {steamRecentResult && (
            <div
              className={`notice steam-recent-sync-summary${steamRecentResult.failed ? " error" : ""}`}
            >
              <strong>Достижения Steam проверены</strong>
              <span>
                Недавних игр: {steamRecentResult.recentlyPlayed} · в библиотеке:{" "}
                {steamRecentResult.matchedLibraryCopies} · обновлено:{" "}
                {steamRecentResult.updated} · уже актуально:{" "}
                {steamRecentResult.upToDate}
                {steamRecentResult.playtimeUpdated > 0 &&
                  ` · время обновлено: ${steamRecentResult.playtimeUpdated}`}
                {steamRecentResult.notImported > 0 &&
                  ` · не импортировано: ${steamRecentResult.notImported}`}
              </span>
              {(steamRecentResult.initiallySynced > 0 ||
                steamRecentResult.remainingUnsynced > 0) && (
                <span>
                  Впервые синхронизировано:{" "}
                  {steamRecentResult.initiallySynced} · осталось без
                  синхронизации: {steamRecentResult.remainingUnsynced}
                </span>
              )}
              {steamRecentResult.games
                .filter((item) => item.status === "FAILED")
                .map((item) => (
                  <small key={item.libraryEntryId}>
                    {item.title}: {item.message}
                  </small>
                ))}
            </div>
          )}
          <div className="games-catalog-heading"><h2>Каталог</h2><output aria-live="polite" aria-atomic="true">{loading ? 'Загружаем игры…' : error ? 'Игры не загружены' : `Показано: ${visibleGames.length} из ${visible.length}`}</output></div>
          {loading ? <LoadingState message="Загружаем игры…" /> : error ? <ErrorState title="Не удалось загрузить игры" message={error} onRetry={() => void load()} /> : visible.length === 0 ? (
            <div className="games-catalog-empty"><Gamepad2 aria-hidden="true" /><h2>{query.trim() || status || platform || source ? "Игры не найдены" : "Каталог пока пуст"}</h2><p>{query.trim() || status || platform || source ? "Попробуйте изменить поиск или фильтры." : "Добавьте первую игру в каталог."}</p>{(query.trim() || status || platform || source) && <button type="button" className="secondary-button" onClick={() => { setQuery(""); setStatus(""); setPlatform(""); setSource(""); setVisibleCount(GAME_PAGE_SIZE); }}>Сбросить фильтры</button>}</div>
          ) : (
            <>
              <section className="games-catalog-grid">
              {visibleGames.map((game) => {
                const entry = library[game.id];
                const copies = libraryEntries.filter(
                  (item) => item.contentId === game.id,
                );
                const platformNames = [
                  ...new Set(copies.map((item) => item.platform.name)),
                ];
                const libraryLabels = [
                  ...new Set(copies.map((item) => item.source.name)),
                ];
                const matchesActiveFilter = (copy: GameLibrary) =>
                  Boolean(platform || source) &&
                  (!platform || String(copy.platform.id) === platform) &&
                  (!source || String(copy.source.id) === source);
                const xboxCandidates = copies
                  .map((copy) => ({ copy, progress: xbox[copy.id] }))
                  .filter(
                    (
                      item,
                    ): item is { copy: GameLibrary; progress: XboxProgress } =>
                      Boolean(
                        item.progress && item.progress.totalAchievements > 0,
                      ),
                  );
                const steamCandidates = copies
                  .map((copy) => ({ copy, progress: steam[copy.id] }))
                  .filter(
                    (
                      item,
                    ): item is {
                      copy: GameLibrary;
                      progress: SteamLibrarySummary;
                    } =>
                      Boolean(
                        item.progress && item.progress.totalAchievements > 0,
                      ),
                  );
                const xboxCandidate =
                  xboxCandidates.find(({ copy }) =>
                    matchesActiveFilter(copy),
                  ) ??
                  xboxCandidates.find(
                    ({ copy }) => copy.status === "IN_PROGRESS",
                  ) ??
                  newestBy(xboxCandidates, ({ progress }) =>
                    progress.lastUpdatedAt,
                  );
                const steamCandidate =
                  steamCandidates.find(({ copy }) =>
                    matchesActiveFilter(copy),
                  ) ??
                  steamCandidates.find(
                    ({ copy }) => copy.status === "IN_PROGRESS",
                  ) ??
                  newestBy(steamCandidates, ({ progress }) =>
                    progress.lastSyncedAt,
                  );
                const hasFilteredXbox = xboxCandidates.some(({ copy }) =>
                  matchesActiveFilter(copy),
                );
                const hasFilteredSteam = steamCandidates.some(({ copy }) =>
                  matchesActiveFilter(copy),
                );
                const preferredProvider: AchievementProvider =
                  hasFilteredSteam !== hasFilteredXbox
                    ? hasFilteredSteam
                      ? "STEAM"
                      : "XBOX"
                    : xboxCandidate
                      ? "XBOX"
                      : "STEAM";
                const manuallySelected = achievementProviderByGame[game.id];
                const selectedProvider: AchievementProvider =
                  (manuallySelected === "STEAM" && steamCandidate) ||
                  (manuallySelected === "XBOX" && xboxCandidate)
                    ? manuallySelected
                    : preferredProvider;
                const selectedProgress =
                  selectedProvider === "STEAM"
                    ? steamCandidate?.progress
                    : xboxCandidate?.progress;
                const hasBothProviders = Boolean(
                  xboxCandidate && steamCandidate,
                );
                return <article className="games-catalog-card" key={game.id} data-game-id={game.id}>
                  <Link className="games-catalog-cover" to={`/games/${game.id}`} aria-label={`Открыть игру «${game.title}»`}><span className="games-catalog-cover-letter" aria-hidden="true">{game.title.slice(0, 1)}</span>{(game.coverUrl || game.backgroundUrl) && <img src={game.coverUrl || game.backgroundUrl!} alt="" loading="lazy" decoding="async" onLoad={event => { event.currentTarget.hidden = false; }} onError={event => { event.currentTarget.hidden = true; }} />}{entry?.favorite && <span className="games-catalog-favorite" role="img" aria-label="В избранном"><Heart aria-hidden="true" /></span>}</Link>
                  <div className="games-catalog-copy">
                    <h3><Link to={`/games/${game.id}`} title={game.title}>{game.title}</Link></h3>
                    <div className="games-catalog-platforms">{platformNames.length ? platformNames.map(name => <span key={name}>{name}</span>) : <span>Не в библиотеке</span>}</div>
                    <div className="games-catalog-meta"><span>{game.releaseYear ?? "Год не указан"}</span><p title={game.genre || undefined}>{game.genre || "Жанр не указан"}</p></div>
                    {libraryLabels.length > 0 && <p className="games-catalog-library" title={libraryLabels.join(" • ")}>{libraryLabels.join(" • ")}</p>}
                    {selectedProgress && <div className="games-catalog-progress" data-provider={selectedProvider}>
                      {hasBothProviders && <div className="games-catalog-provider" role="group" aria-label={`Источник достижений: ${game.title}`}>{(["XBOX", "STEAM"] as const).map(provider => <button type="button" key={provider} aria-pressed={selectedProvider === provider} onClick={() => setAchievementProviderByGame(current => ({ ...current, [game.id]: provider }))}>{provider === "XBOX" ? "Xbox" : "Steam"}</button>)}</div>}
                      <strong>Достижения: {selectedProgress.unlockedAchievements} из {selectedProgress.totalAchievements}</strong>
                      <div className="games-catalog-progress-bar" role="progressbar" aria-label={`Достижения ${selectedProvider === "XBOX" ? "Xbox" : "Steam"}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(100, selectedProgress.achievementPercent)))}><span style={{ width: `${Math.max(0, Math.min(100, selectedProgress.achievementPercent))}%` }} /></div>
                      {selectedProvider === "XBOX" && xboxCandidate && <span className="games-catalog-gamerscore">{xboxCandidate.progress.earnedGamerscore} из {xboxCandidate.progress.totalGamerscore} G</span>}
                    </div>}
                  </div>
                  <div className="games-catalog-personal">{entry ? <><span className={`games-catalog-status ${entry.status.toLowerCase()}`}>{statusLabels[entry.status]}</span><strong className="games-catalog-rating" data-rated={entry.rating != null}>{entry.rating != null ? `${entry.rating}/10` : "Без оценки"}</strong></> : <button type="button" className="games-catalog-add-library" aria-label={`Добавить в библиотеку «${game.title}»`} onClick={() => setEditing(game)}><Plus aria-hidden="true" />В библиотеку</button>}</div>
                </article>;
              })}
              </section>
              {visibleCount < visible.length && (
                <button
                  type="button" className="secondary-button games-catalog-load-more"
                  onClick={() =>
                    setVisibleCount((current) => current + GAME_PAGE_SIZE)
                  }
                >
                  Показать ещё {Math.min(GAME_PAGE_SIZE, visible.length - visibleCount)}
                </button>
              )}
            </>
          )}
        </div>
        <aside className="games-catalog-statistics"><p className="eyebrow">Общая статистика</p><h2>Игры <span>{initialized ? games.length : "—"}</span></h2>
          <button type="button" className="games-catalog-statistics-toggle" aria-expanded={statisticsExpanded} aria-controls="games-catalog-statistics" onClick={() => setStatisticsExpanded(value => !value)}>Общая статистика<ChevronDown aria-hidden="true" /></button>
          <div id="games-catalog-statistics" className="games-catalog-statistics-details" data-expanded={statisticsExpanded}><dl>{([
            ["Количество игр", games.length], ["В библиотеке", Object.keys(library).length], ["Не начато", Object.values(library).filter(item => item.status === "NOT_STARTED").length], ["В планах", Object.values(library).filter(item => item.status === "PLANNED").length], ["Пройдено", Object.values(library).filter(item => item.status === "COMPLETED").length], ["Играю", Object.values(library).filter(item => item.status === "IN_PROGRESS").length], ["На паузе", Object.values(library).filter(item => item.status === "PAUSED").length], ["Брошено", Object.values(library).filter(item => item.status === "DROPPED").length], ["Xbox", xboxGames], ["PC", pcGames], ["Game Pass", gamePassGames], ["Steam", steamGames], ["EA", eaGames], ["Epic Games", epicGames], ["Ubisoft Connect", ubisoftGames], ["Игровое время", `${Math.floor(sessionPlaytime / 60)} ч ${sessionPlaytime % 60} мин`], ["Достижения Steam", steamAchievements], ["Достижения Xbox", xboxAchievements], ["Gamerscore", `${totalGamerscore} G`],
          ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{initialized ? value : "—"}</dd></div>)}</dl></div>
          <button type="button" className="secondary-button icon-button games-catalog-quality" disabled={loading || Boolean(error)} onClick={() => setQualityCheckOpen(true)}><ListChecks aria-hidden="true" />Проверить библиотеку{qualityRows.length > 0 && <b>{qualityRows.length}</b>}</button>
        </aside>
      </section>
      {visibleGames.some((game) => game.rawgSlug) && (
        <a
          className="rawg-attribution rawg-catalog-attribution"
          href="https://rawg.io"
          target="_blank"
          rel="noreferrer"
        >
          Данные и изображения игр: <strong>RAWG</strong>
          <span aria-hidden="true">↗</span>
        </a>
      )}
      <section className="games-catalog-sessions">
        <div className="games-catalog-session-heading">
          <div>
            <p className="eyebrow">Игровая активность</p>
            <h2>Последние игровые сессии</h2>
          </div>
          <button
            ref={sessionAddRef} type="button" className="primary-button games-catalog-session-add"
            disabled={loading || Boolean(error) || syncingXbox || syncingSteamRecent || !Object.keys(library).length}
            onClick={() => setEditingSession("new")}
          >
            + Добавить сессию
          </button>
        </div>
        {!initialized ? loading ? <LoadingState message="Загружаем сессии…" compact /> : <p>Не удалось загрузить сессии.</p> : sessions.length === 0 ? (
          <p className="muted">Игровых сессий пока нет.</p>
        ) : (
          <div className="games-catalog-session-list">
            {sessions.slice(0, 5).map((session) => (
              <button
                key={session.id}
                type="button" data-session-id={session.id} disabled={loading || syncingXbox || syncingSteamRecent}
                onClick={() => setEditingSession(session)}
              >
                <span>
                  <strong>{session.title}</strong>
                  <small>
                    {new Date(session.startedAt).toLocaleString("ru-RU")}
                  </small>
                </span>
                <span className="games-catalog-session-achievements">
                  {session.unlockedAchievements > 0 && <span>Достижения: +{session.unlockedAchievements}</span>}
                  {session.earnedGamerscore > 0 && <span>+{session.earnedGamerscore} G</span>}
                </span>
                <b>
                  {Math.floor(session.durationMinutes / 60)} ч{" "}
                  {session.durationMinutes % 60} мин
                </b>
              </button>
            ))}
          </div>
        )}
      </section>
      {editing && (
        <GameForm
          game={editing === "new" ? undefined : editing}
          library={editing === "new" ? undefined : library[editing.id]}
          platforms={platforms}
          sources={sources}
          progress={
            editing !== "new" && library[editing.id]
              ? xboxBase[library[editing.id].id]
              : null
          }
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {steamImportOpen && (
        <SteamImportPreviewDialog
          onClose={() => setSteamImportOpen(false)}
          onImported={() => {
            setSteamImportOpen(false);
            void load();
          }}
        />
      )}
      {xboxImportOpen && (
        <XboxImportPreviewDialog
          onClose={() => setXboxImportOpen(false)}
          onImported={() => {
            setXboxImportOpen(false);
            void load();
          }}
        />
      )}
      {editingSession && (
        <GameSessionForm
          session={editingSession === "new" ? undefined : editingSession}
          library={libraryEntries}
          onClose={() => setEditingSession(null)}
          onSaved={() => {
            setEditingSession(null);
            void load();
          }}
        />
      )}
      {qualityCheckOpen && (
        <GameQualityDialog
          rows={qualityRows}
          totalGames={new Set(libraryEntries.map((entry) => entry.contentId)).size}
          onClose={() => setQualityCheckOpen(false)}
          onOpenGame={(gameId) => {
            setQualityCheckOpen(false);
            navigate(`/games/${gameId}`);
          }}
        />
      )}
    </div>
  );
}

function GameQualityDialog({
  rows,
  totalGames,
  onClose,
  onOpenGame,
}: {
  rows: GameQualityRow[];
  totalGames: number;
  onClose: () => void;
  onOpenGame: (gameId: number) => void;
}) {
  const [filter, setFilter] = useState<GameQualityIssueKind | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(GAME_PAGE_SIZE);
  const issueCount = (kind: GameQualityIssueKind) =>
    rows.filter((row) => row.issues.includes(kind)).length;
  const linkedIssues = rows.filter((row) =>
    row.issues.some((issue) => issue === "STEAM_LINK" || issue === "XBOX_LINK"),
  ).length;
  const progressIssues = rows.filter((row) =>
    row.issues.some(
      (issue) => issue === "STEAM_PROGRESS" || issue === "XBOX_PROGRESS",
    ),
  ).length;
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const filtered = rows.filter(
    (row) =>
      (filter === "ALL" || row.issues.includes(filter)) &&
      (!normalizedQuery ||
        row.game.title.toLocaleLowerCase("ru-RU").includes(normalizedQuery)),
  );
  const visibleRows = filtered.slice(0, visibleCount);
  const setQualityFilter = (value: GameQualityIssueKind | "ALL") => {
    setFilter(value);
    setVisibleCount(GAME_PAGE_SIZE);
  };

  return (
    <div className="modal-backdrop">
      <section className="game-quality-dialog">
        <div className="form-heading">
          <div>
            <p className="eyebrow">Контроль данных</p>
            <h2>Проверка игровой библиотеки</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <p className="game-quality-description">
          Проверено {totalGames} игр. Откройте игру из списка, чтобы дополнить
          данные или выполнить синхронизацию.
        </p>
        <div className="game-quality-summary">
          <div>
            <span>Требуют внимания</span>
            <strong>{rows.length}</strong>
          </div>
          <div>
            <span>Без RAWG</span>
            <strong>{issueCount("RAWG")}</strong>
          </div>
          <div>
            <span>Без обложки</span>
            <strong>{issueCount("COVER")}</strong>
          </div>
          <div>
            <span>Нет привязки</span>
            <strong>{linkedIssues}</strong>
          </div>
          <div>
            <span>Нет синхронизации</span>
            <strong>{progressIssues}</strong>
          </div>
        </div>
        <div className="game-quality-controls">
          <div className="steam-import-tabs">
            <button
              className={filter === "ALL" ? "active" : ""}
              onClick={() => setQualityFilter("ALL")}
            >
              Все · {rows.length}
            </button>
            {(
              [
                ["RAWG", "RAWG"],
                ["COVER", "Обложки"],
                ["STEAM_LINK", "Steam-связь"],
                ["XBOX_LINK", "Xbox-связь"],
                ["STEAM_PROGRESS", "Steam-достижения"],
                ["XBOX_PROGRESS", "Xbox-достижения"],
              ] as const
            ).map(([value, label]) => (
              <button
                className={filter === value ? "active" : ""}
                key={value}
                onClick={() => setQualityFilter(value)}
              >
                {label} · {issueCount(value)}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setVisibleCount(GAME_PAGE_SIZE);
            }}
            placeholder="Найти игру"
          />
        </div>
        {visibleRows.length > 0 ? (
          <div className="game-quality-list">
            {visibleRows.map(({ game, issues }) => (
              <button key={game.id} onClick={() => onOpenGame(game.id)}>
                <span
                  className="game-quality-cover"
                  style={
                    game.coverUrl
                      ? { backgroundImage: `url(${game.coverUrl})` }
                      : undefined
                  }
                >
                  {game.title.slice(0, 1)}
                </span>
                <span className="game-quality-info">
                  <strong>{game.title}</strong>
                  <small>{game.releaseYear ?? "Год не указан"}</small>
                  <span>
                    {issues.map((issue) => (
                      <em className={issue.toLowerCase()} key={issue}>
                        {gameQualityIssueLabels[issue]}
                      </em>
                    ))}
                  </span>
                </span>
                <b>Открыть →</b>
              </button>
            ))}
          </div>
        ) : (
          <div className="game-quality-empty">
            {rows.length === 0
              ? "Все игры заполнены и синхронизированы."
              : "По выбранному фильтру игр не найдено."}
          </div>
        )}
        {visibleCount < filtered.length && (
          <button
            className="secondary-button movie-load-more"
            onClick={() =>
              setVisibleCount((current) => current + GAME_PAGE_SIZE)
            }
          >
            Показать ещё 50
          </button>
        )}
      </section>
    </div>
  );
}

const steamMatchLabels: Record<SteamImportMatch, string> = {
  ALREADY_IMPORTED: "Уже в библиотеке",
  MATCHED: "Найдена карточка",
  REVIEW: "Нужно проверить",
  NEW: "Новая игра",
};

const xboxMatchLabels: Record<XboxImportMatch, string> = {
  ALREADY_IMPORTED: "Уже в библиотеке",
  MATCHED: "Найдена карточка",
  REVIEW: "Нужно проверить",
  NEW: "Новая игра",
};

const xboxPlatformLabels: Record<string, string> = {
  PC: "PC",
  ORIGINAL_XBOX: "Original Xbox",
  XBOX_360: "Xbox 360",
  XBOX_ONE: "Xbox One",
  XBOX_SERIES: "Xbox Series X|S",
};

const formatSteamPlaytime = (minutes: number) => {
  if (minutes <= 0) return "Не запускалась";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} ч ${remainder} мин` : `${remainder} мин`;
};

function SteamImportPreviewDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const { showToast } = useToast();
  const [preview, setPreview] = useState<SteamImportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SteamImportMatch | "">("");
  const [query, setQuery] = useState("");
  const [excludedAppIds, setExcludedAppIds] = useState<Set<number>>(new Set());
  const [resolutionByAppId, setResolutionByAppId] = useState<
    Record<number, NonNullable<SteamImportSelection["resolution"]>>
  >({});

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await previewSteamImport();
      setPreview(loaded);
      setExcludedAppIds(new Set());
      setResolutionByAppId(
        Object.fromEntries(
          loaded.games
            .filter((game) => game.match === "MATCHED")
            .map((game) => [game.appId, "SUGGESTED_MATCH" as const]),
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось загрузить библиотеку Steam",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const includedGames = useMemo(
    () =>
      preview?.games.filter((game) => !excludedAppIds.has(game.appId)) ?? [],
    [excludedAppIds, preview],
  );

  const includedSummary = useMemo(
    () => ({
      total: includedGames.length,
      totalPlaytimeMinutes: includedGames.reduce(
        (total, game) => total + game.playtimeMinutes,
        0,
      ),
      alreadyImported: includedGames.filter(
        (game) => game.match === "ALREADY_IMPORTED",
      ).length,
      matchedExisting: includedGames.filter((game) => game.match === "MATCHED")
        .length,
      reviewRequired: includedGames.filter((game) => game.match === "REVIEW")
        .length,
      newGames: includedGames.filter((game) => game.match === "NEW").length,
    }),
    [includedGames],
  );

  const selectedForImport = useMemo(
    () => includedGames.filter((game) => game.match !== "ALREADY_IMPORTED"),
    [includedGames],
  );
  const unresolvedReviews = selectedForImport.filter(
    (game) => game.match === "REVIEW" && resolutionByAppId[game.appId] == null,
  );

  const visibleGames = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return includedGames.filter(
      (game) =>
        (!filter || game.match === filter) &&
        (!normalized ||
          game.title.toLocaleLowerCase("ru-RU").includes(normalized) ||
          game.matchedContentTitle
            ?.toLocaleLowerCase("ru-RU")
            .includes(normalized)),
    );
  }, [filter, includedGames, query]);

  const excludeGame = (appId: number) => {
    setExcludedAppIds((current) => {
      const next = new Set(current);
      next.add(appId);
      return next;
    });
  };

  const runImport = async () => {
    if (selectedForImport.length === 0 || unresolvedReviews.length > 0) return;
    const confirmed = window.confirm(
      `Импортировать ${selectedForImport.length} игр? Перед записью backend автоматически создаст резервную копию. Данные и горизонтальные обложки загрузятся из RAWG, вертикальные — из SteamGridDB.`,
    );
    if (!confirmed) return;
    setImporting(true);
    setCreatingBackup(true);
    setImportError(null);
    setImportProgress({ completed: 0, total: selectedForImport.length });
    let processed = 0;
    try {
      const selections: SteamImportSelection[] = selectedForImport.map((game) => ({
        appId: game.appId,
        ...(game.match === "MATCHED" || game.match === "REVIEW"
          ? { resolution: resolutionByAppId[game.appId] }
          : {}),
      }));
      const appIds = selections.map((game) => game.appId);
      const preparation = await prepareSteamImport(appIds);
      setCreatingBackup(false);
      const total = {
        imported: 0,
        catalogCreated: 0,
        rawgEnriched: 0,
        steamGridDbCovers: 0,
      };
      const batchSize = 5;
      for (let offset = 0; offset < selections.length; offset += batchSize) {
        const batch = selections.slice(offset, offset + batchSize);
        const result = await importSteamGames(preparation.backupToken, batch);
        total.imported += result.imported;
        total.catalogCreated += result.catalogCreated;
        total.rawgEnriched += result.rawgEnriched;
        total.steamGridDbCovers += result.steamGridDbCovers;
        processed = Math.min(offset + batch.length, selections.length);
        setImportProgress({
          completed: processed,
          total: selections.length,
        });
      }
      showToast(
        `Импортировано: ${total.imported}. RAWG: ${total.rawgEnriched}, SteamGridDB: ${total.steamGridDbCovers}. Бэкап создан.`,
      );
      onImported();
    } catch (reason) {
      setImportError(
        reason instanceof Error
          ? `${reason.message}${processed ? ` Обработано: ${processed} из ${selectedForImport.length}.` : ""}`
          : "Не удалось импортировать библиотеку Steam",
      );
    } finally {
      setCreatingBackup(false);
      setImporting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <section className="steam-import-dialog">
        <div className="form-heading">
          <div>
            <p className="eyebrow">Steam Web API</p>
            <h2>Предпросмотр библиотеки</h2>
          </div>
          <button type="button" onClick={onClose} disabled={importing}>
            ×
          </button>
        </div>

        {loading && !preview && (
          <div className="steam-import-loading">
            <span />
            Загружаем библиотеку Steam…
          </div>
        )}
        {error && (
          <div className="notice error steam-import-error">
            <strong>Не удалось получить библиотеку</strong>
            <span>{error}</span>
            <button className="secondary-button" onClick={() => void loadPreview()}>
              Повторить
            </button>
          </div>
        )}

        {preview && (
          <>
            <p className="steam-import-profile">
              Профиль <strong>{preview.profileName}</strong> · {includedSummary.total} из{" "}
              {preview.totalGames} игр ·{" "}
              {Math.round(includedSummary.totalPlaytimeMinutes / 60).toLocaleString("ru-RU")} ч
            </p>
            <div className="steam-import-summary">
              <div>
                <span>Всего</span>
                <strong>{includedSummary.total}</strong>
              </div>
              <div>
                <span>Уже добавлены</span>
                <strong>{includedSummary.alreadyImported}</strong>
              </div>
              <div>
                <span>Совпадения</span>
                <strong>{includedSummary.matchedExisting}</strong>
              </div>
              <div>
                <span>Проверить</span>
                <strong>{includedSummary.reviewRequired}</strong>
              </div>
              <div>
                <span>Новые</span>
                <strong>{includedSummary.newGames}</strong>
              </div>
            </div>
            <div className="steam-import-controls">
              <div className="steam-import-tabs">
                {(
                  [
                    ["", "Все"],
                    ["ALREADY_IMPORTED", "Добавлены"],
                    ["MATCHED", "Совпадения"],
                    ["REVIEW", "Проверить"],
                    ["NEW", "Новые"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    className={filter === value ? "active" : ""}
                    key={value || "all"}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти в предпросмотре"
              />
            </div>
            <div className="steam-import-list">
              {visibleGames.map((game) => (
                <article key={game.appId}>
                  <div className="steam-import-game-icon">
                    <span>{game.title.slice(0, 1)}</span>
                    {game.iconUrl && (
                      <img
                        src={game.iconUrl}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <div className="steam-import-game-info">
                    <a
                      href={`https://store.steampowered.com/app/${game.appId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {game.title}
                    </a>
                    <small>
                      App ID {game.appId} · {formatSteamPlaytime(game.playtimeMinutes)}
                      {game.lastPlayedAt
                        ? ` · запускалась ${new Intl.DateTimeFormat("ru-RU").format(new Date(game.lastPlayedAt))}`
                        : ""}
                    </small>
                    {game.matchedContentTitle && (
                      <em>В каталоге: {game.matchedContentTitle}</em>
                    )}
                  </div>
                  <div className="steam-import-game-actions">
                    {(game.match === "MATCHED" || game.match === "REVIEW") && (
                      <select
                        className="steam-import-resolution"
                        value={resolutionByAppId[game.appId] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value as
                            | NonNullable<SteamImportSelection["resolution"]>
                            | "";
                          setResolutionByAppId((current) => {
                            const next = { ...current };
                            if (value) next[game.appId] = value;
                            else delete next[game.appId];
                            return next;
                          });
                        }}
                        disabled={importing}
                        aria-label={`Способ добавления ${game.title}`}
                      >
                        <option value="">Выберите действие</option>
                        <option value="SUGGESTED_MATCH">
                          Связать: {game.matchedContentTitle}
                        </option>
                        <option value="NEW_GAME">Создать отдельную игру</option>
                      </select>
                    )}
                    <span className={`steam-import-match ${game.match.toLowerCase()}`}>
                      {steamMatchLabels[game.match]}
                    </span>
                    <button
                      type="button"
                      className="steam-import-exclude"
                      aria-label={`Исключить ${game.title} из импорта`}
                      title="Исключить из импорта"
                      onClick={() => excludeGame(game.appId)}
                      disabled={importing}
                    >
                      <X />
                    </button>
                  </div>
                </article>
              ))}
              {visibleGames.length === 0 && (
                <p className="muted steam-import-empty">Ничего не найдено.</p>
              )}
            </div>
            <div className="steam-import-footer">
              <div>
                <p>
                  Перед первой записью создаётся один автоматический бэкап. Steam передаёт библиотеку и время, RAWG — данные и горизонтальную обложку, SteamGridDB — вертикальную.
                </p>
                {unresolvedReviews.length > 0 && (
                  <p className="xbox-import-review-warning">
                    Выберите действие для игр со статусом «Нужно проверить»: {unresolvedReviews.length}.
                  </p>
                )}
                {excludedAppIds.size > 0 && (
                  <button
                    type="button"
                    className="steam-import-restore"
                    onClick={() => setExcludedAppIds(new Set())}
                    disabled={importing}
                  >
                    Вернуть исключённые ({excludedAppIds.size})
                  </button>
                )}
                {importError && <p className="steam-import-save-error">{importError}</p>}
              </div>
              <div className="steam-import-footer-actions">
                <button
                  className="secondary-button"
                  onClick={onClose}
                  disabled={importing}
                >
                  Закрыть
                </button>
                <button
                  className="primary-button"
                  onClick={() => void runImport()}
                  disabled={
                    importing ||
                    selectedForImport.length === 0 ||
                    unresolvedReviews.length > 0
                  }
                >
                  {importing
                    ? creatingBackup
                      ? "Создаём бэкап…"
                      : `Импортируем ${importProgress?.completed ?? 0}/${importProgress?.total ?? selectedForImport.length}`
                    : unresolvedReviews.length > 0
                      ? `Решить совпадения (${unresolvedReviews.length})`
                      : `Импортировать (${selectedForImport.length})`}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function XboxImportPreviewDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const { showToast } = useToast();
  const [preview, setPreview] = useState<XboxImportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [filter, setFilter] = useState<XboxImportMatch | "">("");
  const [query, setQuery] = useState("");
  const [excludedTitleIds, setExcludedTitleIds] = useState<Set<number>>(
    new Set(),
  );
  const [sourceByTitleId, setSourceByTitleId] = useState<
    Record<number, XboxImportSelection["sourceCode"]>
  >({});
  const [resolutionByTitleId, setResolutionByTitleId] = useState<
    Record<number, NonNullable<XboxImportSelection["resolution"]>>
  >({});

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await previewXboxImport();
      setPreview(loaded);
      setExcludedTitleIds(new Set());
      setResolutionByTitleId({});
      setSourceByTitleId(
        Object.fromEntries(
          loaded.games.map((game) => [game.titleId, game.suggestedSourceCode]),
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось загрузить историю Xbox",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const includedGames = useMemo(
    () =>
      preview?.games.filter((game) => !excludedTitleIds.has(game.titleId)) ?? [],
    [excludedTitleIds, preview],
  );
  const selectedForImport = useMemo(
    () => includedGames.filter((game) => game.match !== "ALREADY_IMPORTED"),
    [includedGames],
  );
  const unresolvedReviews = selectedForImport.filter(
    (game) =>
      game.match === "REVIEW" && resolutionByTitleId[game.titleId] == null,
  );
  const includedSummary = useMemo(
    () => ({
      total: includedGames.length,
      alreadyImported: includedGames.filter(
        (game) => game.match === "ALREADY_IMPORTED",
      ).length,
      matchedExisting: includedGames.filter((game) => game.match === "MATCHED")
        .length,
      reviewRequired: includedGames.filter((game) => game.match === "REVIEW")
        .length,
      newGames: includedGames.filter((game) => game.match === "NEW").length,
    }),
    [includedGames],
  );
  const visibleGames = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return includedGames.filter(
      (game) =>
        (!filter || game.match === filter) &&
        (!normalized ||
          game.title.toLocaleLowerCase("ru-RU").includes(normalized) ||
          game.matchedContentTitle
            ?.toLocaleLowerCase("ru-RU")
            .includes(normalized)),
    );
  }, [filter, includedGames, query]);

  const excludeGame = (titleId: number) => {
    setExcludedTitleIds((current) => {
      const next = new Set(current);
      next.add(titleId);
      return next;
    });
  };

  const setAllSources = (sourceCode: XboxImportSelection["sourceCode"]) => {
    setSourceByTitleId((current) => ({
      ...current,
      ...Object.fromEntries(
        selectedForImport.map((game) => [game.titleId, sourceCode]),
      ),
    }));
  };

  const setAllStoreSources = () => {
    setSourceByTitleId((current) => ({
      ...current,
      ...Object.fromEntries(
        selectedForImport.map((game) => [
          game.titleId,
          game.platformCode === "PC" ? "MICROSOFT_STORE" : "XBOX_STORE",
        ]),
      ),
    }));
  };

  const runImport = async () => {
    if (selectedForImport.length === 0 || unresolvedReviews.length > 0) return;
    const confirmed = window.confirm(
      `Импортировать ${selectedForImport.length} игр из истории Xbox? Перед записью backend автоматически создаст резервную копию. Проверьте источник Microsoft/Xbox Store или Game Pass у выбранных игр.`,
    );
    if (!confirmed) return;
    setImporting(true);
    setCreatingBackup(true);
    setImportError(null);
    setImportProgress({ completed: 0, total: selectedForImport.length });
    let processed = 0;
    try {
      const selections: XboxImportSelection[] = selectedForImport.map((game) => ({
        titleId: game.titleId,
        sourceCode: sourceByTitleId[game.titleId] ?? game.suggestedSourceCode,
        ...(game.match === "REVIEW"
          ? { resolution: resolutionByTitleId[game.titleId] }
          : {}),
      }));
      const preparation = await prepareXboxImport(
        selections.map((game) => game.titleId),
      );
      setCreatingBackup(false);
      const total = {
        imported: 0,
        catalogCreated: 0,
        rawgEnriched: 0,
        steamGridDbCovers: 0,
      };
      const batchSize = 5;
      for (let offset = 0; offset < selections.length; offset += batchSize) {
        const batch = selections.slice(offset, offset + batchSize);
        const result = await importXboxGames(preparation.backupToken, batch);
        total.imported += result.imported;
        total.catalogCreated += result.catalogCreated;
        total.rawgEnriched += result.rawgEnriched;
        total.steamGridDbCovers += result.steamGridDbCovers;
        processed = Math.min(offset + batch.length, selections.length);
        setImportProgress({ completed: processed, total: selections.length });
      }
      showToast(
        `Импортировано: ${total.imported}. RAWG: ${total.rawgEnriched}, SteamGridDB: ${total.steamGridDbCovers}. Бэкап создан.`,
      );
      onImported();
    } catch (reason) {
      setImportError(
        reason instanceof Error
          ? `${reason.message}${processed ? ` Обработано: ${processed} из ${selectedForImport.length}.` : ""}`
          : "Не удалось импортировать историю Xbox",
      );
    } finally {
      setCreatingBackup(false);
      setImporting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <section className="steam-import-dialog xbox-import-dialog">
        <div className="form-heading">
          <div>
            <p className="eyebrow">OpenXBL</p>
            <h2>Предпросмотр истории Xbox</h2>
          </div>
          <button type="button" onClick={onClose} disabled={importing}>
            ×
          </button>
        </div>

        {loading && !preview && (
          <div className="steam-import-loading">
            <span />
            Загружаем историю Xbox…
          </div>
        )}
        {error && (
          <div className="notice error steam-import-error">
            <strong>Не удалось получить историю Xbox</strong>
            <span>{error}</span>
            <button className="secondary-button" onClick={() => void loadPreview()}>
              Повторить
            </button>
          </div>
        )}

        {preview && (
          <>
            <p className="steam-import-profile">
              История профиля · {includedSummary.total} из {preview.totalGames} игр Xbox-профиля
            </p>
            <div className="steam-import-summary">
              <div>
                <span>Всего</span>
                <strong>{includedSummary.total}</strong>
              </div>
              <div>
                <span>Уже добавлены</span>
                <strong>{includedSummary.alreadyImported}</strong>
              </div>
              <div>
                <span>Совпадения</span>
                <strong>{includedSummary.matchedExisting}</strong>
              </div>
              <div>
                <span>Проверить</span>
                <strong>{includedSummary.reviewRequired}</strong>
              </div>
              <div>
                <span>Новые</span>
                <strong>{includedSummary.newGames}</strong>
              </div>
            </div>
            <div className="xbox-import-source-defaults">
              <span>Источник для добавляемых:</span>
              <button type="button" onClick={setAllStoreSources}>
                Все — магазин
              </button>
              <button type="button" onClick={() => setAllSources("GAME_PASS")}>
                Все — Game Pass
              </button>
            </div>
            <div className="steam-import-controls">
              <div className="steam-import-tabs">
                {(
                  [
                    ["", "Все"],
                    ["ALREADY_IMPORTED", "Добавлены"],
                    ["MATCHED", "Совпадения"],
                    ["REVIEW", "Проверить"],
                    ["NEW", "Новые"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    className={filter === value ? "active" : ""}
                    key={value || "all"}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти в предпросмотре"
              />
            </div>
            <div className="steam-import-list xbox-import-list">
              {visibleGames.map((game) => (
                <article key={game.titleId}>
                  <div className="steam-import-game-icon">
                    <span>{game.title.slice(0, 1)}</span>
                    {game.imageUrl && (
                      <img
                        src={game.imageUrl}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                  <div className="steam-import-game-info">
                    <strong className="xbox-import-title">{game.title}</strong>
                    <small>
                      {xboxPlatformLabels[game.platformCode] ?? game.platformCode} · Title ID{" "}
                      {game.titleId} ·{" "}
                      {game.totalAchievements > 0
                        ? `${game.unlockedAchievements}/${game.totalAchievements} достижений`
                        : `получено достижений: ${game.unlockedAchievements}`}
                      {game.totalGamerscore > 0
                        ? ` · ${game.earnedGamerscore}/${game.totalGamerscore} G`
                        : ""}
                      {game.lastPlayedAt
                        ? ` · запускалась ${new Intl.DateTimeFormat("ru-RU").format(new Date(game.lastPlayedAt))}`
                        : ""}
                    </small>
                    {game.sharedAchievementSet && (
                      <em>Общий набор достижений PC и Xbox</em>
                    )}
                    {game.matchedContentTitle && (
                      <em>В каталоге: {game.matchedContentTitle}</em>
                    )}
                  </div>
                  <div className="steam-import-game-actions xbox-import-game-actions">
                    {game.match === "REVIEW" && (
                      <select
                        className="xbox-import-resolution"
                        value={resolutionByTitleId[game.titleId] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value as
                            | NonNullable<XboxImportSelection["resolution"]>
                            | "";
                          setResolutionByTitleId((current) => {
                            const next = { ...current };
                            if (value) next[game.titleId] = value;
                            else delete next[game.titleId];
                            return next;
                          });
                        }}
                        disabled={importing}
                        aria-label={`Способ добавления ${game.title}`}
                      >
                        <option value="">Выберите действие</option>
                        <option value="SUGGESTED_MATCH">
                          Связать: {game.matchedContentTitle}
                        </option>
                        <option value="NEW_GAME">Создать отдельную игру</option>
                      </select>
                    )}
                    {game.match !== "ALREADY_IMPORTED" && (
                      <select
                        value={
                          sourceByTitleId[game.titleId] ?? game.suggestedSourceCode
                        }
                        onChange={(event) =>
                          setSourceByTitleId((current) => ({
                            ...current,
                            [game.titleId]: event.target.value as XboxImportSelection["sourceCode"],
                          }))
                        }
                        disabled={importing}
                        aria-label={`Источник ${game.title}`}
                      >
                        {game.platformCode === "PC" ? (
                          <option value="MICROSOFT_STORE">Microsoft Store</option>
                        ) : (
                          <option value="XBOX_STORE">Xbox Store</option>
                        )}
                        <option value="GAME_PASS">Game Pass</option>
                      </select>
                    )}
                    <span className={`steam-import-match ${game.match.toLowerCase()}`}>
                      {xboxMatchLabels[game.match]}
                    </span>
                    <button
                      type="button"
                      className="steam-import-exclude"
                      aria-label={`Исключить ${game.title} из импорта`}
                      title="Исключить из импорта"
                      onClick={() => excludeGame(game.titleId)}
                      disabled={importing}
                    >
                      <X />
                    </button>
                  </div>
                </article>
              ))}
              {visibleGames.length === 0 && (
                <p className="muted steam-import-empty">Ничего не найдено.</p>
              )}
            </div>
            <div className="steam-import-footer">
              <div>
                <p>
                  Импортируется история запуска, а не полный список покупок. Перед первой записью создаётся бэкап. RAWG добавляет данные и горизонтальную обложку, SteamGridDB — вертикальную.
                </p>
                {unresolvedReviews.length > 0 && (
                  <p className="xbox-import-review-warning">
                    Выберите действие для игр со статусом «Нужно проверить»: {unresolvedReviews.length}.
                  </p>
                )}
                {excludedTitleIds.size > 0 && (
                  <button
                    type="button"
                    className="steam-import-restore"
                    onClick={() => setExcludedTitleIds(new Set())}
                    disabled={importing}
                  >
                    Вернуть исключённые ({excludedTitleIds.size})
                  </button>
                )}
                {importError && <p className="steam-import-save-error">{importError}</p>}
              </div>
              <div className="steam-import-footer-actions">
                <button
                  className="secondary-button"
                  onClick={onClose}
                  disabled={importing}
                >
                  Закрыть
                </button>
                <button
                  className="primary-button"
                  onClick={() => void runImport()}
                  disabled={
                    importing ||
                    selectedForImport.length === 0 ||
                    unresolvedReviews.length > 0
                  }
                >
                  {importing
                    ? creatingBackup
                      ? "Создаём бэкап…"
                      : `Импортируем ${importProgress?.completed ?? 0}/${importProgress?.total ?? selectedForImport.length}`
                    : unresolvedReviews.length > 0
                      ? `Решить совпадения (${unresolvedReviews.length})`
                      : `Импортировать (${selectedForImport.length})`}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function GameForm({
  game,
  library,
  platforms,
  sources,
  progress,
  onClose,
  onSaved,
  onDeleted,
}: {
  game?: Game;
  library?: GameLibrary;
  platforms: Reference[];
  sources: Reference[];
  progress?: XboxProgressInput | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const { showToast } = useToast();
  const [item, setItem] = useState<GameInput>(game ? { ...game } : emptyGame);
  const defaultPlatform = library?.platform.id ?? platforms[0]?.id ?? 0;
  const defaultSource = library?.source.id ?? sources[0]?.id ?? 0;
  const [entry, setEntry] = useState<GameLibraryInput>({
    platformId: defaultPlatform,
    sourceId: defaultSource,
    accessType:
      library?.accessType ??
      (sources.find((source) => source.id === defaultSource)?.type ===
      "SUBSCRIPTION"
        ? "SUBSCRIPTION"
        : "OWNED"),
    edition: library?.edition ?? null,
    acquiredAt: library?.acquiredAt ?? null,
    note: library?.note ?? null,
    legacyPlaytimeMinutes: library?.legacyPlaytimeMinutes ?? 0,
    status: library?.status ?? "NOT_STARTED",
    startedAt: library?.startedAt ?? null,
    completedAt: library?.completedAt ?? null,
  });
  const [profile, setProfile] = useState<LibraryInput>({
    status: library?.status ?? "NOT_STARTED",
    rating: library?.rating ?? null,
    favorite: library?.favorite ?? false,
    startedAt: library?.startedAt ?? null,
    completedAt: library?.completedAt ?? null,
    personalNote: library?.personalNote ?? null,
  });
  const [xboxProgress, setXboxProgress] = useState<XboxProgressInput>(
    progress ?? emptyProgress,
  );
  const [inLibrary, setInLibrary] = useState(Boolean(library) || !game);
  const mutations = useFormMutation();
  const { saving, deleting, pending } = mutations;
  const [error, setError] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [candidates, setCandidates] = useState<RawgGameCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [selectedRawgId, setSelectedRawgId] = useState<number | null>(
    game?.rawgId ?? null,
  );
  const [artworkQuery, setArtworkQuery] = useState(
    game?.originalTitle ?? game?.title ?? "",
  );
  const [artworkGames, setArtworkGames] = useState<
    SteamGridDbGameCandidate[]
  >([]);
  const [artworkCovers, setArtworkCovers] = useState<
    SteamGridDbCoverCandidate[]
  >([]);
  const [artworkSearching, setArtworkSearching] = useState(false);
  const catalogRequests = useLatestRequest();
  const artworkRequests = useLatestRequest();
  const cancelCatalog = () => { catalogRequests.invalidate(); setSearching(false); setCandidates([]); setSearchCompleted(false); };
  const cancelArtwork = () => { artworkRequests.invalidate(); setArtworkSearching(false); setArtworkGames([]); setArtworkCovers([]); };
  const changeCatalogQuery = (value: string) => { cancelCatalog(); setCatalogQuery(value); };
  const changeArtworkQuery = (value: string) => { cancelArtwork(); setArtworkQuery(value); };
  const closeForm = () => { mutations.dispose(); catalogRequests.dispose(); artworkRequests.dispose(); onClose(); };
  useEffect(() => {
    setXboxProgress(progress ?? emptyProgress);
  }, [progress]);
  const setItemValue = <K extends keyof GameInput>(
    key: K,
    value: GameInput[K],
  ) => {
    if (key !== "coverUrl" && key !== "xboxPlayAnywhere" && key !== "steamGridDbGameId" && key !== "steamGridDbGridId") cancelCatalog();
    if (key === "coverUrl") { artworkRequests.invalidate(); setArtworkSearching(false); }
    setItem((current) => ({ ...current, [key]: value }));
  };
  const setEntryValue = <K extends keyof GameLibraryInput>(
    key: K,
    value: GameLibraryInput[K],
  ) => setEntry((current) => ({ ...current, [key]: value }));
  const setProfileValue = <K extends keyof LibraryInput>(
    key: K,
    value: LibraryInput[K],
  ) => setProfile((current) => ({ ...current, [key]: value }));
  const selectedPlatform = platforms.find(
    (value) => value.id === entry.platformId,
  );
  const selectedSource = sources.find((value) => value.id === entry.sourceId);
  const xboxEnabled = Boolean(
    selectedPlatform &&
      selectedSource &&
      (isXbox(selectedPlatform.code) ||
        (selectedPlatform.code === "PC" &&
          ["MICROSOFT_STORE", "GAME_PASS"].includes(
            selectedSource.code,
          ))),
  );
  const compatibleSources = sources.filter((value) =>
    entry.accessType === "SUBSCRIPTION"
      ? value.type === "SUBSCRIPTION"
      : value.type !== "SUBSCRIPTION",
  );
  const changeAccessType = (accessType: GameLibraryInput["accessType"]) => {
    const source = sources.find((value) =>
      accessType === "SUBSCRIPTION"
        ? value.type === "SUBSCRIPTION"
        : value.type !== "SUBSCRIPTION",
    );
    setEntry((current) => ({
      ...current,
      accessType,
      sourceId: source?.id ?? current.sourceId,
    }));
  };
  const searchRawg = async () => {
    const value = catalogQuery.trim();
    if (value.length < 2) return;
    await catalogRequests.run(() => searchRawgGames(value), {
      onStart: () => { setSearching(true); setSearchCompleted(false); setError(null); setCandidates([]); },
      onSuccess: (results) => { setCandidates(results); setSearchCompleted(true); },
      onError: (reason) => setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось выполнить поиск в RAWG",
      ),
      onFinish: () => setSearching(false),
    });
  };
  const selectRawgCandidate = async (candidate: RawgGameCandidate) => {
    if (
      candidate.existingContentId &&
      candidate.existingContentId !== game?.id
    )
      return;
    await catalogRequests.run(() => previewRawgGame(candidate.rawgId), {
      onStart: () => { setSearching(true); setError(null); cancelArtwork(); },
      onSuccess: (details) => {
        if (details.existingContentId && details.existingContentId !== game?.id) {
          setError("Эта игра RAWG уже связана с другой записью каталога");
          return;
        }
        setItem((current) => ({
          ...current,
          title: details.title,
          originalTitle: details.originalTitle,
          releaseYear: details.releaseYear,
          description: details.description,
          backgroundUrl: details.backgroundUrl,
          releaseStatus: details.releaseStatus,
          genre: details.genre,
          developer: details.developer,
          releaseDate: details.releaseDate,
        }));
        changeArtworkQuery(details.originalTitle ?? details.title);
        setSelectedRawgId(details.rawgId);
        setCandidates([]);
      },
      onError: (reason) => setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось загрузить карточку RAWG",
      ),
      onFinish: () => setSearching(false),
    });
  };
  const searchArtwork = async () => {
    const value = artworkQuery.trim();
    if (value.length < 2) return;
    await artworkRequests.run(() => searchSteamGridDbGames(value), {
      onStart: () => { setArtworkSearching(true); setError(null); setArtworkCovers([]); setArtworkGames([]); },
      onSuccess: setArtworkGames,
      onError: (reason) => setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось выполнить поиск в SteamGridDB",
      ),
      onFinish: () => setArtworkSearching(false),
    });
  };
  const selectArtworkGame = async (candidate: SteamGridDbGameCandidate) => {
    await artworkRequests.run(() => getSteamGridDbCovers(candidate.steamGridDbId), {
      onStart: () => { setArtworkSearching(true); setError(null); setArtworkCovers([]); },
      onSuccess: (covers) => {
        setArtworkCovers(covers);
        setArtworkGames([]);
        if (covers.length === 0)
          setError("Для этой игры нет вертикальных обложек 600×900");
      },
      onError: (reason) => setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось загрузить обложки SteamGridDB",
      ),
      onFinish: () => setArtworkSearching(false),
    });
  };
  const selectArtworkCover = (cover: SteamGridDbCoverCandidate) => {
    artworkRequests.invalidate();
    setArtworkSearching(false);
    setItem((current) => ({
      ...current,
      coverUrl: cover.imageUrl,
      steamGridDbGameId: cover.steamGridDbGameId,
      steamGridDbGridId: cover.gridId,
    }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || searching || artworkSearching) return;
    setError(null);
    await mutations.run('save', async () => {
      const savedGame = game
        ? selectedRawgId && selectedRawgId !== game.rawgId
          ? await updateRawgGame(game.id, selectedRawgId, item)
          : await updateGame(game.id, item)
        : selectedRawgId
          ? await createRawgGame(selectedRawgId, item)
          : await createGame(item);
      if (inLibrary) {
        const copyProgress = {
          ...entry,
          status: profile.status,
          startedAt: profile.startedAt,
          completedAt: profile.completedAt,
        };
        const savedEntry = library
          ? await updateGameLibrary(library.id, copyProgress)
          : await createGameLibrary(savedGame.id, copyProgress);
        await putGameProfile(savedGame.id, profile);
        if (xboxEnabled) await putXboxProgress(savedEntry.id, xboxProgress);
      }
    }, {
      onSuccess: () => {
        showToast(game ? "Игра обновлена" : "Игра добавлена");
        onSaved();
      },
      onError: (reason) => setError(
        reason instanceof Error ? reason.message : "Не удалось сохранить игру",
      ),
    });
  };
  const remove = async () => {
    if (!game || pending || searching || artworkSearching) return;
    setError(null);
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить «${game.title}» из общего каталога?`)) return false;
      await deleteGame(game.id);
      return true;
    }, {
      onSuccess: (deleted) => {
        if (!deleted) return;
        showToast("Игра удалена");
        (onDeleted ?? onSaved)();
      },
      onError: (reason) => setError(
        reason instanceof Error ? reason.message : "Не удалось удалить игру",
      ),
    });
  };
  return (
    <div className="modal-backdrop">
      <form
        className="habit-form game-form"
        onSubmit={(event) => void submit(event)}
      >
        <div className="form-heading">
          <div>
            <p className="eyebrow">Игры</p>
            <h2>{game ? "Редактирование" : "Новая игра"}</h2>
          </div>
          <button type="button" onClick={closeForm}>
            ×
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <section className="kinopoisk-movie-search rawg-game-search">
          <div>
            <input
              value={catalogQuery}
              onChange={(event) => changeCatalogQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchRawg();
                }
              }}
              placeholder="Введите название игры"
            />
            <button
              className="secondary-button"
              type="button"
              disabled={searching || catalogQuery.trim().length < 2}
              onClick={() => void searchRawg()}
            >
              {searching ? "Ищем…" : "Найти в RAWG"}
            </button>
          </div>
          {selectedRawgId && (
            <p>Игра связана с RAWG. Проверьте заполненные данные перед сохранением.</p>
          )}
          {candidates.length > 0 && (
            <div className="kinopoisk-movie-results rawg-game-results">
              {candidates.map((candidate) => {
                const belongsToAnotherGame = Boolean(
                  candidate.existingContentId &&
                    candidate.existingContentId !== game?.id,
                );
                return (
                  <button
                    type="button"
                    key={candidate.rawgId}
                    disabled={belongsToAnotherGame}
                    onClick={() => void selectRawgCandidate(candidate)}
                  >
                    {candidate.backgroundUrl ? (
                      <img src={candidate.backgroundUrl} alt="" />
                    ) : (
                      <span>🎮</span>
                    )}
                    <span>
                      <strong>{candidate.title}</strong>
                      <small>
                        {candidate.releaseDate
                          ? candidate.releaseDate.slice(0, 4)
                          : "Год не указан"}
                        {candidate.platforms.length
                          ? ` · ${candidate.platforms.join(", ")}`
                          : ""}
                        {belongsToAnotherGame ? " · Уже в каталоге" : ""}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {searchCompleted && candidates.length === 0 && !selectedRawgId && (
            <p className="form-hint">
              Игра не найдена в RAWG. Можно заполнить данные вручную.
            </p>
          )}
          {(candidates.length > 0 || selectedRawgId) && (
            <a
              className="rawg-attribution rawg-search-attribution"
              href="https://rawg.io"
              target="_blank"
              rel="noreferrer"
            >
              Данные и изображения: <strong>RAWG</strong>
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </section>
        <section className="kinopoisk-movie-search steamgriddb-cover-search">
          <p className="steamgriddb-search-title">
            Вертикальная обложка SteamGridDB
          </p>
          <div>
            <input
              value={artworkQuery}
              onChange={(event) => changeArtworkQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void searchArtwork();
                }
              }}
              placeholder="Название игры для поиска обложки"
            />
            <button
              className="secondary-button"
              type="button"
              disabled={artworkSearching || artworkQuery.trim().length < 2}
              onClick={() => void searchArtwork()}
            >
              {artworkSearching ? "Ищем…" : "Найти обложку"}
            </button>
          </div>
          {artworkGames.length > 0 && (
            <div className="kinopoisk-movie-results steamgriddb-game-results">
              {artworkGames.map((candidate) => (
                <button
                  type="button"
                  key={candidate.steamGridDbId}
                  onClick={() => void selectArtworkGame(candidate)}
                >
                  <span aria-hidden="true">▥</span>
                  <span>
                    <strong>{candidate.name}</strong>
                    <small>
                      {candidate.verified ? "Проверенная запись" : "Запись сообщества"}
                      {candidate.types.length
                        ? ` · ${candidate.types.join(", ")}`
                        : ""}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
          {artworkCovers.length > 0 && (
            <div className="steamgriddb-cover-results">
              {artworkCovers.map((cover) => (
                <button
                  type="button"
                  className={
                    item.steamGridDbGridId === cover.gridId ? "selected" : ""
                  }
                  key={cover.gridId}
                  title={cover.authorName ? `Автор: ${cover.authorName}` : ""}
                  onClick={() => selectArtworkCover(cover)}
                >
                  <img
                    src={cover.thumbnailUrl ?? cover.imageUrl}
                    alt={`Обложка ${item.title || artworkQuery}`}
                  />
                  {item.steamGridDbGridId === cover.gridId && <span>Выбрано</span>}
                </button>
              ))}
            </div>
          )}
          {(artworkCovers.length > 0 || item.steamGridDbGridId) && (
            <a
              className="rawg-attribution rawg-search-attribution"
              href={
                item.steamGridDbGridId
                  ? `https://www.steamgriddb.com/grid/${item.steamGridDbGridId}`
                  : "https://www.steamgriddb.com"
              }
              target="_blank"
              rel="noreferrer"
            >
              Обложки: <strong>SteamGridDB</strong>
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </section>
        <label>
          Название
          <input
            required
            value={item.title}
            onChange={(event) => setItemValue("title", event.target.value)}
          />
        </label>
        <label>
          Оригинальное название
          <input
            value={item.originalTitle ?? ""}
            onChange={(event) =>
              setItemValue("originalTitle", event.target.value || null)
            }
          />
        </label>
        <label>
          Разработчик
          <input
            maxLength={200}
            value={item.developer ?? ""}
            onChange={(event) =>
              setItemValue("developer", event.target.value || null)
            }
          />
        </label>
        <div className="form-grid">
          <label>
            Дата выхода
            <input
              type="date"
              value={item.releaseDate ?? ""}
              onChange={(event) =>
                setItem((current) => ({
                  ...current,
                  releaseDate: event.target.value || null,
                  releaseYear: event.target.value
                    ? Number(event.target.value.slice(0, 4))
                    : null,
                }))
              }
            />
          </label>
          <label>
            Жанр
            <input
              maxLength={100}
              value={item.genre ?? ""}
              onChange={(event) =>
                setItemValue("genre", event.target.value || null)
              }
            />
          </label>
        </div>
        <label>
          URL вертикальной обложки
          <input
            type="url"
            value={item.coverUrl ?? ""}
            onChange={(event) =>
              setItemValue("coverUrl", event.target.value || null)
            }
          />
        </label>
        <label>
          URL горизонтального фона
          <input
            type="url"
            value={item.backgroundUrl ?? ""}
            onChange={(event) =>
              setItemValue("backgroundUrl", event.target.value || null)
            }
          />
        </label>
        <label>
          Описание
          <textarea
            rows={3}
            value={item.description ?? ""}
            onChange={(event) =>
              setItemValue("description", event.target.value || null)
            }
          />
        </label>
        <fieldset className="library-fields">
          <legend>Игра и выбранная копия</legend>
          <label className="all-day-check">
            <input
              type="checkbox"
              checked={inLibrary}
              onChange={(event) => setInLibrary(event.target.checked)}
            />
            Добавить в библиотеку
          </label>
          {inLibrary && (
            <>
              <div className="form-grid">
                <label>
                  Статус выбранной копии
                  <select
                    value={profile.status}
                    onChange={(event) => {
                      const nextStatus = event.target.value as LibraryStatus;
                      setProfile((current) => ({
                        ...current,
                        status: nextStatus,
                        completedAt:
                          nextStatus === "COMPLETED" && !current.completedAt
                            ? new Date().toISOString()
                            : current.completedAt,
                      }));
                    }}
                  >
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Оценка
                  <select
                    value={profile.rating ?? ""}
                    onChange={(event) =>
                      setProfileValue(
                        "rating",
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                  >
                    <option value="">Без оценки</option>
                    {Array.from({ length: 10 }, (_, index) => index + 1).map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Дата прохождения выбранной копии
                  <input
                    disabled={profile.status !== "COMPLETED"}
                    type="date"
                    value={
                      profile.completedAt
                        ? new Date(
                            new Date(profile.completedAt).getTime() -
                              new Date(
                                profile.completedAt,
                              ).getTimezoneOffset() *
                                60_000,
                          )
                            .toISOString()
                            .slice(0, 10)
                        : ""
                    }
                    onChange={(event) =>
                      setProfileValue(
                        "completedAt",
                        event.target.value
                          ? new Date(
                              `${event.target.value}T12:00:00`,
                            ).toISOString()
                          : null,
                      )
                    }
                  />
                </label>
                <label>
                  Издание
                  <input
                    value={entry.edition ?? ""}
                    onChange={(event) =>
                      setEntryValue("edition", event.target.value || null)
                    }
                  />
                </label>
              </div>
              <div className="game-library-flags">
                <label className="favorite-check">
                  <input
                    type="checkbox"
                    checked={profile.favorite}
                    onChange={(event) =>
                      setProfileValue("favorite", event.target.checked)
                    }
                  />
                  В избранном
                </label>
                {xboxEnabled && (
                  <label className="play-anywhere-check">
                    <input
                      type="checkbox"
                      checked={item.xboxPlayAnywhere}
                      onChange={(event) =>
                        setItemValue("xboxPlayAnywhere", event.target.checked)
                      }
                    />
                    Xbox Play Anywhere
                  </label>
                )}
              </div>
              <label>
                Личная заметка
                <textarea
                  rows={2}
                  value={profile.personalNote ?? ""}
                  onChange={(event) =>
                    setProfileValue("personalNote", event.target.value || null)
                  }
                />
              </label>
              <fieldset className="library-fields">
                <legend>Копия игры</legend>
                <div className="form-grid">
                  <label>
                    Платформа
                    <select
                      required
                      value={entry.platformId}
                      onChange={(event) =>
                        setEntryValue("platformId", Number(event.target.value))
                      }
                    >
                      {platforms.map((value) => (
                        <option key={value.id} value={value.id}>
                          {value.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Источник
                    <select
                      required
                      value={entry.sourceId}
                      onChange={(event) =>
                        setEntryValue("sourceId", Number(event.target.value))
                      }
                    >
                      {compatibleSources.map((value) => (
                        <option key={value.id} value={value.id}>
                          {value.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Тип доступа
                    <select
                      value={entry.accessType}
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
                </div>
              </fieldset>
            </>
          )}
        </fieldset>
        {inLibrary && xboxEnabled && (
          <fieldset className="xbox-fields">
            <legend>Xbox-прогресс</legend>
            <div className="form-grid">
              <label>
                Получено достижений
                <input
                  min="0"
                  max={xboxProgress.totalAchievements}
                  type="number"
                  value={xboxProgress.unlockedAchievements}
                  onChange={(event) =>
                    setXboxProgress((current) => ({
                      ...current,
                      unlockedAchievements: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Всего достижений
                <input
                  min="0"
                  type="number"
                  value={xboxProgress.totalAchievements}
                  onChange={(event) =>
                    setXboxProgress((current) => ({
                      ...current,
                      totalAchievements: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Получено Gamerscore
                <input
                  min="0"
                  max={xboxProgress.totalGamerscore}
                  type="number"
                  value={xboxProgress.earnedGamerscore}
                  onChange={(event) =>
                    setXboxProgress((current) => ({
                      ...current,
                      earnedGamerscore: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Всего Gamerscore
                <input
                  min="0"
                  type="number"
                  value={xboxProgress.totalGamerscore}
                  onChange={(event) =>
                    setXboxProgress((current) => ({
                      ...current,
                      totalGamerscore: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
          </fieldset>
        )}
        <div className="form-buttons">
          {game && (
            <button
              className="danger-button"
              type="button"
              disabled={pending || searching || artworkSearching}
              onClick={() => void remove()}
            >
              {deleting ? "Удаляем…" : "Удалить"}
            </button>
          )}
          <button className="secondary-button" type="button" onClick={closeForm}>
            Отмена
          </button>
          <button className="primary-button" disabled={pending || searching || artworkSearching}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}
