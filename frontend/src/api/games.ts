import { apiRequest, ApiClientError } from "./client";
import type { LibraryInput, LibraryStatus, ReleaseStatus } from "./movies";

export type Game = {
  id: number;
  title: string;
  originalTitle: string | null;
  itemType: "GAME";
  format: null;
  releaseYear: number | null;
  description: string | null;
  coverUrl: string | null;
  durationMinutes: null;
  releaseStatus: ReleaseStatus;
  genre: string | null;
  developer: string | null;
  releaseDate: string | null;
  xboxPlayAnywhere: boolean;
};
export type GameInput = Omit<Game, "id">;
export type Reference = {
  id: number;
  code: string;
  name: string;
  type: "DIGITAL_STORE" | "PHYSICAL" | "SUBSCRIPTION" | null;
};
export type AccessType = "OWNED" | "SUBSCRIPTION";
export type GameLibrary = {
  id: number;
  contentId: number;
  title: string;
  platform: Reference;
  source: Reference;
  accessType: AccessType;
  edition: string | null;
  acquiredAt: string | null;
  note: string | null;
  status: LibraryStatus;
  rating: number | null;
  favorite: boolean;
  startedAt: string | null;
  completedAt: string | null;
  personalNote: string | null;
  legacyPlaytimeMinutes: number;
};
export type GameLibraryInput = Pick<
  GameLibrary,
  | "accessType"
  | "edition"
  | "acquiredAt"
  | "note"
  | "legacyPlaytimeMinutes"
  | "status"
  | "startedAt"
  | "completedAt"
> & { platformId: number; sourceId: number };
export type XboxProgress = {
  id: number;
  libraryEntryId: number;
  totalAchievements: number;
  unlockedAchievements: number;
  achievementPercent: number;
  totalGamerscore: number;
  earnedGamerscore: number;
  gamerscorePercent: number;
  lastUpdatedAt: string;
};
export type XboxProgressInput = Pick<
  XboxProgress,
  | "totalAchievements"
  | "unlockedAchievements"
  | "totalGamerscore"
  | "earnedGamerscore"
>;
export type XboxLibrarySummary = {
  libraryEntryId: number;
  progress: XboxProgress;
  baseGame: XboxAchievementGroup | null;
};
export type GameSession = {
  id: number;
  libraryEntryId: number;
  contentId: number;
  title: string;
  startedAt: string;
  durationMinutes: number;
  note: string | null;
  unlockedAchievements: number;
  earnedGamerscore: number;
  achievementGroupId: number | null;
  achievementGroupName: string | null;
};
export type GameSessionInput = Pick<
  GameSession,
  | "startedAt"
  | "durationMinutes"
  | "note"
  | "unlockedAchievements"
  | "earnedGamerscore"
  | "achievementGroupId"
>;
export type GamePlaythrough = {
  id: number;
  libraryEntryId: number;
  playthroughNumber: number;
  completedAt: string;
  playtimeMinutes: number;
  note: string | null;
};
export type GamePlaythroughInput = Pick<
  GamePlaythrough,
  "completedAt" | "note"
>;
export type XboxAchievementGroup = {
  id: number;
  libraryEntryId: number;
  name: string;
  groupType: "BASE_GAME" | "DLC";
  totalAchievements: number;
  unlockedAchievements: number;
  achievementPercent: number;
  totalGamerscore: number;
  earnedGamerscore: number;
  gamerscorePercent: number;
  completedAt: string | null;
};
export type XboxAchievementGroupInput = Pick<
  XboxAchievementGroup,
  | "name"
  | "totalAchievements"
  | "unlockedAchievements"
  | "totalGamerscore"
  | "earnedGamerscore"
  | "completedAt"
>;

export const getGameCatalog = () =>
  apiRequest<Game[]>("/api/content?type=GAME");
export const createGame = (input: GameInput) =>
  apiRequest<Game>("/api/content", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const updateGame = (id: number, input: GameInput) =>
  apiRequest<Game>(`/api/content/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
export const deleteGame = (id: number) =>
  apiRequest<void>(`/api/content/${id}`, { method: "DELETE" });
export const getPlatforms = () =>
  apiRequest<Reference[]>("/api/games/platforms");
export const getSources = () => apiRequest<Reference[]>("/api/games/sources");
export const getGameLibrary = () =>
  apiRequest<GameLibrary[]>("/api/games/library");
export const createGameLibrary = (contentId: number, input: GameLibraryInput) =>
  apiRequest<GameLibrary>(`/api/games/library/${contentId}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
export const updateGameLibrary = (id: number, input: GameLibraryInput) =>
  apiRequest<GameLibrary>(`/api/games/library/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
export const deleteGameLibrary = (id: number) =>
  apiRequest<void>(`/api/games/library/${id}`, { method: "DELETE" });
export const putGameProfile = (contentId: number, input: LibraryInput) =>
  apiRequest(`/api/games/profile/${contentId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
export const getXboxProgress = async (libraryId: number) => {
  try {
    return await apiRequest<XboxProgress>(
      `/api/games/library/${libraryId}/xbox-progress`,
    );
  } catch (error) {
    if (error instanceof ApiClientError && error.payload.status === 404)
      return null;
    throw error;
  }
};
export const getXboxLibrarySummary = () =>
  apiRequest<XboxLibrarySummary[]>("/api/games/xbox-summary");
export const putXboxProgress = (libraryId: number, input: XboxProgressInput) =>
  apiRequest<XboxProgress>(`/api/games/library/${libraryId}/xbox-progress`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
export const getGameSessions = (from?: string, to?: string) => {
  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return apiRequest<GameSession[]>(
    `/api/games/sessions${query.size ? `?${query}` : ""}`,
  );
};
export const createGameSession = (libraryId: number, input: GameSessionInput) =>
  apiRequest<GameSession>(`/api/games/library/${libraryId}/sessions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
export const updateGameSession = (id: number, input: GameSessionInput) =>
  apiRequest<GameSession>(`/api/games/sessions/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
export const deleteGameSession = (id: number) =>
  apiRequest<void>(`/api/games/sessions/${id}`, { method: "DELETE" });
export const getGamePlaythroughs = (libraryId: number) =>
  apiRequest<GamePlaythrough[]>(`/api/games/library/${libraryId}/playthroughs`);
export const createGamePlaythrough = (
  libraryId: number,
  input: GamePlaythroughInput,
) =>
  apiRequest<GamePlaythrough>(`/api/games/library/${libraryId}/playthroughs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
export const updateGamePlaythrough = (
  id: number,
  input: GamePlaythroughInput,
) =>
  apiRequest<GamePlaythrough>(`/api/games/playthroughs/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
export const deleteGamePlaythrough = (id: number) =>
  apiRequest<void>(`/api/games/playthroughs/${id}`, { method: "DELETE" });
export const getXboxAchievementGroups = (libraryId: number) =>
  apiRequest<XboxAchievementGroup[]>(
    `/api/games/library/${libraryId}/achievement-groups`,
  );
export const createXboxAchievementGroup = (
  libraryId: number,
  input: XboxAchievementGroupInput,
) =>
  apiRequest<XboxAchievementGroup>(
    `/api/games/library/${libraryId}/achievement-groups`,
    { method: "POST", body: JSON.stringify(input) },
  );
export const updateXboxAchievementGroup = (
  id: number,
  input: XboxAchievementGroupInput,
) =>
  apiRequest<XboxAchievementGroup>(`/api/games/achievement-groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
export const deleteXboxAchievementGroup = (id: number) =>
  apiRequest<void>(`/api/games/achievement-groups/${id}`, { method: "DELETE" });
