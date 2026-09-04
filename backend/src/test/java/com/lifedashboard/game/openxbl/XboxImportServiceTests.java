package com.lifedashboard.game.openxbl;

import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.ContentItemRepository;
import com.lifedashboard.content.UserContent;
import com.lifedashboard.content.UserContentRepository;
import com.lifedashboard.data.DataTransferService;
import com.lifedashboard.game.GameAccessType;
import com.lifedashboard.game.GameSource;
import com.lifedashboard.game.GameSourceRepository;
import com.lifedashboard.game.GamingPlatform;
import com.lifedashboard.game.GamingPlatformRepository;
import com.lifedashboard.game.UserGame;
import com.lifedashboard.game.UserGameRepository;
import com.lifedashboard.game.rawg.RawgClient;
import com.lifedashboard.game.steamgriddb.SteamGridDbCoverCandidate;
import com.lifedashboard.game.steamgriddb.SteamGridDbGameCandidate;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class XboxImportServiceTests {
    @Mock XboxImportPreviewService previewService;
    @Mock ContentItemRepository contentItems;
    @Mock UserContentRepository userContent;
    @Mock UserGameRepository library;
    @Mock GamingPlatformRepository platforms;
    @Mock GameSourceRepository sources;
    @Mock UserRepository users;
    @Mock XboxGameMetadataResolver metadataResolver;
    @Mock DataTransferService dataTransfer;

    @Test
    void backsUpAndImportsSelectedGamesWithChosenSources() {
        ContentItem existingContent = mock(ContentItem.class);
        when(existingContent.getId()).thenReturn(10L);
        UserContent existingEntry = mock(UserContent.class);
        UserGame existingCopy = mock(UserGame.class);
        GamingPlatform series = mock(GamingPlatform.class);
        GamingPlatform xbox360 = mock(GamingPlatform.class);
        GameSource xboxStore = mock(GameSource.class);
        GameSource gamePass = mock(GameSource.class);
        User user = mock(User.class);
        List<XboxImportPreviewItem> rows = List.of(
                row(1L, "Already", "XBOX_SERIES", XboxImportMatch.ALREADY_IMPORTED, 10L, 77L),
                row(2L, "Matched", "XBOX_SERIES", XboxImportMatch.MATCHED, 10L, null),
                row(3L, "New game", "XBOX_360", XboxImportMatch.NEW, null, null));
        when(previewService.preview()).thenReturn(new XboxImportPreview(
                3, 1, 1, 0, 1, rows));
        when(dataTransfer.createAutomaticBackup()).thenReturn(Path.of("backup.json"));
        when(users.findById(1L)).thenReturn(Optional.of(user));
        when(library.findByIdAndUserContentUserId(77L, 1L)).thenReturn(Optional.of(existingCopy));
        when(existingCopy.getXboxTitleId()).thenReturn(null);
        when(library.findByXboxTitleIdAndUserContentUserId(2L, 1L)).thenReturn(Optional.empty());
        when(library.findByXboxTitleIdAndUserContentUserId(3L, 1L)).thenReturn(Optional.empty());
        when(contentItems.findById(10L)).thenReturn(Optional.of(existingContent));
        when(platforms.findByCode("XBOX_SERIES")).thenReturn(Optional.of(series));
        when(platforms.findByCode("XBOX_360")).thenReturn(Optional.of(xbox360));
        when(sources.findByCode("GAME_PASS")).thenReturn(Optional.of(gamePass));
        when(sources.findByCode("XBOX_STORE")).thenReturn(Optional.of(xboxStore));
        when(userContent.findByUserIdAndContentId(1L, 10L)).thenReturn(Optional.of(existingEntry));
        when(userContent.findByUserIdAndContentId(1L, null)).thenReturn(Optional.empty());
        when(userContent.save(any(UserContent.class))).thenAnswer(invocation -> invocation.getArgument(0));
        RawgClient.GameData rawg = new RawgClient.GameData(300L, "new-game", "New Game",
                null, LocalDate.of(2020, 5, 4), "Description", "rawg-background",
                "Adventure", "Studio", List.of("Xbox 360"), false);
        SteamGridDbGameCandidate artwork = new SteamGridDbGameCandidate(
                400L, "New Game", true, List.of("steam"));
        SteamGridDbCoverCandidate cover = new SteamGridDbCoverCandidate(
                400L, 500L, "vertical-cover", null, 10, null, null);
        when(metadataResolver.resolve(rows.get(2)))
                .thenReturn(new XboxGameMetadata(rawg, artwork, cover));
        when(contentItems.save(any(ContentItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        XboxImportService service = service();
        XboxImportPreparation preparation = service.prepare(
                new XboxImportSelection(List.of(1L, 2L, 3L)));
        XboxImportResult result = service.importSelected(new XboxImportRequest(
                preparation.backupToken(), List.of(
                        new XboxImportGameRequest(1L, "XBOX_STORE"),
                        new XboxImportGameRequest(2L, "GAME_PASS"),
                        new XboxImportGameRequest(3L, "XBOX_STORE"))));

        assertEquals(3, result.requested());
        assertEquals(2, result.imported());
        assertEquals(1, result.catalogCreated());
        assertEquals(1, result.linkedExistingCatalog());
        assertEquals(1, result.skippedAlreadyImported());
        assertEquals(1, result.rawgEnriched());
        assertEquals(1, result.steamGridDbCovers());
        verify(existingCopy).linkXboxTitle(1L);
        ArgumentCaptor<UserGame> copies = ArgumentCaptor.forClass(UserGame.class);
        verify(library, org.mockito.Mockito.times(2)).save(copies.capture());
        assertEquals(List.of(2L, 3L), copies.getAllValues().stream()
                .map(UserGame::getXboxTitleId).toList());
        assertEquals(List.of(GameAccessType.SUBSCRIPTION, GameAccessType.OWNED),
                copies.getAllValues().stream().map(UserGame::getAccessType).toList());
        InOrder backupBeforeWrites = inOrder(dataTransfer, library);
        backupBeforeWrites.verify(dataTransfer).createAutomaticBackup();
        backupBeforeWrites.verify(library, org.mockito.Mockito.times(2)).save(any(UserGame.class));
    }

    private XboxImportService service() {
        return new XboxImportService(previewService, contentItems, userContent, library,
                platforms, sources, users, metadataResolver, dataTransfer, 1L);
    }

    private XboxImportPreviewItem row(long titleId, String title, String platform,
            XboxImportMatch match, Long contentId, Long libraryId) {
        return new XboxImportPreviewItem(titleId, title, platform, null,
                "xbox-image", 0, 0, 0, 0, "XBOX_STORE", match,
                contentId, contentId == null ? null : "Existing", libraryId);
    }
}
