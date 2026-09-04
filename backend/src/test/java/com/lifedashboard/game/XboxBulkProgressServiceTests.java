package com.lifedashboard.game;

import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.UserContent;
import com.lifedashboard.game.dto.XboxBulkSyncResponse;
import com.lifedashboard.game.dto.XboxProgressResponse;
import com.lifedashboard.game.dto.XboxProgressSyncResponse;
import com.lifedashboard.game.openxbl.OpenXblClient;
import com.lifedashboard.game.openxbl.OpenXblTitle;
import com.lifedashboard.game.openxbl.OpenXblTitleHistory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class XboxBulkProgressServiceTests {
    @Mock OpenXblClient openXbl;
    @Mock UserGameRepository games;
    @Mock XboxGameProgressRepository progress;
    @Mock XboxProgressSyncService progressSync;

    @Test
    void updatesOnlyChangedLinkedCopiesWithOneSharedHistory() {
        Instant playedAt = Instant.parse("2026-09-03T12:00:00Z");
        OpenXblTitle changedTitle = title(101L, "Changed", playedAt);
        OpenXblTitle currentTitle = title(202L, "Current", playedAt);
        OpenXblTitleHistory history = new OpenXblTitleHistory("xuid",
                List.of(changedTitle, currentTitle));
        UserGame changed = copy(1L, 101L, "Changed");
        UserGame current = copy(2L, 202L, "Current");
        UserGame missing = copy(3L, 303L, "Missing");
        UserGame unlinked = org.mockito.Mockito.mock(UserGame.class);
        when(unlinked.getXboxTitleId()).thenReturn(null);
        XboxGameProgress oldProgress = stored(changed,
                Instant.parse("2026-09-02T12:00:00Z"));
        XboxGameProgress currentProgress = stored(current,
                Instant.parse("2026-09-04T12:00:00Z"));
        when(currentProgress.getUnlockedAchievements()).thenReturn(8);
        when(currentProgress.getTotalAchievements()).thenReturn(10);
        XboxProgressResponse synchronizedProgress = new XboxProgressResponse(
                11L, 1L, 10, 5, 50.0, 1000, 500, 50.0, null,
                Instant.parse("2026-09-04T13:00:00Z"));

        when(openXbl.titleHistory()).thenReturn(history);
        when(games.findXboxCopies(1L)).thenReturn(
                List.of(changed, current, missing, unlinked));
        when(progress.findAllByUserId(1L)).thenReturn(
                List.of(oldProgress, currentProgress));
        when(progressSync.sync(1L, history)).thenReturn(new XboxProgressSyncResponse(
                101L, "Changed", true, false, null, false, synchronizedProgress));

        XboxBulkSyncResponse result = service().syncLinked();

        assertEquals(4, result.totalXboxCopies());
        assertEquals(3, result.linkedCopies());
        assertEquals(1, result.updated());
        assertEquals(1, result.upToDate());
        assertEquals(1, result.skippedUnlinked());
        assertEquals(1, result.failed());
        assertEquals(3, result.games().size());
        verify(openXbl).titleHistory();
        verify(progressSync).sync(1L, history);
        verify(progressSync, never()).sync(2L, history);
        verify(progressSync, never()).sync(3L, history);
    }

    private XboxBulkProgressService service() {
        return new XboxBulkProgressService(openXbl, games, progress, progressSync, 1L);
    }

    private OpenXblTitle title(long id, String name, Instant playedAt) {
        return new OpenXblTitle(id, name, List.of("XboxSeries"),
                5, 10, 500, 1000, 2, playedAt);
    }

    private UserGame copy(long id, Long xboxTitleId, String title) {
        UserGame copy = org.mockito.Mockito.mock(UserGame.class);
        UserContent userContent = org.mockito.Mockito.mock(UserContent.class);
        ContentItem content = org.mockito.Mockito.mock(ContentItem.class);
        when(copy.getId()).thenReturn(id);
        when(copy.getXboxTitleId()).thenReturn(xboxTitleId);
        when(copy.getUserContent()).thenReturn(userContent);
        when(userContent.getContent()).thenReturn(content);
        when(content.getTitle()).thenReturn(title);
        return copy;
    }

    private XboxGameProgress stored(UserGame copy, Instant updatedAt) {
        XboxGameProgress stored = org.mockito.Mockito.mock(XboxGameProgress.class);
        when(stored.getLibraryEntry()).thenReturn(copy);
        when(stored.getLastUpdatedAt()).thenReturn(updatedAt);
        return stored;
    }
}
