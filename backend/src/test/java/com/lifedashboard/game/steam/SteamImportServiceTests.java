package com.lifedashboard.game.steam;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.ContentItemRepository;
import com.lifedashboard.content.UserContent;
import com.lifedashboard.content.UserContentRepository;
import com.lifedashboard.data.DataTransferService;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SteamImportServiceTests {
    @Mock SteamImportPreviewService previewService;
    @Mock ContentItemRepository contentItems;
    @Mock UserContentRepository userContent;
    @Mock UserGameRepository library;
    @Mock GamingPlatformRepository platforms;
    @Mock GameSourceRepository sources;
    @Mock UserRepository users;
    @Mock SteamGameMetadataResolver metadataResolver;
    @Mock DataTransferService dataTransfer;

    @Test
    void importsSelectedGamesLinksCatalogAndSkipsExistingCopy() {
        ContentItem existingContent = mock(ContentItem.class);
        when(existingContent.getId()).thenReturn(10L);
        UserContent existingEntry = mock(UserContent.class);
        UserGame existingCopy = mock(UserGame.class);
        GamingPlatform pc = mock(GamingPlatform.class);
        GameSource steam = mock(GameSource.class);
        User user = mock(User.class);

        when(previewService.preview()).thenReturn(preview(List.of(
                row(1L, "Already", 30, SteamImportMatch.ALREADY_IMPORTED, 10L, 77L),
                row(2L, "Matched", 120, SteamImportMatch.MATCHED, 10L, null),
                row(3L, "New game", 240, SteamImportMatch.NEW, null, null))));
        when(platforms.findByCode("PC")).thenReturn(Optional.of(pc));
        when(sources.findByCode("STEAM")).thenReturn(Optional.of(steam));
        when(users.findById(1L)).thenReturn(Optional.of(user));
        when(library.findByIdAndUserContentUserId(77L, 1L)).thenReturn(Optional.of(existingCopy));
        when(existingCopy.getSteamAppId()).thenReturn(null);
        when(library.findBySteamAppIdAndUserContentUserId(anyLong(), eq(1L)))
                .thenReturn(Optional.empty());
        when(contentItems.findById(10L)).thenReturn(Optional.of(existingContent));
        RawgClient.GameData rawg = new RawgClient.GameData(300L, "new-game", "New Game",
                null, LocalDate.of(2020, 5, 4), "Description", "rawg-background",
                "Adventure", "Studio", List.of("PC"), false);
        SteamGridDbGameCandidate artwork = new SteamGridDbGameCandidate(
                400L, "New Game", true, List.of("steam"));
        SteamGridDbCoverCandidate cover = new SteamGridDbCoverCandidate(
                400L, 500L, "vertical-cover", null, 10, null, null);
        when(metadataResolver.resolve(any(SteamImportPreviewItem.class)))
                .thenReturn(new SteamGameMetadata(rawg, artwork, cover));
        when(contentItems.save(any(ContentItem.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userContent.findByUserIdAndContentId(1L, 10L)).thenReturn(Optional.of(existingEntry));
        when(userContent.findByUserIdAndContentId(1L, null)).thenReturn(Optional.empty());
        when(userContent.save(any(UserContent.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(dataTransfer.createAutomaticBackup()).thenReturn(Path.of("backup.json"));

        SteamImportService service = service();
        SteamImportPreparation preparation = service.prepare(
                new SteamImportSelection(List.of(1L, 2L, 3L)));
        SteamImportResult result = service.importSelected(
                new SteamImportRequest(preparation.backupToken(), List.of(1L, 2L, 3L)));

        assertEquals(3, result.requested());
        assertEquals(2, result.imported());
        assertEquals(1, result.catalogCreated());
        assertEquals(1, result.linkedExistingCatalog());
        assertEquals(1, result.skippedAlreadyImported());
        assertEquals(1, result.rawgEnriched());
        assertEquals(1, result.steamGridDbCovers());
        assertEquals("backup.json", result.backupFile());
        verify(existingCopy).linkSteamApp(1L);
        ArgumentCaptor<UserGame> copies = ArgumentCaptor.forClass(UserGame.class);
        verify(library, org.mockito.Mockito.times(2)).save(copies.capture());
        assertEquals(List.of(2L, 3L), copies.getAllValues().stream()
                .map(UserGame::getSteamAppId).toList());
        assertEquals(List.of(120L, 240L), copies.getAllValues().stream()
                .map(UserGame::getLegacyPlaytimeMinutes).toList());
        ArgumentCaptor<ContentItem> catalogItems = ArgumentCaptor.forClass(ContentItem.class);
        verify(contentItems).save(catalogItems.capture());
        assertEquals(300L, catalogItems.getValue().getRawgId());
        assertEquals("rawg-background", catalogItems.getValue().getBackgroundUrl());
        assertEquals("vertical-cover", catalogItems.getValue().getCoverUrl());
        assertEquals(400L, catalogItems.getValue().getSteamGridDbGameId());
        assertEquals(500L, catalogItems.getValue().getSteamGridDbGridId());
        InOrder backupBeforeWrites = inOrder(dataTransfer, library);
        backupBeforeWrites.verify(dataTransfer).createAutomaticBackup();
        backupBeforeWrites.verify(library, org.mockito.Mockito.times(2)).save(any(UserGame.class));
    }

    @Test
    void refusesAnAppThatIsNotInTheCurrentSteamLibrary() {
        when(previewService.preview()).thenReturn(preview(List.of(row(
                1L, "Owned", 0, SteamImportMatch.NEW, null, null))));
        when(dataTransfer.createAutomaticBackup()).thenReturn(Path.of("backup.json"));
        SteamImportService service = service();
        SteamImportPreparation preparation = service.prepare(
                new SteamImportSelection(List.of(999L)));

        assertThrows(InvalidRequestException.class,
                () -> service.importSelected(new SteamImportRequest(
                        preparation.backupToken(), List.of(999L))));
    }

    @Test
    void doesNotStartImportWhenAutomaticBackupFails() {
        when(dataTransfer.createAutomaticBackup()).thenThrow(
                new IllegalStateException("Backup failed"));

        assertThrows(IllegalStateException.class,
                () -> service().prepare(new SteamImportSelection(List.of(1L))));

        verifyNoInteractions(contentItems, userContent, library, metadataResolver);
    }

    private SteamImportService service() {
        return new SteamImportService(previewService, contentItems, userContent, library,
                platforms, sources, users, metadataResolver, dataTransfer, 1L);
    }

    private SteamImportPreview preview(List<SteamImportPreviewItem> games) {
        return new SteamImportPreview("Player", games.size(), 0, 0, 0, 0,
                games.size(), games);
    }

    private SteamImportPreviewItem row(long appId, String title, long playtime,
            SteamImportMatch match, Long contentId, Long libraryId) {
        return new SteamImportPreviewItem(appId, title, playtime, null, null,
                match, contentId, contentId == null ? null : "Existing", libraryId);
    }
}
