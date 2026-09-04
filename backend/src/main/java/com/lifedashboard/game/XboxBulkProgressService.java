package com.lifedashboard.game;

import com.lifedashboard.game.dto.XboxBulkSyncResponse;
import com.lifedashboard.game.dto.XboxBulkSyncResponse.GameResult;
import com.lifedashboard.game.dto.XboxBulkSyncResponse.Status;
import com.lifedashboard.game.dto.XboxProgressSyncResponse;
import com.lifedashboard.game.openxbl.OpenXblClient;
import com.lifedashboard.game.openxbl.OpenXblTitle;
import com.lifedashboard.game.openxbl.OpenXblTitleHistory;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashSet;

@Service
public class XboxBulkProgressService {
    private static final Logger log = LoggerFactory.getLogger(XboxBulkProgressService.class);
    private final OpenXblClient openXbl;
    private final UserGameRepository games;
    private final XboxGameProgressRepository progress;
    private final XboxProgressSyncService progressSync;
    private final GamePlaythroughService playthroughs;
    private final long userId;

    public XboxBulkProgressService(OpenXblClient openXbl, UserGameRepository games,
            XboxGameProgressRepository progress, XboxProgressSyncService progressSync,
            GamePlaythroughService playthroughs,
            @Value("${app.default-user-id}") long userId) {
        this.openXbl = openXbl;
        this.games = games;
        this.progress = progress;
        this.progressSync = progressSync;
        this.playthroughs = playthroughs;
        this.userId = userId;
    }

    public XboxBulkSyncResponse syncLinked() {
        OpenXblTitleHistory history = openXbl.titleHistory();
        List<UserGame> xboxCopies = games.findXboxCopies(userId);
        List<UserGame> linkedCopies = xboxCopies.stream()
                .filter(copy -> copy.getXboxTitleId() != null)
                .toList();
        List<Long> linkedTitleIds = new ArrayList<>(new LinkedHashSet<>(linkedCopies.stream()
                .map(UserGame::getXboxTitleId).toList()));
        Map<Long, Long> playtimeByTitle = Map.of();
        boolean playtimeSyncFailed = false;
        try {
            playtimeByTitle = openXbl.playtimeMinutes(history.xuid(), linkedTitleIds);
        } catch (RuntimeException exception) {
            playtimeSyncFailed = true;
            log.warn("Xbox playtime sync skipped: {}", exception.getClass().getSimpleName());
        }
        int playtimeUpdated = 0;
        int playtimeUnavailable = 0;
        int playthroughPlaytimeUpdated = 0;
        for (UserGame copy : linkedCopies) {
            Long remoteMinutes = playtimeByTitle.get(copy.getXboxTitleId());
            if (remoteMinutes == null) {
                playtimeUnavailable++;
            } else if (remoteMinutes > copy.getLegacyPlaytimeMinutes()) {
                playtimeUpdated += games.updateXboxPlaytime(copy.getId(), userId, remoteMinutes);
            }
            if (remoteMinutes != null
                    && playthroughs.fillXboxAchievementPlaytime(copy.getId(), remoteMinutes)) {
                playthroughPlaytimeUpdated++;
            }
        }
        Map<Long, OpenXblTitle> titlesById = new HashMap<>();
        for (OpenXblTitle title : history.titles()) titlesById.put(title.titleId(), title);
        Map<Long, XboxGameProgress> progressByCopyId = new HashMap<>();
        for (XboxGameProgress stored : progress.findAllByUserId(userId)) {
            progressByCopyId.put(stored.getLibraryEntry().getId(), stored);
        }

        int updated = 0;
        int initialized = 0;
        int upToDate = 0;
        int failed = 0;
        int completionsRecorded = 0;
        List<GameResult> results = new ArrayList<>();
        for (UserGame copy : linkedCopies) {
            String title = copy.getUserContent().getContent().getTitle();
            OpenXblTitle xboxTitle = titlesById.get(copy.getXboxTitleId());
            XboxGameProgress stored = progressByCopyId.get(copy.getId());
            if (xboxTitle == null) {
                failed++;
                results.add(new GameResult(copy.getId(), copy.getXboxTitleId(), title,
                        Status.FAILED, null, null,
                        "Связанная игра не найдена в истории Xbox-профиля"));
                continue;
            }
            if (isUpToDate(stored, xboxTitle.lastPlayedAt())) {
                upToDate++;
                results.add(new GameResult(copy.getId(), copy.getXboxTitleId(), title,
                        Status.UP_TO_DATE, stored.getUnlockedAchievements(),
                        stored.getTotalAchievements(), null));
                continue;
            }
            try {
                XboxProgressSyncResponse synchronizedProgress = progressSync.sync(copy.getId(), history);
                if (stored == null) {
                    initialized++;
                } else {
                    updated++;
                }
                if (synchronizedProgress.completionRecorded()) completionsRecorded++;
                results.add(new GameResult(copy.getId(), copy.getXboxTitleId(), title,
                        stored == null ? Status.INITIALIZED : Status.UPDATED,
                        synchronizedProgress.progress().unlockedAchievements(),
                        synchronizedProgress.progress().totalAchievements(), null));
            } catch (RuntimeException exception) {
                failed++;
                results.add(new GameResult(copy.getId(), copy.getXboxTitleId(), title,
                        Status.FAILED, null, null, errorMessage(exception)));
            }
        }
        return new XboxBulkSyncResponse(xboxCopies.size(), linkedCopies.size(),
                updated, initialized, upToDate, xboxCopies.size() - linkedCopies.size(),
                failed, completionsRecorded, playtimeUpdated, playtimeUnavailable,
                playthroughPlaytimeUpdated, playtimeSyncFailed, List.copyOf(results));
    }

    private boolean isUpToDate(XboxGameProgress stored, Instant lastPlayedAt) {
        return stored != null && lastPlayedAt != null
                && !stored.getLastUpdatedAt().isBefore(lastPlayedAt);
    }

    private String errorMessage(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank()
                ? "Не удалось обновить достижения" : message;
    }
}
