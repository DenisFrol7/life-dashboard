package com.lifedashboard.content;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.myshows.KinopoiskCatalogClient;
import com.lifedashboard.content.myshows.KinopoiskCatalogData;
import com.lifedashboard.content.myshows.KinopoiskLimitException;
import com.lifedashboard.content.myshows.MyShowsImportService;
import com.lifedashboard.data.DataTransferService;
import com.lifedashboard.user.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@Transactional
class KinopoiskEnrichmentIntegrationTests {
    private static final long FIRST = 910000001L;
    private static final long SECOND = 910000002L;
    private static final long THIRD = 910000003L;

    @Autowired ContentItemRepository items;
    @Autowired ContentService contentService;
    @Autowired UserContentRepository library;
    @Autowired ContentSeasonRepository seasons;
    @Autowired ContentEpisodeRepository episodes;
    @Autowired EpisodeWatchRepository watches;
    @Autowired UserRepository users;
    @Autowired EntityManager entityManager;

    private KinopoiskCatalogClient kinopoisk;
    private MovieCatalogService movies;
    private MyShowsImportService series;

    @BeforeEach
    void setUp() {
        kinopoisk = mock(KinopoiskCatalogClient.class);
        DataTransferService backups = mock(DataTransferService.class);
        when(backups.createAutomaticBackup()).thenReturn(Path.of("test-backup.json"));
        movies = new MovieCatalogService(items, kinopoisk, contentService, backups, 1L);
        series = new MyShowsImportService(items, kinopoisk, library, seasons, episodes, watches,
                users, backups, 1L);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Суточный лимит запросов исчерпан (402)", "Слишком много запросов (429)"})
    void movieLimitPreservesSuccessfulUpdatesAndAllowsResuming(String message) {
        createPending(ContentType.MOVIE);
        when(kinopoisk.getMovie(FIRST)).thenReturn(movie(FIRST));
        when(kinopoisk.getMovie(SECOND)).thenThrow(new KinopoiskLimitException(message));

        var result = movies.enrichMovies(400);
        flushAndClear();

        assertEquals(3, result.total());
        assertEquals(1, result.updated());
        assertEquals(2, result.remaining());
        assertTrue(result.quotaExhausted());
        assertEquals("test-backup.json", result.backupFile());
        assertNotNull(find(FIRST).getKinopoiskEnrichedAt());
        assertEquals("Updated movie", find(FIRST).getTitle());
        assertNull(find(SECOND).getKinopoiskEnrichedAt());
        assertNull(find(THIRD).getKinopoiskEnrichedAt());
        verify(kinopoisk, never()).getMovie(THIRD);

        reset(kinopoisk);
        when(kinopoisk.getMovie(SECOND)).thenReturn(movie(SECOND));
        when(kinopoisk.getMovie(THIRD)).thenReturn(movie(THIRD));
        var resumed = movies.enrichMovies(400);
        flushAndClear();

        assertEquals(2, resumed.total());
        assertEquals(2, resumed.updated());
        assertEquals(0, resumed.remaining());
        assertFalse(resumed.quotaExhausted());
        assertNotNull(find(SECOND).getKinopoiskEnrichedAt());
        assertNotNull(find(THIRD).getKinopoiskEnrichedAt());
        verify(kinopoisk, never()).getMovie(FIRST);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Суточный лимит запросов исчерпан (402)", "Слишком много запросов (429)"})
    void seriesLimitPreservesSuccessfulUpdatesAndAllowsResuming(String message) {
        createPending(ContentType.SERIES);
        when(kinopoisk.getCatalog(FIRST)).thenReturn(catalog());
        when(kinopoisk.getCatalog(SECOND)).thenThrow(new KinopoiskLimitException(message));

        var result = series.enrichFromKinopoisk(20);
        flushAndClear();

        assertEquals(3, result.total());
        assertEquals(1, result.updated());
        assertEquals(2, result.remaining());
        assertTrue(result.rateLimited());
        assertEquals("test-backup.json", result.backupFile());
        assertEquals("https://example.com/poster.jpg", find(FIRST).getCoverUrl());
        assertNull(find(SECOND).getCoverUrl());
        assertNull(find(THIRD).getCoverUrl());
        var season = seasons.findAllByContentIdOrderBySeasonNumber(find(FIRST).getId()).getFirst();
        assertEquals(1, episodes.findAllBySeasonIdOrderByEpisodeNumber(season.getId()).size());
        verify(kinopoisk, never()).getCatalog(THIRD);

        reset(kinopoisk);
        when(kinopoisk.getCatalog(SECOND)).thenReturn(catalog());
        when(kinopoisk.getCatalog(THIRD)).thenReturn(catalog());
        var resumed = series.enrichFromKinopoisk(20);
        flushAndClear();

        assertEquals(2, resumed.updated());
        assertEquals(0, resumed.remaining());
        assertFalse(resumed.rateLimited());
        assertEquals("https://example.com/poster.jpg", find(SECOND).getCoverUrl());
        assertEquals("https://example.com/poster.jpg", find(THIRD).getCoverUrl());
        verify(kinopoisk, never()).getCatalog(FIRST);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Суточный лимит запросов исчерпан (402)", "Слишком много запросов (429)"})
    void movieLimitOnFirstRequestLeavesAllItemsPending(String message) {
        createPending(ContentType.MOVIE);
        when(kinopoisk.getMovie(FIRST)).thenThrow(new KinopoiskLimitException(message));

        var result = movies.enrichMovies(400);

        assertEquals(0, result.updated());
        assertEquals(3, result.remaining());
        assertTrue(result.quotaExhausted());
        verify(kinopoisk, times(1)).getMovie(anyLong());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Суточный лимит запросов исчерпан (402)", "Слишком много запросов (429)"})
    void seriesLimitOnFirstRequestLeavesAllItemsPending(String message) {
        createPending(ContentType.SERIES);
        when(kinopoisk.getCatalog(FIRST)).thenThrow(new KinopoiskLimitException(message));

        var result = series.enrichFromKinopoisk(20);

        assertEquals(0, result.updated());
        assertEquals(3, result.remaining());
        assertTrue(result.rateLimited());
        verify(kinopoisk, times(1)).getCatalog(anyLong());
    }

    @Test
    void movieBatchCountsItemsOutsideCurrentBatch() {
        createPending(ContentType.MOVIE);
        when(kinopoisk.getMovie(FIRST)).thenReturn(movie(FIRST));

        var result = movies.enrichMovies(1);

        assertEquals(1, result.updated());
        assertEquals(2, result.remaining());
        assertFalse(result.quotaExhausted());
        verify(kinopoisk, times(1)).getMovie(anyLong());
    }

    @Test
    void seriesBatchCountsItemsOutsideCurrentBatch() {
        createPending(ContentType.SERIES);
        when(kinopoisk.getCatalog(FIRST)).thenReturn(catalog());

        var result = series.enrichFromKinopoisk(1);

        assertEquals(1, result.updated());
        assertEquals(2, result.remaining());
        assertFalse(result.rateLimited());
        verify(kinopoisk, times(1)).getCatalog(anyLong());
    }

    @Test
    void unrelatedSeriesErrorIsNotMistakenForLimitBasedOnMessage() {
        createPending(ContentType.SERIES);
        InvalidRequestException failure = new InvalidRequestException("Unexpected quota response format");
        when(kinopoisk.getCatalog(FIRST)).thenThrow(failure);

        assertSame(failure, assertThrows(InvalidRequestException.class, () -> series.enrichFromKinopoisk(20)));
    }

    private void createPending(ContentType type) {
        for (long filmId : List.of(FIRST, SECOND, THIRD)) {
            ContentItem item = new ContentItem("Pending " + filmId);
            item.update(item.getTitle(), null, type, ContentFormat.LIVE_ACTION, 2020,
                    null, null, 45, ReleaseStatus.RELEASED, null, null, null, false);
            item.setKinopoiskFilmId(filmId);
            items.save(item);
        }
        flushAndClear();
    }

    private ContentItem find(long filmId) {
        return items.findByKinopoiskFilmId(filmId).orElseThrow();
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    private KinopoiskCatalogClient.MovieDetails movie(long filmId) {
        return new KinopoiskCatalogClient.MovieDetails(filmId, "Updated movie", null, 2020,
                "Description", "https://example.com/poster.jpg", 90, "драма", "COMPLETED", true);
    }

    private KinopoiskCatalogData catalog() {
        return new KinopoiskCatalogData("Updated series", null, 2020, "Description",
                "https://example.com/poster.jpg", "драма", "COMPLETED", true,
                List.of(new KinopoiskCatalogData.Season(1,
                        List.of(new KinopoiskCatalogData.Episode(1, "Episode", null, null)))));
    }
}
