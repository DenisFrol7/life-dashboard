package com.lifedashboard.game;

import com.lifedashboard.game.dto.SteamLibrarySummaryResponse;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SteamLibrarySummaryServiceTests {
    @Test
    void returnsStoredProgressWithoutLoadingAchievementRows() {
        SteamGameProgress progress = mock(SteamGameProgress.class);
        UserGame copy = mock(UserGame.class);
        SteamGameProgressRepository repository = mock(SteamGameProgressRepository.class);
        Instant lastUnlockedAt = Instant.parse("2026-08-10T12:00:00Z");
        Instant lastSyncedAt = Instant.parse("2026-09-04T12:00:00Z");
        when(repository.findAllByUserId(1L)).thenReturn(List.of(progress));
        when(progress.getLibraryEntry()).thenReturn(copy);
        when(copy.getId()).thenReturn(15L);
        when(copy.getSteamAppId()).thenReturn(620L);
        when(progress.getTotalAchievements()).thenReturn(12);
        when(progress.getUnlockedAchievements()).thenReturn(5);
        when(progress.getLastUnlockedAt()).thenReturn(lastUnlockedAt);
        when(progress.getLastSyncedAt()).thenReturn(lastSyncedAt);

        List<SteamLibrarySummaryResponse> result =
                new SteamLibrarySummaryService(repository, 1L).getAll();

        assertEquals(1, result.size());
        assertEquals(15L, result.getFirst().libraryEntryId());
        assertEquals(620L, result.getFirst().steamAppId());
        assertEquals(5, result.getFirst().unlockedAchievements());
        assertEquals(12, result.getFirst().totalAchievements());
        assertEquals(41.67, result.getFirst().achievementPercent());
        assertEquals(lastUnlockedAt, result.getFirst().lastUnlockedAt());
        assertEquals(lastSyncedAt, result.getFirst().lastSyncedAt());
    }
}
