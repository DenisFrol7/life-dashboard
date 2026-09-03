package com.lifedashboard.game;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.game.dto.SteamAchievementResponse;
import com.lifedashboard.game.dto.SteamProgressResponse;
import com.lifedashboard.game.steam.SteamAchievementData;
import com.lifedashboard.game.steam.SteamAchievementSnapshot;
import com.lifedashboard.game.steam.SteamClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class SteamProgressService {
    private final SteamGameProgressRepository progressRepository;
    private final SteamAchievementRepository achievementRepository;
    private final UserGameRepository gameRepository;
    private final GamePlaythroughService playthroughService;
    private final SteamClient steam;
    private final long userId;

    public SteamProgressService(SteamGameProgressRepository progressRepository,
            SteamAchievementRepository achievementRepository, UserGameRepository gameRepository,
            GamePlaythroughService playthroughService, SteamClient steam,
            @Value("${app.default-user-id}") long userId) {
        this.progressRepository = progressRepository;
        this.achievementRepository = achievementRepository;
        this.gameRepository = gameRepository;
        this.playthroughService = playthroughService;
        this.steam = steam;
        this.userId = userId;
    }

    public SteamProgressResponse get(Long libraryEntryId) {
        UserGame game = findSteamGame(libraryEntryId);
        SteamGameProgress progress = progressRepository.findByLibraryEntryId(libraryEntryId)
                .orElseThrow(() -> new ResourceNotFoundException("Достижения Steam ещё не синхронизированы"));
        return response(game, progress, achievementRepository.findAllByProgressId(progress.getId()));
    }

    @Transactional
    public SteamProgressResponse sync(Long libraryEntryId) {
        UserGame game = findSteamGame(libraryEntryId);
        SteamAchievementSnapshot snapshot = steam.achievements(game.getSteamAppId());
        SteamGameProgress progress = progressRepository.findByLibraryEntryId(libraryEntryId)
                .orElseGet(() -> new SteamGameProgress(game));
        int unlocked = (int) snapshot.achievements().stream()
                .filter(SteamAchievementData::unlocked).count();
        Instant lastUnlocked = snapshot.achievements().stream()
                .map(SteamAchievementData::unlockedAt)
                .filter(value -> value != null)
                .max(Comparator.naturalOrder()).orElse(null);
        progress.update(snapshot.achievements().size(), unlocked, lastUnlocked, Instant.now());
        progress = progressRepository.saveAndFlush(progress);

        Map<String, SteamAchievement> existing = new HashMap<>();
        for (SteamAchievement achievement : achievementRepository.findAllByProgressId(progress.getId())) {
            existing.put(achievement.getApiName(), achievement);
        }
        List<SteamAchievement> synchronizedAchievements = new ArrayList<>();
        for (SteamAchievementData source : snapshot.achievements()) {
            SteamAchievement achievement = existing.remove(source.apiName());
            if (achievement == null) achievement = new SteamAchievement(progress, source.apiName());
            achievement.update(source);
            synchronizedAchievements.add(achievement);
        }
        achievementRepository.deleteAll(existing.values());
        synchronizedAchievements = achievementRepository.saveAll(synchronizedAchievements);
        if (!snapshot.achievements().isEmpty()
                && unlocked == snapshot.achievements().size()
                && lastUnlocked != null) {
            playthroughService.recordSteamAchievementCompletion(game, lastUnlocked);
        }
        return response(game, progress, synchronizedAchievements);
    }

    private UserGame findSteamGame(Long libraryEntryId) {
        UserGame game = gameRepository.findByIdAndUserContentUserId(libraryEntryId, userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Копия игры с идентификатором " + libraryEntryId + " не найдена"));
        if (!"STEAM".equals(game.getSource().getCode()) || game.getSteamAppId() == null) {
            throw new InvalidRequestException(
                    "Достижения Steam доступны только для импортированной Steam-копии игры");
        }
        return game;
    }

    private SteamProgressResponse response(UserGame game, SteamGameProgress progress,
            List<SteamAchievement> achievements) {
        List<SteamAchievementResponse> rows = achievements.stream()
                .sorted(Comparator.comparing(SteamAchievement::isUnlocked).reversed()
                        .thenComparing(SteamAchievement::getUnlockedAt,
                                Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(SteamAchievement::getDisplayName, String.CASE_INSENSITIVE_ORDER))
                .map(item -> new SteamAchievementResponse(item.getApiName(), item.getDisplayName(),
                        item.getDescription(), item.getIconUrl(), item.getLockedIconUrl(), item.isHidden(),
                        item.isUnlocked(), item.getUnlockedAt()))
                .toList();
        return new SteamProgressResponse(progress.getId(), game.getId(), game.getSteamAppId(),
                progress.getTotalAchievements(), progress.getUnlockedAchievements(),
                percent(progress.getUnlockedAchievements(), progress.getTotalAchievements()),
                progress.getLastUnlockedAt(), progress.getLastSyncedAt(), rows);
    }

    private double percent(int value, int total) {
        return total == 0 ? 0.0 : Math.round(value * 10000.0 / total) / 100.0;
    }
}
