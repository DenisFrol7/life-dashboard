package com.lifedashboard.game.steam;

import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.ContentItemRepository;
import com.lifedashboard.content.ContentType;
import com.lifedashboard.content.UserContent;
import com.lifedashboard.game.GameSource;
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
class SteamImportPreviewServiceTests {
    @Mock SteamClient steam;
    @Mock ContentItemRepository contentItems;
    @Mock UserGameRepository library;

    @Test
    void classifiesExactPossibleAndNewGames() {
        ContentItem portal = content(10L, "Portal 2");
        when(contentItems.findAllByItemTypeOrderByTitleAsc(ContentType.GAME)).thenReturn(List.of(portal));
        when(library.findLibrary(1L, null, null)).thenReturn(List.of());
        when(steam.library()).thenReturn(new SteamLibrary("Player", List.of(
                game(620L, "Portal 2"),
                game(621L, "Portal 2 Definitive Edition"),
                game(622L, "Half-Life 2"))));

        SteamImportPreview result = service().preview();

        assertEquals(3, result.totalGames());
        assertEquals(1, result.matchedExisting());
        assertEquals(1, result.reviewRequired());
        assertEquals(1, result.newGames());
        assertEquals(SteamImportMatch.MATCHED, find(result, 620L).match());
        assertEquals(SteamImportMatch.REVIEW, find(result, 621L).match());
        assertEquals(SteamImportMatch.NEW, find(result, 622L).match());
    }

    @Test
    void recognizesAStoredSteamAppId() {
        ContentItem portal = content(10L, "Portal 2");
        UserGame copy = copy(77L, 620L, portal, "STEAM");
        when(contentItems.findAllByItemTypeOrderByTitleAsc(ContentType.GAME)).thenReturn(List.of(portal));
        when(library.findLibrary(1L, null, null)).thenReturn(List.of(copy));
        when(steam.library()).thenReturn(new SteamLibrary("Player", List.of(game(620L, "Portal 2"))));

        SteamImportPreview result = service().preview();

        assertEquals(1, result.alreadyImported());
        assertEquals(77L, result.games().getFirst().matchedLibraryEntryId());
    }

    @Test
    void recognizesAnExistingSteamCopyByExactTitleBeforeItHasAnAppId() {
        ContentItem portal = content(10L, "Portal 2");
        UserGame copy = copy(77L, null, portal, "STEAM");
        when(contentItems.findAllByItemTypeOrderByTitleAsc(ContentType.GAME)).thenReturn(List.of(portal));
        when(library.findLibrary(1L, null, null)).thenReturn(List.of(copy));
        when(steam.library()).thenReturn(new SteamLibrary("Player", List.of(game(620L, "Portal 2"))));

        assertEquals(SteamImportMatch.ALREADY_IMPORTED, service().preview().games().getFirst().match());
    }

    @Test
    void doesNotSuggestDifferentSequelsAsTheSameGame() {
        ContentItem forza = mock(ContentItem.class);
        ContentItem mafiaTwo = mock(ContentItem.class);
        when(forza.getTitle()).thenReturn("Forza Horizon");
        when(mafiaTwo.getTitle()).thenReturn("Mafia II: Definitive Edition");
        when(contentItems.findAllByItemTypeOrderByTitleAsc(ContentType.GAME))
                .thenReturn(List.of(forza, mafiaTwo));
        when(library.findLibrary(1L, null, null)).thenReturn(List.of());
        when(steam.library()).thenReturn(new SteamLibrary("Player", List.of(
                game(1L, "Forza Horizon 4"),
                game(2L, "Mafia: Definitive Edition"))));

        SteamImportPreview result = service().preview();

        assertEquals(2, result.newGames());
        assertEquals(0, result.reviewRequired());
    }

    private SteamImportPreviewService service() {
        return new SteamImportPreviewService(steam, contentItems, library, 1L);
    }

    private SteamImportPreviewItem find(SteamImportPreview preview, long appId) {
        return preview.games().stream().filter(item -> item.appId() == appId).findFirst().orElseThrow();
    }

    private SteamOwnedGame game(long appId, String title) {
        return new SteamOwnedGame(appId, title, 120, Instant.parse("2025-01-01T00:00:00Z"), null);
    }

    private ContentItem content(long id, String title) {
        ContentItem item = mock(ContentItem.class);
        when(item.getId()).thenReturn(id);
        when(item.getTitle()).thenReturn(title);
        return item;
    }

    private UserGame copy(long id, Long steamAppId, ContentItem content, String sourceCode) {
        UserGame copy = mock(UserGame.class);
        UserContent userContent = mock(UserContent.class);
        GameSource source = mock(GameSource.class);
        when(copy.getId()).thenReturn(id);
        when(copy.getSteamAppId()).thenReturn(steamAppId);
        when(copy.getUserContent()).thenReturn(userContent);
        when(userContent.getContent()).thenReturn(content);
        if (steamAppId == null) {
            when(copy.getSource()).thenReturn(source);
            when(source.getCode()).thenReturn(sourceCode);
        }
        return copy;
    }
}
