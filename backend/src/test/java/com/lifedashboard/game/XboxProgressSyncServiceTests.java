package com.lifedashboard.game;

import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.UserContent;
import com.lifedashboard.game.dto.XboxProgressSyncResponse;
import com.lifedashboard.game.openxbl.OpenXblClient;
import com.lifedashboard.game.openxbl.OpenXblAchievement;
import com.lifedashboard.game.openxbl.OpenXblProgress;
import com.lifedashboard.game.openxbl.OpenXblTitle;
import com.lifedashboard.game.openxbl.OpenXblTitleHistory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class XboxProgressSyncServiceTests {
    @Mock UserGameRepository games;
    @Mock XboxGameProgressRepository progress;
    @Mock XboxAchievementRepository achievements;
    @Mock XboxAchievementGroupRepository groups;
    @Mock XboxAchievementGroupService achievementGroups;
    @Mock GamePlaythroughService playthroughs;
    @Mock OpenXblClient openXbl;

    @Test
    void linksAndSynchronizesModernXboxGame() {
        UserGame game = game("Planet of Lana", "XBOX_SERIES");
        OpenXblTitle title = new OpenXblTitle(2117095676L, "Planet of Lana",
                List.of("PC", "XboxSeries"), 25, 0, 1000, 1000, 2, null);
        Instant lastUnlocked = Instant.parse("2026-05-16T00:31:04.903Z");
        XboxGameProgress stored = storedProgress(game, 25, 25, 1000, 1000);
        when(games.findByIdAndUserContentUserId(7L, 1L)).thenReturn(Optional.of(game));
        when(openXbl.titleHistory()).thenReturn(new OpenXblTitleHistory("xuid", List.of(title)));
        when(openXbl.progress("xuid", title)).thenReturn(
                new OpenXblProgress(title.titleId(), 25, 25, 1000, 1000, lastUnlocked, true,
                        List.of(new OpenXblAchievement("1", "Story complete", "Finish the story",
                                "Locked", "https://images.example/achievement.png", 100,
                                false, true, lastUnlocked))));
        when(groups.findAllByLibraryEntryIdOrderByGroupTypeAscIdAsc(7L)).thenReturn(List.of());
        when(progress.findByLibraryEntryId(7L)).thenReturn(Optional.of(stored));
        when(progress.save(stored)).thenReturn(stored);
        when(playthroughs.recordXboxAchievementCompletion(game, lastUnlocked)).thenReturn(true);

        XboxProgressSyncResponse result = service().sync(7L);

        assertEquals(2117095676L, result.xboxTitleId());
        assertTrue(result.exactAchievementDetails());
        assertTrue(result.completionRecorded());
        assertFalse(result.manualDlcGroupsPreserved());
        verify(game).linkXboxTitle(2117095676L);
        verify(achievementGroups).putBase(game, new com.lifedashboard.game.dto.XboxProgressRequest(
                25, 25, 1000, 1000));
        verify(achievements).saveAll(any());
    }

    @Test
    void keepsManualDlcGroupsForXbox360Game() {
        UserGame game = game("Deus Ex: Human Revolution", "XBOX_360");
        OpenXblTitle title = new OpenXblTitle(1397819386L, "DEUS EX®: HUMAN REVOLUTION™",
                List.of("Xbox360", "XboxOne"), 59, 59, 1250, 1250, 1, null);
        XboxAchievementGroup dlc = mock(XboxAchievementGroup.class);
        when(dlc.getGroupType()).thenReturn(XboxAchievementGroupType.DLC);
        XboxGameProgress stored = storedProgress(game, 59, 59, 1250, 1250);
        when(games.findByIdAndUserContentUserId(7L, 1L)).thenReturn(Optional.of(game));
        when(openXbl.titleHistory()).thenReturn(new OpenXblTitleHistory("xuid", List.of(title)));
        when(openXbl.progress("xuid", title)).thenReturn(
                new OpenXblProgress(title.titleId(), 59, 0, 1250, 0, null, false));
        when(groups.findAllByLibraryEntryIdOrderByGroupTypeAscIdAsc(7L)).thenReturn(List.of(dlc));
        when(progress.findByLibraryEntryId(7L)).thenReturn(Optional.of(stored));
        when(progress.save(stored)).thenReturn(stored);

        XboxProgressSyncResponse result = service().sync(7L);

        assertTrue(result.manualDlcGroupsPreserved());
        assertFalse(result.exactAchievementDetails());
        assertEquals(59, result.progress().unlockedAchievements());
        assertEquals(1250, result.progress().earnedGamerscore());
        verify(achievementGroups).recalculate(game);
        verify(progress).save(stored);
        verify(achievementGroups, never()).putBase(any(), any());
        verify(playthroughs, never()).recordXboxAchievementCompletion(any(), any());
        verify(stored).update(eq(59), eq(59), eq(1250), eq(1250),
                isNull(), any(Instant.class));
    }

    private UserGame game(String title, String platformCode) {
        UserGame game = mock(UserGame.class);
        GamingPlatform platform = mock(GamingPlatform.class);
        UserContent userContent = mock(UserContent.class);
        ContentItem content = mock(ContentItem.class);
        when(game.getId()).thenReturn(7L);
        when(game.getXboxTitleId()).thenReturn(null);
        when(game.getPlatform()).thenReturn(platform);
        when(platform.getCode()).thenReturn(platformCode);
        when(game.getUserContent()).thenReturn(userContent);
        when(userContent.getContent()).thenReturn(content);
        when(content.getTitle()).thenReturn(title);
        return game;
    }

    private XboxGameProgress storedProgress(UserGame game, int total, int unlocked,
            int totalScore, int earnedScore) {
        XboxGameProgress stored = mock(XboxGameProgress.class);
        when(stored.getId()).thenReturn(3L);
        when(stored.getLibraryEntry()).thenReturn(game);
        when(stored.getTotalAchievements()).thenReturn(total);
        when(stored.getUnlockedAchievements()).thenReturn(unlocked);
        when(stored.getTotalGamerscore()).thenReturn(totalScore);
        when(stored.getEarnedGamerscore()).thenReturn(earnedScore);
        when(stored.getLastUpdatedAt()).thenReturn(Instant.parse("2026-09-04T09:00:00Z"));
        return stored;
    }

    private XboxProgressSyncService service() {
        return new XboxProgressSyncService(games, progress, achievements, groups, achievementGroups,
                playthroughs, openXbl, 1L);
    }
}
