package com.lifedashboard.common.cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.content.dto.KinopoiskRatingsPreview;
import com.lifedashboard.content.myshows.KinopoiskCatalogClient;
import com.lifedashboard.content.myshows.KinopoiskCatalogData;
import com.lifedashboard.data.DataTransferService;
import com.lifedashboard.game.rawg.RawgCatalogService;
import com.lifedashboard.game.rawg.RawgClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PreviewCacheServiceTests {
    @Mock ContentItemRepository items;
    @Mock ContentSeasonRepository seasons;
    @Mock ContentEpisodeRepository episodes;
    @Mock KinopoiskCatalogClient kinopoisk;
    @Mock RawgClient rawg;
    @Mock ContentService contentService;
    @Mock DataTransferService backups;

    private AtomicLong time;
    private PreviewCacheFactory caches;

    @BeforeEach
    void setUp() {
        time = new AtomicLong();
        caches = new PreviewCacheFactory(time::get);
    }

    @Test
    void expiredSeriesPreviewReloadsCurrentEpisodeStructure() {
        var oldCatalog = new KinopoiskCatalogData("Series", null, 2020, null, "poster", null,
                "COMPLETED", true, List.of());
        var freshCatalog = new KinopoiskCatalogData("Series", null, 2020, null, "poster", null,
                "COMPLETED", true, List.of(new KinopoiskCatalogData.Season(1,
                List.of(new KinopoiskCatalogData.Episode(1, "Fresh episode", null, null)))));
        when(kinopoisk.getCatalog(77L)).thenReturn(oldCatalog, freshCatalog);
        when(seasons.save(any(ContentSeason.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var service = new SeriesKinopoiskService(items, seasons, episodes, kinopoisk, caches);
        assertEquals(0, service.preview(77L).episodeCount());
        expire();

        var created = service.create(77L, new ContentItemRequest("Edited title", null, ContentType.SERIES,
                ContentFormat.LIVE_ACTION, 2020, null, "poster", 45, ReleaseStatus.ENDED));

        assertEquals("Edited title", created.title());
        verify(kinopoisk, times(2)).getCatalog(77L);
        verify(episodes).save(argThat(episode -> "Fresh episode".equals(episode.getTitle())));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void expiredGamePreviewReloadsMetadataForCreateAndUpdate(boolean update) {
        when(rawg.getGame(10L)).thenReturn(game("old-slug"), game("fresh-slug"));
        var service = new RawgCatalogService(rawg, items, caches);
        service.preview(10L);
        expire();

        var request = new ContentItemRequest("Edited game", null, ContentType.GAME, null,
                2020, null, null, null, ReleaseStatus.RELEASED);
        if (update) {
            ContentItem existing = new ContentItem("Existing game");
            existing.update("Existing game", null, ContentType.GAME, null, 2020, null, null,
                    null, ReleaseStatus.RELEASED, null, null, null, false);
            when(items.findById(42L)).thenReturn(java.util.Optional.of(existing));
            var response = service.update(42L, 10L, request);
            assertEquals("fresh-slug", response.rawgSlug());
            assertEquals("Edited game", response.title());
        } else {
            when(items.save(any(ContentItem.class))).thenAnswer(invocation -> invocation.getArgument(0));
            var response = service.create(10L, request);
            assertEquals("fresh-slug", response.rawgSlug());
            assertEquals("Edited game", response.title());
        }

        verify(rawg, times(2)).getGame(10L);
    }

    @Test
    void freshGamePreviewAvoidsSecondExternalRequest() {
        when(rawg.getGame(10L)).thenReturn(game("preview-slug"));
        when(items.save(any(ContentItem.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var service = new RawgCatalogService(rawg, items, caches);
        service.preview(10L);
        time.addAndGet(Duration.ofMinutes(29).toNanos());

        var response = service.create(10L, new ContentItemRequest("Edited game", null,
                ContentType.GAME, null, 2020, null, null, null, ReleaseStatus.RELEASED));

        assertEquals("preview-slug", response.rawgSlug());
        assertEquals("Edited game", response.title());
        verify(rawg, times(1)).getGame(10L);
    }

    @Test
    void expiredRatingsRequireNewPreviewBeforeAnyBackupOrWrites() {
        when(kinopoisk.getUserRatings("profile")).thenReturn(ratings(5), ratings(9));
        when(backups.createAutomaticBackup()).thenReturn(Path.of("test-backup.json"));
        when(items.save(any(ContentItem.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var service = movies(caches);
        service.previewRatings("profile");
        expire();

        var failure = assertThrows(InvalidRequestException.class, () -> service.importRatings("profile"));

        assertTrue(failure.getMessage().contains("Обновите"));
        verifyNoInteractions(backups, contentService);
        verify(items, never()).save(any(ContentItem.class));
        verify(kinopoisk, times(1)).getUserRatings("profile");

        service.previewRatings("profile");
        assertEquals(1, service.importRatings("profile").created());
        verify(contentService).importMovieRating(null, (short) 9);
        verify(kinopoisk, times(2)).getUserRatings("profile");
        assertThrows(InvalidRequestException.class, () -> service.importRatings("profile"));
    }

    @Test
    void evictedRatingsAlsoRequireNewPreviewWithoutExternalRequest() {
        Cache<String, KinopoiskRatingsPreview> cache = caches.create(10);
        var factory = mock(PreviewCacheFactory.class);
        when(factory.<String, KinopoiskRatingsPreview>create(10)).thenReturn(cache);
        when(kinopoisk.getUserRatings(anyString())).thenReturn(new KinopoiskCatalogClient.UserRatings(0, 0, List.of()));
        var service = movies(factory);
        IntStream.range(0, 11).forEach(index -> service.previewRatings("profile" + index));
        cache.cleanUp();
        String evicted = IntStream.range(0, 11).mapToObj(index -> "profile" + index)
                .filter(profile -> cache.getIfPresent(profile) == null).findFirst().orElseThrow();

        assertThrows(InvalidRequestException.class, () -> service.importRatings(evicted));

        verifyNoInteractions(backups, contentService);
        verify(kinopoisk, times(11)).getUserRatings(anyString());
        assertTrue(cache.estimatedSize() <= 10);
    }

    @Test
    void importingPreviousSnapshotDoesNotDiscardNewerPreview() {
        when(kinopoisk.getUserRatings("profile")).thenReturn(ratings(5), ratings(9));
        when(backups.createAutomaticBackup()).thenReturn(Path.of("test-backup.json"));
        when(items.save(any(ContentItem.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var service = movies(caches);
        service.previewRatings("profile");
        doAnswer(invocation -> { service.previewRatings("profile"); return null; })
                .when(contentService).importMovieRating(null, (short) 5);

        service.importRatings("profile");
        service.importRatings("profile");

        verify(contentService).importMovieRating(null, (short) 5);
        verify(contentService).importMovieRating(null, (short) 9);
        verify(kinopoisk, times(2)).getUserRatings("profile");
    }

    private MovieCatalogService movies(PreviewCacheFactory factory) {
        return new MovieCatalogService(items, kinopoisk, contentService, backups, factory, 1L);
    }

    private void expire() {
        time.addAndGet(Duration.ofMinutes(30).toNanos());
    }

    private KinopoiskCatalogClient.UserRatings ratings(int rating) {
        return new KinopoiskCatalogClient.UserRatings(1, 1,
                List.of(new KinopoiskCatalogClient.UserRating(10L, "Movie", null, 2020,
                        rating, "FILM", "poster", "драма")));
    }

    private RawgClient.GameData game(String slug) {
        return new RawgClient.GameData(10L, slug, "Game", null, LocalDate.of(2020, 1, 1),
                "Description", "cover", "Action", "Developer", List.of("PC"), false);
    }
}
