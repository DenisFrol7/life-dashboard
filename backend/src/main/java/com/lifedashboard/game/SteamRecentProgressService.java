package com.lifedashboard.game;

import com.lifedashboard.game.dto.SteamProgressResponse;
import com.lifedashboard.game.dto.SteamRecentSyncResponse;
import com.lifedashboard.game.dto.SteamRecentSyncResponse.GameResult;
import com.lifedashboard.game.dto.SteamRecentSyncResponse.Status;
import com.lifedashboard.game.steam.SteamClient;
import com.lifedashboard.game.steam.SteamOwnedGame;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SteamRecentProgressService {
    private final SteamClient steam;
    private final UserGameRepository gameRepository;
    private final SteamGameProgressRepository progressRepository;
    private final SteamProgressService progressService;
    private final long userId;

    public SteamRecentProgressService(SteamClient steam, UserGameRepository gameRepository,
            SteamGameProgressRepository progressRepository, SteamProgressService progressService,
            @Value("${app.default-user-id}") long userId) {
        this.steam = steam;
        this.gameRepository = gameRepository;
        this.progressRepository = progressRepository;
        this.progressService = progressService;
        this.userId = userId;
    }

    public SteamRecentSyncResponse syncRecent() {
        List<SteamOwnedGame> recentGames = steam.recentlyPlayedGames();
        Map<Long, List<UserGame>> copiesByAppId = new HashMap<>();
        for (UserGame copy : gameRepository.findSteamCopies(userId)) {
            copiesByAppId.computeIfAbsent(copy.getSteamAppId(), ignored -> new ArrayList<>())
                    .add(copy);
        }

        List<GameResult> results = new ArrayList<>();
        int notImported = 0;
        int updated = 0;
        int upToDate = 0;
        int failed = 0;
        for (SteamOwnedGame recent : recentGames) {
            List<UserGame> copies = copiesByAppId.get(recent.appId());
            if (copies == null || copies.isEmpty()) {
                notImported++;
                continue;
            }
            for (UserGame copy : copies) {
                SteamGameProgress stored = progressRepository.findByLibraryEntryId(copy.getId())
                        .orElse(null);
                if (isUpToDate(stored, recent.lastPlayedAt())) {
                    upToDate++;
                    results.add(new GameResult(copy.getId(), recent.appId(), recent.title(),
                            Status.UP_TO_DATE, stored.getUnlockedAchievements(),
                            stored.getTotalAchievements(), null));
                    continue;
                }
                try {
                    SteamProgressResponse progress = progressService.sync(copy.getId());
                    updated++;
                    results.add(new GameResult(copy.getId(), recent.appId(), recent.title(),
                            Status.UPDATED, progress.unlockedAchievements(),
                            progress.totalAchievements(), null));
                } catch (RuntimeException exception) {
                    failed++;
                    String message = exception.getMessage();
                    results.add(new GameResult(copy.getId(), recent.appId(), recent.title(),
                            Status.FAILED, null, null,
                            message == null || message.isBlank()
                                    ? "Не удалось обновить достижения" : message));
                }
            }
        }
        int matched = updated + upToDate + failed;
        return new SteamRecentSyncResponse(recentGames.size(), matched, updated, upToDate,
                notImported, failed, List.copyOf(results));
    }

    private boolean isUpToDate(SteamGameProgress progress, Instant lastPlayedAt) {
        return progress != null && lastPlayedAt != null
                && !progress.getLastSyncedAt().isBefore(lastPlayedAt);
    }
}
