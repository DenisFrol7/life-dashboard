import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Download, Plus, RefreshCw, Search, X } from "lucide-react";
import {
  createGame,
  createGameLibrary,
  createRawgGame,
  createGameSession,
  deleteGame,
  deleteGameSession,
  getGameCatalog,
  getGameLibrary,
  getGameSessions,
  getPlatforms,
  getSources,
  getSteamGridDbCovers,
  getXboxAchievementGroups,
  getXboxLibrarySummary,
  importSteamGames,
  prepareSteamImport,
  previewRawgGame,
  previewSteamImport,
  putGameProfile,
  putXboxProgress,
  searchRawgGames,
  searchSteamGridDbGames,
  syncRecentSteamProgress,
  updateGame,
  updateGameLibrary,
  updateRawgGame,
  updateGameSession,
  type Game,
  type GameInput,
  type GameLibrary,
  type GameLibraryInput,
  type GameSession,
  type GameSessionInput,
  type Reference,
  type RawgGameCandidate,
  type SteamGridDbCoverCandidate,
  type SteamGridDbGameCandidate,
  type SteamImportMatch,
  type SteamImportPreview,
  type SteamRecentSyncResult,
  type XboxAchievementGroup,
  type XboxProgress,
  type XboxProgressInput,
} from "../api/games";
import type { LibraryInput, LibraryStatus } from "../api/movies";
import { ErrorState, LoadingState } from "../components/AsyncState";
import { useToast } from "../components/ToastContext";

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

