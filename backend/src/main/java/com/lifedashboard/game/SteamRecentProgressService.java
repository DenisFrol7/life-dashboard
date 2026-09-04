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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class SteamRecentProgressService {
    private static final int INITIAL_SYNC_BATCH_SIZE = 10;
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
        List<UserGame> steamCopies = gameRepository.findSteamCopies(userId);
        Map<Long, List<UserGame>> copiesByAppId = new HashMap<>();
        for (UserGame copy : steamCopies) {
            copiesByAppId.computeIfAbsent(copy.getSteamAppId(), ignored -> new ArrayList<>())
                    .add(copy);
        }
        List<Long> copyIds = steamCopies.stream().map(UserGame::getId).toList();
        Map<Long, SteamGameProgress> progressByCopyId = new HashMap<>();
        if (!copyIds.isEmpty()) {
            for (SteamGameProgress progress : progressRepository.findAllByLibraryEntryIdIn(copyIds)) {
                progressByCopyId.put(progress.getLibraryEntry().getId(), progress);
            }
        }
        Set<Long> missingBefore = new HashSet<>(copyIds);
        missingBefore.removeAll(progressByCopyId.keySet());

        List<GameResult> results = new ArrayList<>();
        Set<Long> handledCopyIds = new HashSet<>();
        int notImported = 0;
        int matched = 0;
        int updated = 0;
        int upToDate = 0;
        int initiallySynced = 0;
        int failed = 0;
        for (SteamOwnedGame recent : recentGames) {
            List<UserGame> copies = copiesByAppId.get(recent.appId());
            if (copies == null || copies.isEmpty()) {
                notImported++;
                continue;
            }
            for (UserGame copy : copies) {
                matched++;
                handledCopyIds.add(copy.getId());
                SteamGameProgress stored = progressByCopyId.get(copy.getId());
                if (isUpToDate(stored, recent.lastPlayedAt())) {
                    upToDate++;
                    results.add(new GameResult(copy.getId(), recent.appId(), recent.title(),
                            Status.UP_TO_DATE, stored.getUnlockedAchievements(),
                            stored.getTotalAchievements(), null));
                    continue;
                }
                try {
                    SteamProgressResponse progress = progressService.sync(copy.getId());
                    Status status;
                    if (stored == null) {
                        initiallySynced++;
                        status = Status.INITIALIZED;
                    } else {
                        updated++;
                        status = Status.UPDATED;
                    }
                    results.add(new GameResult(copy.getId(), recent.appId(), recent.title(),
                            status, progress.unlockedAchievements(),
                            progress.totalAchievements(), null));
                } catch (RuntimeException exception) {
                    failed++;
                    results.add(new GameResult(copy.getId(), recent.appId(), recent.title(),
                            Status.FAILED, null, null, errorMessage(exception)));
                }
            }
        }

        int initialAttempts = 0;
        for (UserGame copy : steamCopies) {
            if (initialAttempts >= INITIAL_SYNC_BATCH_SIZE) break;
            if (handledCopyIds.contains(copy.getId()) || progressByCopyId.containsKey(copy.getId())) {
                continue;
            }
            initialAttempts++;
            String title = copy.getUserContent().getContent().getTitle();
            try {
                SteamProgressResponse progress = progressService.sync(copy.getId());
                initiallySynced++;
                results.add(new GameResult(copy.getId(), copy.getSteamAppId(), title,
                        Status.INITIALIZED, progress.unlockedAchievements(),
                        progress.totalAchievements(), null));
            } catch (RuntimeException exception) {
                failed++;
                results.add(new GameResult(copy.getId(), copy.getSteamAppId(), title,
                        Status.FAILED, null, null, errorMessage(exception)));
            }
        }
        int remainingUnsynced = Math.max(0, missingBefore.size() - initiallySynced);
        return new SteamRecentSyncResponse(recentGames.size(), matched, updated, upToDate,
                initiallySynced, remainingUnsynced, notImported, failed, List.copyOf(results));
    }

    private boolean isUpToDate(SteamGameProgress progress, Instant lastPlayedAt) {
        return progress != null && lastPlayedAt != null
                && !progress.getLastSyncedAt().isBefore(lastPlayedAt);
    }

    private String errorMessage(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank()
                ? "Не удалось обновить достижения" : message;
    }
}
