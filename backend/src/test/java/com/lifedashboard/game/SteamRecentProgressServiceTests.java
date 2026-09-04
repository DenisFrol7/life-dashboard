package com.lifedashboard.game;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.UserContent;
import com.lifedashboard.game.dto.SteamProgressResponse;
import com.lifedashboard.game.dto.SteamRecentSyncResponse;
import com.lifedashboard.game.steam.SteamClient;
import com.lifedashboard.game.steam.SteamOwnedGame;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

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
        SteamGameProgress current = mock(SteamGameProgress.class);
        when(current.getLibraryEntry()).thenReturn(euroTruck);
        when(current.getLastSyncedAt()).thenReturn(lastPlayed);
        when(current.getUnlockedAchievements()).thenReturn(43);
        when(current.getTotalAchievements()).thenReturn(106);
        when(progressRepository.findAllByLibraryEntryIdIn(List.of(11L, 12L)))
                .thenReturn(List.of(current));
        when(progressService.sync(11L)).thenReturn(progress(11L, 620L, 51, 51));

        SteamRecentSyncResponse result = service().syncRecent();

        assertEquals(3, result.recentlyPlayed());
        assertEquals(2, result.matchedLibraryCopies());
        assertEquals(0, result.updated());
        assertEquals(1, result.upToDate());
        assertEquals(1, result.initiallySynced());
        assertEquals(0, result.remainingUnsynced());
        assertEquals(1, result.notImported());
        assertEquals(0, result.failed());
        assertEquals(SteamRecentSyncResponse.Status.INITIALIZED, result.games().get(0).status());
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
        when(progressRepository.findAllByLibraryEntryIdIn(List.of(1L, 2L)))
                .thenReturn(List.of());
        when(progressService.sync(1L)).thenThrow(new InvalidRequestException("Steam timeout"));
        when(progressService.sync(2L)).thenReturn(progress(2L, 20L, 5, 10));

        SteamRecentSyncResponse result = service().syncRecent();

        assertEquals(0, result.updated());
        assertEquals(1, result.initiallySynced());
        assertEquals(1, result.remainingUnsynced());
        assertEquals(1, result.failed());
        assertEquals("Steam timeout", result.games().get(0).message());
        assertEquals(SteamRecentSyncResponse.Status.INITIALIZED, result.games().get(1).status());
        verify(progressService).sync(2L);
    }

    @Test
    void initializesAtMostTenOlderGamesPerRun() {
        when(steam.recentlyPlayedGames()).thenReturn(List.of());
        List<UserGame> copies = new ArrayList<>();
        for (long id = 1; id <= 12; id++) {
            UserGame copy = libraryCopy(id, 1000L + id);
            if (id <= 10) {
                withTitle(copy, "Game " + id);
                when(progressService.sync(id)).thenReturn(progress(id, 1000L + id, 0, 10));
            }
            copies.add(copy);
        }
        when(gameRepository.findSteamCopies(1L)).thenReturn(copies);
        when(progressRepository.findAllByLibraryEntryIdIn(
                List.of(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L, 11L, 12L)))
                .thenReturn(List.of());

        SteamRecentSyncResponse result = service().syncRecent();

        assertEquals(10, result.initiallySynced());
        assertEquals(2, result.remainingUnsynced());
        assertEquals(10, result.games().size());
        verify(progressService, never()).sync(11L);
        verify(progressService, never()).sync(12L);
    }

    @Test
    void updatesPlaytimeForAnImportedRecentlyPlayedGame() {
        Instant lastPlayed = Instant.parse("2026-09-04T12:00:00Z");
        when(steam.recentlyPlayedGames()).thenReturn(List.of(
                new SteamOwnedGame(620L, "Portal 2", 480, lastPlayed, null)));
        UserGame copy = libraryCopy(15L, 620L);
        when(copy.getLegacyPlaytimeMinutes()).thenReturn(120L);
        when(gameRepository.findSteamCopies(1L)).thenReturn(List.of(copy));
        SteamGameProgress current = mock(SteamGameProgress.class);
        when(current.getLibraryEntry()).thenReturn(copy);
        when(current.getLastSyncedAt()).thenReturn(lastPlayed);
        when(progressRepository.findAllByLibraryEntryIdIn(List.of(15L)))
                .thenReturn(List.of(current));
        when(gameRepository.updateSteamPlaytime(15L, 1L, 480L)).thenReturn(1);

        SteamRecentSyncResponse result = service().syncRecent();

        assertEquals(1, result.playtimeUpdated());
        assertEquals(1, result.upToDate());
        verify(gameRepository).updateSteamPlaytime(15L, 1L, 480L);
        verify(progressService, never()).sync(15L);
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

    private void withTitle(UserGame copy, String title) {
        UserContent userContent = mock(UserContent.class);
        ContentItem content = mock(ContentItem.class);
        when(copy.getUserContent()).thenReturn(userContent);
        when(userContent.getContent()).thenReturn(content);
        when(content.getTitle()).thenReturn(title);
    }

    private SteamProgressResponse progress(long libraryEntryId, long appId, int unlocked, int total) {
        return new SteamProgressResponse(1L, libraryEntryId, appId, total, unlocked,
                total == 0 ? 0 : unlocked * 100.0 / total, null, Instant.now(), List.of());
    }
}
