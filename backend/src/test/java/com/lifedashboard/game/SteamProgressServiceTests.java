package com.lifedashboard.game;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.game.dto.SteamProgressResponse;
import com.lifedashboard.game.steam.SteamAchievementData;
import com.lifedashboard.game.steam.SteamAchievementSnapshot;
import com.lifedashboard.game.steam.SteamClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SteamProgressServiceTests {
    @Mock SteamGameProgressRepository progressRepository;
    @Mock SteamAchievementRepository achievementRepository;
    @Mock UserGameRepository gameRepository;
    @Mock GamePlaythroughService playthroughService;
    @Mock SteamClient steam;

    @Test
    void synchronizesAchievementsForTheSelectedSteamCopy() {
        UserGame game = org.mockito.Mockito.mock(UserGame.class);
        GameSource source = org.mockito.Mockito.mock(GameSource.class);
        when(gameRepository.findByIdAndUserContentUserId(7L, 1L)).thenReturn(Optional.of(game));
        when(game.getId()).thenReturn(7L);
        when(game.getSource()).thenReturn(source);
        when(source.getCode()).thenReturn("STEAM");
        when(game.getSteamAppId()).thenReturn(620L);
        Instant unlockedAt = Instant.parse("2024-05-01T10:15:30Z");
        when(steam.achievements(620L)).thenReturn(new SteamAchievementSnapshot(620L, "Portal 2", List.of(
                new SteamAchievementData("LOCKED", "Locked", null, null, null,
                        false, false, null),
                new SteamAchievementData("DONE", "Done", "Completed", "icon", "gray",
                        false, true, unlockedAt))));
        when(progressRepository.findByLibraryEntryId(7L)).thenReturn(Optional.empty());
        when(progressRepository.saveAndFlush(any(SteamGameProgress.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(achievementRepository.findAllByProgressId(null)).thenReturn(List.of());
        when(achievementRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        SteamProgressResponse result = service().sync(7L);

        assertEquals(620L, result.steamAppId());
        assertEquals(2, result.totalAchievements());
        assertEquals(1, result.unlockedAchievements());
        assertEquals(50.0, result.achievementPercent());
        assertEquals(unlockedAt, result.lastUnlockedAt());
        assertEquals("DONE", result.achievements().get(0).apiName());
        assertEquals("LOCKED", result.achievements().get(1).apiName());
        assertNull(result.achievements().get(1).unlockedAt());
        verify(progressRepository).saveAndFlush(any(SteamGameProgress.class));
        verify(achievementRepository).saveAll(anyList());
        verify(playthroughService, never()).recordSteamAchievementCompletion(any(), any());
    }

    @Test
    void recordsPlaythroughAtLastAchievementWhenAllAreUnlocked() {
        UserGame game = org.mockito.Mockito.mock(UserGame.class);
        GameSource source = org.mockito.Mockito.mock(GameSource.class);
        when(gameRepository.findByIdAndUserContentUserId(7L, 1L)).thenReturn(Optional.of(game));
        when(game.getId()).thenReturn(7L);
        when(game.getSource()).thenReturn(source);
        when(source.getCode()).thenReturn("STEAM");
        when(game.getSteamAppId()).thenReturn(620L);
        Instant firstUnlockedAt = Instant.parse("2024-04-01T10:15:30Z");
        Instant lastUnlockedAt = Instant.parse("2024-05-01T10:15:30Z");
        when(steam.achievements(620L)).thenReturn(new SteamAchievementSnapshot(620L, "Portal 2", List.of(
                new SteamAchievementData("FIRST", "First", null, null, null,
                        false, true, firstUnlockedAt),
                new SteamAchievementData("LAST", "Last", null, null, null,
                        false, true, lastUnlockedAt))));
        when(progressRepository.findByLibraryEntryId(7L)).thenReturn(Optional.empty());
        when(progressRepository.saveAndFlush(any(SteamGameProgress.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(achievementRepository.findAllByProgressId(null)).thenReturn(List.of());
        when(achievementRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        SteamProgressResponse result = service().sync(7L);

        assertEquals(100.0, result.achievementPercent());
        verify(playthroughService).recordSteamAchievementCompletion(game, lastUnlockedAt);
    }

    @Test
    void refusesCopyWithoutSteamLink() {
        UserGame game = org.mockito.Mockito.mock(UserGame.class);
        GameSource source = org.mockito.Mockito.mock(GameSource.class);
        when(gameRepository.findByIdAndUserContentUserId(7L, 1L)).thenReturn(Optional.of(game));
        when(game.getSource()).thenReturn(source);
        when(source.getCode()).thenReturn("STEAM");
        when(game.getSteamAppId()).thenReturn(null);

        assertThrows(InvalidRequestException.class, () -> service().sync(7L));

        verifyNoInteractions(steam, progressRepository, achievementRepository, playthroughService);
    }

    private SteamProgressService service() {
        return new SteamProgressService(progressRepository, achievementRepository,
                gameRepository, playthroughService, steam, 1L);
    }
}
