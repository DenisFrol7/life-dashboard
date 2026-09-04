package com.lifedashboard.game.openxbl;

import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.ContentItemRepository;
import com.lifedashboard.content.ContentType;
import com.lifedashboard.content.UserContent;
import com.lifedashboard.game.GamingPlatform;
import com.lifedashboard.game.UserGame;
import com.lifedashboard.game.UserGameRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class XboxImportPreviewServiceTests {
    @Mock OpenXblClient openXbl;
    @Mock ContentItemRepository contentItems;
    @Mock UserGameRepository library;

    @Test
    void classifiesConsoleGamesAndDeterminesTheirPlatforms() {
        ContentItem portal = content(10L, "Portal 2");
        ContentItem linkedContent = content(11L, "Linked");
        UserGame linked = copy(77L, 100L, linkedContent, "XBOX_SERIES");
        when(contentItems.findAllByItemTypeOrderByTitleAsc(ContentType.GAME))
                .thenReturn(List.of(portal, linkedContent));
        when(library.findLibrary(1L, null, null)).thenReturn(List.of(linked));
        when(openXbl.titleHistory()).thenReturn(new OpenXblTitleHistory("xuid", List.of(
                title(100L, "Linked", List.of("PC", "XboxSeries"), "Application", false),
                title(200L, "Portal® 2™", List.of("XboxOne", "XboxSeries"), "Application", true),
                title(300L, "Legacy", List.of("Xbox360", "XboxOne"), "XboxArcadeGame", false),
                title(400L, "PC only", List.of("Win32"), "Application", false))));

        XboxImportPreview result = service().preview();

        assertEquals(3, result.totalGames());
        assertEquals(1, result.alreadyImported());
        assertEquals(1, result.matchedExisting());
        assertEquals(1, result.newGames());
        assertEquals("XBOX_SERIES", find(result, 200L).platformCode());
        assertEquals("GAME_PASS", find(result, 200L).suggestedSourceCode());
        assertEquals("XBOX_360", find(result, 300L).platformCode());
    }

    private XboxImportPreviewService service() {
        return new XboxImportPreviewService(openXbl, contentItems, library, 1L);
    }

    private XboxImportPreviewItem find(XboxImportPreview preview, long titleId) {
        return preview.games().stream().filter(item -> item.titleId() == titleId)
                .findFirst().orElseThrow();
    }

    private OpenXblTitle title(long id, String name, List<String> devices,
            String mediaType, boolean gamePass) {
        return new OpenXblTitle(id, name, devices, 5, 10, 500, 1000, 2,
                Instant.parse("2026-01-01T00:00:00Z"), mediaType,
                "https://example.com/" + id + ".jpg", gamePass);
    }

    private ContentItem content(long id, String title) {
        ContentItem item = mock(ContentItem.class);
        when(item.getId()).thenReturn(id);
        when(item.getTitle()).thenReturn(title);
        return item;
    }

    private UserGame copy(long id, long titleId, ContentItem content, String platformCode) {
        UserGame copy = mock(UserGame.class);
        UserContent userContent = mock(UserContent.class);
        GamingPlatform platform = mock(GamingPlatform.class);
        when(copy.getId()).thenReturn(id);
        when(copy.getXboxTitleId()).thenReturn(titleId);
        when(copy.getUserContent()).thenReturn(userContent);
        when(userContent.getContent()).thenReturn(content);
        when(copy.getPlatform()).thenReturn(platform);
        when(platform.getCode()).thenReturn(platformCode);
        return copy;
    }
}
