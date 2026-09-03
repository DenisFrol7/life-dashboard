package com.lifedashboard.game;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GamePlaythroughServiceTests {
    @Mock GamePlaythroughRepository playthroughs;
    @Mock GameSessionRepository sessions;
    @Mock UserGameRepository games;

    @Test
    void recordsSteamCompletionWithLastAchievementDateAndPlaytime() {
        UserGame game = org.mockito.Mockito.mock(UserGame.class);
        when(game.getId()).thenReturn(7L);
        when(game.getLegacyPlaytimeMinutes()).thenReturn(120L);
        when(playthroughs.existsByLibraryEntryId(7L)).thenReturn(false);
        when(playthroughs.maxNumber(7L)).thenReturn(0);
        when(sessions.totalMinutes(7L, 1L)).thenReturn(30L);
        Instant completedAt = Instant.parse("2024-05-01T10:15:30Z");

        boolean created = service().recordSteamAchievementCompletion(game, completedAt);

        assertTrue(created);
        ArgumentCaptor<GamePlaythrough> saved = ArgumentCaptor.forClass(GamePlaythrough.class);
        verify(playthroughs).save(saved.capture());
        assertEquals(1, saved.getValue().getPlaythroughNumber());
        assertEquals(completedAt, saved.getValue().getCompletedAt());
        assertEquals(150L, saved.getValue().getPlaytimeMinutes());
        assertEquals(GamePlaythroughSource.STEAM_ACHIEVEMENTS,
                saved.getValue().getCompletionSource());
        verify(game).markCompleted(completedAt);
    }

    @Test
    void preservesExistingManualHistoryWithoutCreatingDuplicate() {
        UserGame game = org.mockito.Mockito.mock(UserGame.class);
        when(game.getId()).thenReturn(7L);
        when(playthroughs.existsByLibraryEntryId(7L)).thenReturn(true);

        boolean created = service().recordSteamAchievementCompletion(game, Instant.now());

        assertFalse(created);
        verify(playthroughs, never()).save(org.mockito.ArgumentMatchers.any());
        verify(game, never()).markCompleted(org.mockito.ArgumentMatchers.any());
        verifyNoInteractions(sessions);
    }

    private GamePlaythroughService service() {
        return new GamePlaythroughService(playthroughs, sessions, games, 1L);
    }
}
