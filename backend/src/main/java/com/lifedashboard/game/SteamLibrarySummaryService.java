package com.lifedashboard.game;

import com.lifedashboard.game.dto.SteamLibrarySummaryResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class SteamLibrarySummaryService {
    private final SteamGameProgressRepository progressRepository;
    private final long userId;

    public SteamLibrarySummaryService(SteamGameProgressRepository progressRepository,
            @Value("${app.default-user-id}") long userId) {
        this.progressRepository = progressRepository;
        this.userId = userId;
    }

    public List<SteamLibrarySummaryResponse> getAll() {
        return progressRepository.findAllByUserId(userId).stream()
                .map(this::response)
                .toList();
    }

    private SteamLibrarySummaryResponse response(SteamGameProgress progress) {
        UserGame copy = progress.getLibraryEntry();
        return new SteamLibrarySummaryResponse(copy.getId(), copy.getSteamAppId(),
                progress.getTotalAchievements(), progress.getUnlockedAchievements(),
                percent(progress.getUnlockedAchievements(), progress.getTotalAchievements()),
                progress.getLastUnlockedAt(), progress.getLastSyncedAt());
    }

    private double percent(int value, int total) {
        return total == 0 ? 0.0 : Math.round(value * 10000.0 / total) / 100.0;
    }
}
