package com.lifedashboard.content;

import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.content.dto.KinopoiskRatingsImportResult;
import com.lifedashboard.content.dto.LibraryEntryRequest;
import com.lifedashboard.content.dto.WatchRequest;
import com.lifedashboard.content.myshows.KinopoiskCatalogClient;
import com.lifedashboard.data.DataTransferService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
@Transactional
class MovieRatingsImportIntegrationTests {
    private static final long FILM_ID = 900000001L;
    private static final String TITLE = "Movie ratings import regression test";
    private static final Instant STARTED = Instant.parse("2020-02-01T10:00:00Z");
    private static final Instant COMPLETED = Instant.parse("2020-02-01T12:00:00Z");

    @Autowired ContentService contentService;
    @Autowired ViewingService viewingService;
    @Autowired ContentItemRepository items;
    @Autowired UserContentRepository library;
    @Autowired EntityManager entityManager;

    private KinopoiskCatalogClient kinopoisk;
    private MovieCatalogService service;

    @BeforeEach
    void setUp() {
        kinopoisk = mock(KinopoiskCatalogClient.class);
        DataTransferService backups = mock(DataTransferService.class);
        when(backups.createAutomaticBackup()).thenReturn(Path.of("test-backup.json"));
        service = new MovieCatalogService(items, kinopoisk, contentService, backups, 1L);
    }

    @ParameterizedTest
    @EnumSource(value = UserContentStatus.class, names = {"COMPLETED", "IN_PROGRESS"})
    void repeatedImportPreservesPersonalFieldsAndWatchHistory(UserContentStatus status) {
        long id = createMovie(true);
        viewingService.watchMovie(id, new WatchRequest(COMPLETED));
        Instant completedAt = status == UserContentStatus.COMPLETED ? COMPLETED : null;
        contentService.putInLibrary(id, new LibraryEntryRequest(status, (short) 7, true,
                STARTED, completedAt, "My personal note"));
        var history = viewingService.movieHistory(id);

        importRating(8);
        assertPersonalFields(id, status, (short) 8, true, completedAt, "My personal note");

        // Edits made after one import must survive the next one, including edits after preview.
        previewRating(9);
        contentService.putInLibrary(id, new LibraryEntryRequest(status, (short) 8, false,
                STARTED, completedAt, "Updated after preview"));
        service.importRatings("test-profile");
        flushAndClear();

        assertPersonalFields(id, status, (short) 9, false, completedAt, "Updated after preview");
        assertEquals(history, viewingService.movieHistory(id));
        assertEquals(1, items.findAllByItemTypeOrderByTitleAsc(ContentType.MOVIE).stream()
                .filter(item -> Long.valueOf(FILM_ID).equals(item.getKinopoiskFilmId())).count());
        assertEquals("https://example.com/new-poster.jpg", items.findById(id).orElseThrow().getCoverUrl());
    }

    @Test
    void linkingManualMoviePreservesPersonalFields() {
        long id = createMovie(false);
        contentService.putInLibrary(id, new LibraryEntryRequest(UserContentStatus.COMPLETED,
                (short) 7, true, STARTED, COMPLETED, "Manual movie note"));

        var result = importRating(9);

        assertEquals(0, result.created());
        assertEquals(1, result.updated());
        assertEquals(id, items.findByKinopoiskFilmId(FILM_ID).orElseThrow().getId());
        assertPersonalFields(id, UserContentStatus.COMPLETED, (short) 9, true, COMPLETED, "Manual movie note");
    }

    @Test
    void missingImportedRatingKeepsLocalRating() {
        long id = createMovie(true);
        contentService.putInLibrary(id, new LibraryEntryRequest(UserContentStatus.COMPLETED,
                (short) 7, true, STARTED, COMPLETED, "Keep this note"));

        importRating(null);

        assertPersonalFields(id, UserContentStatus.COMPLETED, (short) 7, true, COMPLETED, "Keep this note");
    }

    @Test
    void newMovieIsAddedAsCompletedWithImportedRating() {
        var result = importRating(9);

        assertEquals(1, result.created());
        assertEquals(0, result.updated());
        long id = items.findByKinopoiskFilmId(FILM_ID).orElseThrow().getId();
        assertNewLibraryEntry(id);
    }

    @Test
    void existingCatalogMovieWithoutLibraryEntryIsAddedToLibrary() {
        long id = createMovie(true);

        var result = importRating(9);

        assertEquals(0, result.created());
        assertEquals(1, result.updated());
        assertNewLibraryEntry(id);
    }

    private long createMovie(boolean linked) {
        long id = contentService.create(new ContentItemRequest(TITLE, "Original", ContentType.MOVIE,
                ContentFormat.LIVE_ACTION, 2020, "Description", null, 90, ReleaseStatus.RELEASED)).id();
        if (linked) items.findById(id).orElseThrow().setKinopoiskFilmId(FILM_ID);
        return id;
    }

    private void previewRating(Integer rating) {
        when(kinopoisk.getUserRatings("test-profile")).thenReturn(new KinopoiskCatalogClient.UserRatings(1, 1,
                List.of(new KinopoiskCatalogClient.UserRating(FILM_ID, TITLE, "Original", 2020,
                        rating, "FILM", "https://example.com/new-poster.jpg", "drama"))));
        service.previewRatings("test-profile");
    }

    private KinopoiskRatingsImportResult importRating(Integer rating) {
        previewRating(rating);
        var result = service.importRatings("test-profile");
        flushAndClear();
        return result;
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    private void assertPersonalFields(long id, UserContentStatus status, short rating, boolean favorite,
                                      Instant completedAt, String note) {
        UserContent entry = library.findByUserIdAndContentId(1L, id).orElseThrow();
        assertAll(
                () -> assertEquals(status, entry.getStatus()),
                () -> assertEquals(rating, entry.getRating()),
                () -> assertEquals(favorite, entry.isFavorite()),
                () -> assertEquals(STARTED, entry.getStartedAt()),
                () -> assertEquals(completedAt, entry.getCompletedAt()),
                () -> assertEquals(note, entry.getPersonalNote()));
    }

    private void assertNewLibraryEntry(long id) {
        UserContent entry = library.findByUserIdAndContentId(1L, id).orElseThrow();
        assertAll(
                () -> assertEquals(UserContentStatus.COMPLETED, entry.getStatus()),
                () -> assertEquals((short) 9, entry.getRating()),
                () -> assertFalse(entry.isFavorite()),
                () -> assertNull(entry.getStartedAt()),
                () -> assertNull(entry.getCompletedAt()),
                () -> assertNull(entry.getPersonalNote()));
    }
}
