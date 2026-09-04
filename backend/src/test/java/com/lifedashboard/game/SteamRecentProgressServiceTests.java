package com.lifedashboard.game;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.game.dto.SteamProgressResponse;
import com.lifedashboard.game.dto.SteamRecentSyncResponse;
import com.lifedashboard.game.steam.SteamClient;
import com.lifedashboard.game.steam.SteamOwnedGame;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SteamRecentProgressServiceTests {
    @Mock SteamClient steam;
    @Mock UserGameRepository gameRepository;
    @Mock SteamGameProgressRepository progressRepository;
    @Mock SteamProgressService progressService;

    @Test
    void updatesOnlyImportedGamesPlayedAfterTheirLastSynchronization() {
        Instant lastPlayed = Instant.parse("2026-09-04T12:00:00Z");
        when(steam.recentlyPlayedGames()).thenReturn(List.of(
                game(620L, "Portal 2", lastPlayed),
                game(227300L, "Euro Truck Simulator 2", lastPlayed.minusSeconds(3600)),
                game(999L, "Not imported", lastPlayed)));
        UserGame portal = libraryCopy(11L, 620L);
        UserGame euroTruck = libraryCopy(12L, 227300L);
        when(gameRepository.findSteamCopies(1L)).thenReturn(List.of(portal, euroTruck));
        when(progressRepository.findByLibraryEntryId(11L)).thenReturn(Optional.empty());
        SteamGameProgress current = mock(SteamGameProgress.class);
        when(current.getLastSyncedAt()).thenReturn(lastPlayed);
        when(current.getUnlockedAchievements()).thenReturn(43);
        when(current.getTotalAchievements()).thenReturn(106);
        when(progressRepository.findByLibraryEntryId(12L)).thenReturn(Optional.of(current));
        when(progressService.sync(11L)).thenReturn(progress(11L, 620L, 51, 51));

        SteamRecentSyncResponse result = service().syncRecent();

        assertEquals(3, result.recentlyPlayed());
        assertEquals(2, result.matchedLibraryCopies());
        assertEquals(1, result.updated());
        assertEquals(1, result.upToDate());
        assertEquals(1, result.notImported());
        assertEquals(0, result.failed());
        assertEquals(SteamRecentSyncResponse.Status.UPDATED, result.games().get(0).status());
        assertEquals(SteamRecentSyncResponse.Status.UP_TO_DATE, result.games().get(1).status());
        verify(progressService).sync(11L);
        verify(progressService, never()).sync(12L);
    }

    @Test
    void continuesWithTheNextGameWhenOneSynchronizationFails() {
        Instant lastPlayed = Instant.parse("2026-09-04T12:00:00Z");
        when(steam.recentlyPlayedGames()).thenReturn(List.of(
                game(10L, "First", lastPlayed), game(20L, "Second", lastPlayed)));
        UserGame first = libraryCopy(1L, 10L);
        UserGame second = libraryCopy(2L, 20L);
        when(gameRepository.findSteamCopies(1L)).thenReturn(List.of(first, second));
        when(progressRepository.findByLibraryEntryId(1L)).thenReturn(Optional.empty());
        when(progressRepository.findByLibraryEntryId(2L)).thenReturn(Optional.empty());
        when(progressService.sync(1L)).thenThrow(new InvalidRequestException("Steam timeout"));
        when(progressService.sync(2L)).thenReturn(progress(2L, 20L, 5, 10));

        SteamRecentSyncResponse result = service().syncRecent();

        assertEquals(1, result.updated());
        assertEquals(1, result.failed());
        assertEquals("Steam timeout", result.games().get(0).message());
        assertEquals(SteamRecentSyncResponse.Status.UPDATED, result.games().get(1).status());
        verify(progressService).sync(2L);
    }

    private SteamRecentProgressService service() {
        return new SteamRecentProgressService(steam, gameRepository, progressRepository,
                progressService, 1L);
    }

    private SteamOwnedGame game(long appId, String title, Instant lastPlayedAt) {
        return new SteamOwnedGame(appId, title, 0, lastPlayedAt, null);
    }

    private UserGame libraryCopy(long id, long appId) {
        UserGame copy = mock(UserGame.class);
        when(copy.getId()).thenReturn(id);
        when(copy.getSteamAppId()).thenReturn(appId);
        return copy;
    }

    private SteamProgressResponse progress(long libraryEntryId, long appId, int unlocked, int total) {
        return new SteamProgressResponse(1L, libraryEntryId, appId, total, unlocked,
                total == 0 ? 0 : unlocked * 100.0 / total, null, Instant.now(), List.of());
    }
}
