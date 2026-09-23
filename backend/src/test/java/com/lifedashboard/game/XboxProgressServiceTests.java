package com.lifedashboard.game;

import com.lifedashboard.game.dto.XboxProgressRequest;
import com.lifedashboard.game.openxbl.OpenXblClient;
import com.lifedashboard.game.openxbl.OpenXblTitle;
import com.lifedashboard.game.openxbl.OpenXblTitleHistory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class XboxProgressServiceTests {
    @Mock XboxGameProgressRepository progress;
    @Mock XboxAchievementRepository achievements;
    @Mock UserGameRepository games;
    @Mock XboxAchievementGroupService achievementGroups;
    @Mock OpenXblClient openXbl;

    @Test
    void initializesEmptyBaseProgressFromTitleHistoryWithoutEarnedValues() {
        UserGame game = xboxGame(1805523441L);
        OpenXblTitle title = new OpenXblTitle(1805523441L, "Call of the Elder Gods",
                List.of("XboxSeries"), 31, 31, 1000, 1000, 2,
                Instant.parse("2026-09-23T12:00:00Z"));
        when(games.findByIdAndUserContentUserId(15L, 1L)).thenReturn(Optional.of(game));
        when(progress.findByLibraryEntryId(15L)).thenReturn(Optional.empty());
        when(openXbl.titleHistory()).thenReturn(
                new OpenXblTitleHistory("xuid", List.of(title)));

        service().initializeFromTitleHistory(15L);

        verify(achievementGroups).putBase(game,
                new XboxProgressRequest(31, 0, 1000, 0));
    }

    @Test
    void keepsExistingProgressWithoutCallingOpenXbl() {
        UserGame game = xboxGame(1805523441L);
        when(games.findByIdAndUserContentUserId(15L, 1L)).thenReturn(Optional.of(game));
        when(progress.findByLibraryEntryId(15L))
                .thenReturn(Optional.of(mock(XboxGameProgress.class)));

        service().initializeFromTitleHistory(15L);

        verify(openXbl, never()).titleHistory();
        verify(achievementGroups, never()).putBase(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    private XboxProgressService service() {
        return new XboxProgressService(progress, achievements, games,
                achievementGroups, openXbl, 1L);
    }

    private UserGame xboxGame(long titleId) {
        UserGame game = mock(UserGame.class);
        GamingPlatform platform = mock(GamingPlatform.class);
        lenient().when(game.getXboxTitleId()).thenReturn(titleId);
        when(game.getPlatform()).thenReturn(platform);
        when(platform.getCode()).thenReturn("XBOX_SERIES");
        return game;
    }
}