export function GamesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [games, setGames] = useState<Game[]>([]);
  const [library, setLibrary] = useState<Record<number, GameLibrary>>({});
  const [libraryEntries, setLibraryEntries] = useState<GameLibrary[]>([]);
  const [platforms, setPlatforms] = useState<Reference[]>([]);
  const [sources, setSources] = useState<Reference[]>([]);
  const [xbox, setXbox] = useState<Record<number, XboxProgress | null>>({});
  const [xboxBase, setXboxBase] = useState<
    Record<number, XboxProgressInput | null>
  >({});
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [editing, setEditing] = useState<Game | "new" | null>(null);
  const [editingSession, setEditingSession] = useState<
    GameSession | "new" | null
  >(null);
  const [steamImportOpen, setSteamImportOpen] = useState(false);
  const [syncingSteamRecent, setSyncingSteamRecent] = useState(false);
  const [steamRecentResult, setSteamRecentResult] =
    useState<SteamRecentSyncResult | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LibraryStatus | "GAME_PASS" | "">("");
  const [platform, setPlatform] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        catalog,
        entries,
        platformList,
        sourceList,
        sessionList,
        xboxSummary,
      ] = await Promise.all([
        getGameCatalog(),
        getGameLibrary(),
        getPlatforms(),
        getSources(),
        getGameSessions(),
        getXboxLibrarySummary(),
      ]);
      setGames(catalog);
      setLibraryEntries(entries);
      setLibrary(
        Object.fromEntries(entries.map((entry) => [entry.contentId, entry])),
      );
      setPlatforms(platformList);
      setSources(sourceList);
      setSessions(sessionList);
      setXbox(
        Object.fromEntries(
          xboxSummary.map((summary) => [
            summary.libraryEntryId,
            summary.progress,
          ]),
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
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось загрузить игры",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
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
      const matchesStatus =
        !status || status === "GAME_PASS"
          ? !status || copies.some((item) => item.source.code === "GAME_PASS")
          : entry?.status === status;
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
  const sessionPlaytime = sessions.reduce(
    (sum, item) => sum + item.durationMinutes,
    0,
  );
  const countGamesBy = (predicate: (entry: GameLibrary) => boolean) =>
    new Set(libraryEntries.filter(predicate).map((item) => item.contentId))
      .size;
  const xboxGames = countGamesBy((item) => isXbox(item.platform.code));
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
  const totalAchievements = Object.values(xbox).reduce(
    (sum, item) => sum + (item?.unlockedAchievements ?? 0),
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
      if (result.updated > 0) await load();
      const message = `Steam: обновлено ${result.updated}, уже актуально ${result.upToDate}`;
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
  if (loading) return <LoadingState message="Загружаем игры…" />;
  if (error)
    return (
      <ErrorState
        title="Не удалось загрузить игры"
        message={error}
        onRetry={() => void load()}
      />
    );
  return (
    <div className="movies-page series-page games-page">
      <section className="media-toolbar series-media-toolbar">
        <div
          className="series-status-tabs game-status-tabs"
          aria-label="Фильтр игр по статусу"
        >
          {(
            [
              ["", "Все"],
              ["IN_PROGRESS", "Играю"],
              ["COMPLETED", "Пройдено"],
              ["NOT_STARTED", "Не начато"],
              ["PAUSED", "На паузе"],
              ["DROPPED", "Брошено"],
              ["GAME_PASS", "Game Pass"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "all"}
              className={status === value ? "active" : ""}
              onClick={() => setStatus(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="journal-search game-catalog-search">
          <span>
            <Search />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти игру"
          />
        </div>
        <select
          className="game-platform-filter"
          value={platform}
          onChange={(event) => setPlatform(event.target.value)}
        >
          <option value="">Все платформы</option>
          {platforms.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          className="game-platform-filter game-source-filter"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          <option value="">Все источники</option>
          {sources.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <button
          className="secondary-button icon-button steam-import-button"
          disabled={syncingSteamRecent || steamGames === 0}
          onClick={() => void updateRecentSteamProgress()}
          title="Обновить достижения недавно запущенных игр"
        >
          <RefreshCw className={syncingSteamRecent ? "spinning" : undefined} />
          {syncingSteamRecent ? "Обновляем Steam…" : "Обновить Steam"}
        </button>
        <button
          className="secondary-button icon-button steam-import-button"
          onClick={() => setSteamImportOpen(true)}
        >
          <Download />
          Импорт Steam
        </button>
        <button
          className="primary-button series-add-button media-add-button icon-button"
          onClick={() => setEditing("new")}
        >
          <Plus />
          Добавить игру
        </button>
      </section>
      <section className="series-catalog-layout">
        <div className="series-catalog-main">
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
                {steamRecentResult.notImported > 0 &&
                  ` · не импортировано: ${steamRecentResult.notImported}`}
              </span>
              {steamRecentResult.games
                .filter((item) => item.status === "FAILED")
                .map((item) => (
                  <small key={item.libraryEntryId}>
                    {item.title}: {item.message}
                  </small>
                ))}
            </div>
          )}
          {error && (
            <div className="notice error movies-error">
              <strong>Ошибка</strong>
              <span>{error}</span>
            </div>
          )}
          {loading ? (
            <div className="loading">
              <span />
              Загружаем игры…
            </div>
          ) : visible.length === 0 ? (
            <div className="media-empty">
              <span>＋</span>
              <h2>Игр пока нет</h2>
              <p>Добавьте первую игру в каталог.</p>
            </div>
          ) : (
            <section className="movie-grid series-catalog-grid">
              {visible.map((game) => {
                const entry = library[game.id];
                const copies = libraryEntries.filter(
                  (item) => item.contentId === game.id,
                );
                const platformNames = [
                  ...new Set(copies.map((item) => item.platform.name)),
                ];
                const sourceNames = [
                  ...new Set(copies.map((item) => item.source.name)),
                ];
                const progress = entry ? xbox[entry.id] : null;
                return (
                  <article
                    className="series-list-card game-catalog-card"
                    key={game.id}
                  >
                    <button
                      className="series-list-cover game-poster"
                      onClick={() => navigate(`/games/${game.id}`)}
                      style={
                        game.backgroundUrl ?? game.coverUrl
                          ? {
                              backgroundImage: `url(${game.backgroundUrl ?? game.coverUrl})`,
                            }
                          : undefined
                      }
                    >
                      <span>{game.title.slice(0, 1)}</span>
                      {entry?.favorite && <i>♥</i>}
                    </button>
                    <div className="series-list-content">
                      <div className="series-list-heading">
                        <button onClick={() => navigate(`/games/${game.id}`)}>
                          {game.title}
                        </button>
                        {platformNames.map((name) => (
                          <span
                            className="release-badge game-platform-badge"
                            key={name}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                      <div className="movie-list-meta">
                        <span>{game.releaseYear ?? "—"}</span>
                        <span>{game.genre ?? "Жанр не указан"}</span>
                        {sourceNames.map((name) => (
                          <span key={name}>{name}</span>
                        ))}
                      </div>
                      <div className="series-list-inline-status">
                        {entry ? (
                          <span
                            className={`media-status ${entry.status.toLowerCase()}`}
                          >
                            {statusLabels[entry.status]}
                          </span>
                        ) : (
                          <span className="media-status not_started">
                            Не в библиотеке
                          </span>
                        )}
                      </div>
                      {progress && (
                        <div className="game-catalog-progress">
                          <strong className="game-catalog-achievements">
                            <b>{progress.unlockedAchievements}</b>
                            <small>из</small>
                            <b>{progress.totalAchievements}</b>
                            <small>достижений</small>
                          </strong>
                          <div className="series-list-progress">
                            <span
                              style={{
                                width: `${progress.achievementPercent}%`,
                              }}
                            />
                          </div>
                          <span className="game-catalog-gamerscore">
                            <b>{progress.earnedGamerscore}</b>
                            <small>из</small>
                            <b>{progress.totalGamerscore}</b>
                            <small>G</small>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="series-list-side">
                      {entry ? (
                        <strong className="series-list-score">
                          {entry.rating ? `${entry.rating}/10` : "Без оценки"}
                        </strong>
                      ) : (
                        <button
                          className="add-library-button"
                          onClick={() => setEditing(game)}
                        >
                          + В библиотеку
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
        <aside className="series-statistics">
          <p className="eyebrow">Общая статистика</p>
          <h2>Игры</h2>
          <dl>
            <div>
              <dt>Количество игр</dt>
              <dd>{games.length}</dd>
            </div>
            <div>
              <dt>Не начато</dt>
              <dd>
                {
                  Object.values(library).filter(
                    (item) => item.status === "NOT_STARTED",
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt>Пройдено</dt>
              <dd>
                {
                  Object.values(library).filter(
                    (item) => item.status === "COMPLETED",
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt>Играю</dt>
              <dd>
                {
                  Object.values(library).filter(
                    (item) => item.status === "IN_PROGRESS",
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt>На паузе</dt>
              <dd>
                {
                  Object.values(library).filter(
                    (item) => item.status === "PAUSED",
                  ).length
                }
              </dd>
            </div>
            <div>
              <dt>Брошено</dt>
              <dd>
                {
                  Object.values(library).filter(
                    (item) => item.status === "DROPPED",
                  ).length
                }
              </dd>
            </div>
            <div className="series-stat-total">
              <dt>Xbox</dt>
              <dd>{xboxGames}</dd>
            </div>
            <div>
              <dt>PC</dt>
              <dd>{pcGames}</dd>
            </div>
            <div>
              <dt>Game Pass</dt>
              <dd>{gamePassGames}</dd>
            </div>
            <div className="series-stat-total">
              <dt>Steam</dt>
              <dd>{steamGames}</dd>
            </div>
            <div>
              <dt>EA</dt>
              <dd>{eaGames}</dd>
            </div>
            <div>
              <dt>Epic Games</dt>
              <dd>{epicGames}</dd>
            </div>
            <div>
              <dt>Ubisoft Connect</dt>
              <dd>{ubisoftGames}</dd>
            </div>
            <div className="series-stat-total">
              <dt>Игровое время</dt>
              <dd>
                {Math.floor(sessionPlaytime / 60)} ч {sessionPlaytime % 60} мин
              </dd>
            </div>
            <div>
              <dt>Достижения</dt>
              <dd>{totalAchievements}</dd>
            </div>
            <div>
              <dt>Gamerscore</dt>
              <dd>{totalGamerscore} G</dd>
            </div>
          </dl>
        </aside>
      </section>
      {visible.some((game) => game.rawgSlug) && (
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
      <section className="game-sessions-panel game-sessions-bottom">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Игровая активность</p>
            <h2>Последние игровые сессии</h2>
          </div>
          <button
            className="primary-button"
            disabled={!Object.keys(library).length}
            onClick={() => setEditingSession("new")}
          >
            + Добавить сессию
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="muted">Игровых сессий пока нет.</p>
        ) : (
          <div className="game-session-list">
            {sessions.slice(0, 5).map((session) => (
              <button
                key={session.id}
                onClick={() => setEditingSession(session)}
              >
                <span>
                  <strong>{session.title}</strong>
                  <small>
                    {new Date(session.startedAt).toLocaleString("ru-RU")}
                  </small>
                </span>
                <span className="game-session-achievements">
                  {session.unlockedAchievements
                    ? `+${session.unlockedAchievements} достиж.`
                    : ""}
                  {session.earnedGamerscore
                    ? `+${session.earnedGamerscore} G`
                    : ""}
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
    </div>
  );
}

const steamMatchLabels: Record<SteamImportMatch, string> = {
  ALREADY_IMPORTED: "Уже в библиотеке",
  MATCHED: "Найдена карточка",
  REVIEW: "Нужно проверить",
  NEW: "Новая игра",
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

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPreview(await previewSteamImport());
      setExcludedAppIds(new Set());
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
    if (selectedForImport.length === 0) return;
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
      const appIds = selectedForImport.map((game) => game.appId);
      const preparation = await prepareSteamImport(appIds);
      setCreatingBackup(false);
      const total = {
        imported: 0,
        catalogCreated: 0,
        rawgEnriched: 0,
        steamGridDbCovers: 0,
      };
      const batchSize = 5;
      for (let offset = 0; offset < appIds.length; offset += batchSize) {
        const batch = appIds.slice(offset, offset + batchSize);
        const result = await importSteamGames(preparation.backupToken, batch);
        total.imported += result.imported;
        total.catalogCreated += result.catalogCreated;
        total.rawgEnriched += result.rawgEnriched;
        total.steamGridDbCovers += result.steamGridDbCovers;
        processed = Math.min(offset + batch.length, appIds.length);
        setImportProgress({
          completed: processed,
          total: appIds.length,
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
                  disabled={importing || selectedForImport.length === 0}
                >
                  {importing
                    ? creatingBackup
                      ? "Создаём бэкап…"
                      : `Импортируем ${importProgress?.completed ?? 0}/${importProgress?.total ?? selectedForImport.length}`
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

function GameForm({
  game,
  library,
  platforms,
  sources,
  progress,
  onClose,
  onSaved,
}: {
  game?: Game;
  library?: GameLibrary;
  platforms: Reference[];
  sources: Reference[];
  progress?: XboxProgressInput | null;
  onClose: () => void;
  onSaved: () => void;
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
  const [saving, setSaving] = useState(false);
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
  useEffect(() => {
    setXboxProgress(progress ?? emptyProgress);
  }, [progress]);
  const setItemValue = <K extends keyof GameInput>(
    key: K,
    value: GameInput[K],
  ) => setItem((current) => ({ ...current, [key]: value }));
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
  const xboxEnabled = selectedPlatform ? isXbox(selectedPlatform.code) : false;
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
    setSearching(true);
    setSearchCompleted(false);
    setError(null);
    try {
      setCandidates(await searchRawgGames(value));
      setSearchCompleted(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось выполнить поиск в RAWG",
      );
    } finally {
      setSearching(false);
    }
  };
  const selectRawgCandidate = async (candidate: RawgGameCandidate) => {
    if (
      candidate.existingContentId &&
      candidate.existingContentId !== game?.id
    )
      return;
    setSearching(true);
    setError(null);
    try {
      const details = await previewRawgGame(candidate.rawgId);
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
      setArtworkQuery(details.originalTitle ?? details.title);
      setSelectedRawgId(details.rawgId);
      setCandidates([]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось загрузить карточку RAWG",
      );
    } finally {
      setSearching(false);
    }
  };
  const searchArtwork = async () => {
    const value = artworkQuery.trim();
    if (value.length < 2) return;
    setArtworkSearching(true);
    setError(null);
    setArtworkCovers([]);
    try {
      setArtworkGames(await searchSteamGridDbGames(value));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось выполнить поиск в SteamGridDB",
      );
    } finally {
      setArtworkSearching(false);
    }
  };
  const selectArtworkGame = async (candidate: SteamGridDbGameCandidate) => {
    setArtworkSearching(true);
    setError(null);
    try {
      const covers = await getSteamGridDbCovers(candidate.steamGridDbId);
      setArtworkCovers(covers);
      setArtworkGames([]);
      if (covers.length === 0)
        setError("Для этой игры нет вертикальных обложек 600×900");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось загрузить обложки SteamGridDB",
      );
    } finally {
      setArtworkSearching(false);
    }
  };
  const selectArtworkCover = (cover: SteamGridDbCoverCandidate) => {
    setItem((current) => ({
      ...current,
      coverUrl: cover.imageUrl,
      steamGridDbGameId: cover.steamGridDbGameId,
      steamGridDbGridId: cover.gridId,
    }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
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
      showToast(game ? "Игра обновлена" : "Игра добавлена");
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось сохранить игру",
      );
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!game || !window.confirm(`Удалить «${game.title}» из общего каталога?`))
      return;
    try {
      await deleteGame(game.id);
      showToast("Игра удалена");
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Не удалось удалить игру",
      );
    }
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
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <section className="kinopoisk-movie-search rawg-game-search">
          <div>
            <input
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
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
              onChange={(event) => setArtworkQuery(event.target.value)}
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

function GameSessionForm({
  session,
  library,
  onClose,
  onSaved,
}: {
  session?: GameSession;
  library: GameLibrary[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const localDateTime = (value: string) => {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  };
  const [libraryId, setLibraryId] = useState(
    session?.libraryEntryId ?? library[0]?.id ?? 0,
  );
  const [input, setInput] = useState<GameSessionInput>({
    startedAt: session?.startedAt ?? new Date().toISOString(),
    durationMinutes: session?.durationMinutes ?? 60,
    note: session?.note ?? null,
    unlockedAchievements: session?.unlockedAchievements ?? 0,
    earnedGamerscore: session?.earnedGamerscore ?? 0,
    achievementGroupId: session?.achievementGroupId ?? null,
  });
  const [groups, setGroups] = useState<XboxAchievementGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedEntry = library.find((entry) => entry.id === libraryId);
  const achievementsEnabled = selectedEntry
    ? isXbox(selectedEntry.platform.code)
    : false;
  useEffect(() => {
    if (!achievementsEnabled) {
      setGroups([]);
      setInput((current) => ({ ...current, achievementGroupId: null }));
      return;
    }
    getXboxAchievementGroups(libraryId)
      .then((values) => {
        setGroups(values);
        setInput((current) => ({
          ...current,
          achievementGroupId: values.some(
            (value) => value.id === current.achievementGroupId,
          )
            ? current.achievementGroupId
            : (values.find((value) => value.groupType === "BASE_GAME")?.id ??
              null),
        }));
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Не удалось загрузить группы достижений",
        ),
      );
  }, [achievementsEnabled, libraryId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const normalizedInput =
        input.unlockedAchievements === 0 && input.earnedGamerscore === 0
          ? { ...input, achievementGroupId: null }
          : input;
      if (session) await updateGameSession(session.id, normalizedInput);
      else await createGameSession(libraryId, normalizedInput);
      showToast(
        session ? "Игровая сессия обновлена" : "Игровая сессия добавлена",
      );
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось сохранить игровую сессию",
      );
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!session || !window.confirm("Удалить игровую сессию?")) return;
    try {
      await deleteGameSession(session.id);
      showToast("Игровая сессия удалена");
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось удалить игровую сессию",
      );
    }
  };
  return (
    <div className="modal-backdrop">
      <form
        className="habit-form session-form"
        onSubmit={(event) => void submit(event)}
      >
        <div className="form-heading">
          <div>
            <p className="eyebrow">Игровое время</p>
            <h2>{session ? "Редактирование сессии" : "Новая сессия"}</h2>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <label>
          Игра и платформа
          <select
            disabled={Boolean(session)}
            value={libraryId}
            onChange={(event) => setLibraryId(Number(event.target.value))}
          >
            {library.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title} · {entry.platform.name} · {entry.source.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Начало
            <input
              required
              type="datetime-local"
              value={localDateTime(input.startedAt)}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  startedAt: new Date(event.target.value).toISOString(),
                }))
              }
            />
          </label>
          <label>
            Продолжительность, минут
            <input
              required
              min="1"
              type="number"
              value={input.durationMinutes}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  durationMinutes: Number(event.target.value),
                }))
              }
            />
          </label>
        </div>
        {achievementsEnabled && (
          <fieldset className="xbox-fields">
            <legend>Получено за эту сессию</legend>
            <label>
              Раздел достижений
              <select
                required
                value={input.achievementGroupId ?? ""}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    achievementGroupId: Number(event.target.value),
                  }))
                }
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Достижений
                <input
                  min="0"
                  type="number"
                  value={input.unlockedAchievements}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      unlockedAchievements: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                Gamerscore
                <input
                  min="0"
                  type="number"
                  value={input.earnedGamerscore}
                  onChange={(event) =>
                    setInput((current) => ({
                      ...current,
                      earnedGamerscore: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>
          </fieldset>
        )}
        <label>
          Заметка
          <textarea
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
          {session && (
            <button
              className="danger-button"
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
