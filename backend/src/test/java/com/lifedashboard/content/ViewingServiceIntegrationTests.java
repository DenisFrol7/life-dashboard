package com.lifedashboard.content;

import com.lifedashboard.content.dto.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;

@SpringBootTest
class ViewingServiceIntegrationTests {
    private static final String SERIES = "Viewing test series";
    private static final String MOVIE = "Viewing test movie";
    @Autowired ContentService contentService;
    @Autowired ViewingService viewingService;
    @Autowired ContentItemRepository contentRepository;
    @Autowired UserContentRepository libraryRepository;

    @BeforeEach void setUp() { cleanup(); }

    @Test
    void recalculatesSeriesStatusWhenEpisodesAreWatchedAndAdded() {
        try {
            long contentId = contentService.create(new ContentItemRequest(SERIES, null, ContentType.SERIES,
                    ContentFormat.LIVE_ACTION, 2024, null, null, null, ReleaseStatus.ONGOING)).id();
            contentService.putInLibrary(contentId, new LibraryEntryRequest(UserContentStatus.PLANNED,
                    null, false, null, null, null));
            long seasonId = viewingService.createSeason(contentId, new SeasonRequest(1, null, 2024)).id();
            long first = viewingService.createEpisode(seasonId, new EpisodeRequest(1, "Episode 1", 50, null)).id();

            viewingService.watchEpisode(first, new WatchRequest(null));
            assertEquals(UserContentStatus.PAUSED, library(contentId).getStatus());

            long second = viewingService.createEpisode(seasonId, new EpisodeRequest(2, "Episode 2", 50, null)).id();
            assertEquals(UserContentStatus.IN_PROGRESS, library(contentId).getStatus());
            viewingService.watchEpisode(second, new WatchRequest(null));
            assertEquals(UserContentStatus.PAUSED, library(contentId).getStatus());

            contentService.update(contentId, new ContentItemRequest(SERIES, null, ContentType.SERIES,
                    ContentFormat.LIVE_ACTION, 2024, null, null, null, ReleaseStatus.ENDED));
            viewingService.watchEpisode(second, new WatchRequest(null));
            assertEquals(UserContentStatus.COMPLETED, library(contentId).getStatus());
            assertEquals(2, viewingService.episodeHistory(second).size());
        } finally { cleanup(); }
    }

    @Test
    void numbersRepeatedMovieWatchesAndCompletesLibraryEntry() {
        try {
            long id = contentService.create(new ContentItemRequest(MOVIE, null, ContentType.MOVIE,
                    ContentFormat.LIVE_ACTION, 2025, null, null, 120, ReleaseStatus.RELEASED)).id();
            var first = viewingService.watchMovie(id, new WatchRequest(Instant.parse("2026-07-01T18:30:00Z")));
            assertEquals(1, first.watchNumber());
            assertEquals(2, viewingService.watchMovie(id, new WatchRequest(null)).watchNumber());
            assertEquals(UserContentStatus.COMPLETED, library(id).getStatus());
            assertEquals(2, viewingService.movieHistory(id).size());
            var changedAt = Instant.parse("2026-08-01T18:30:00Z");
            assertEquals(changedAt, viewingService.updateMovieWatch(first.id(), new WatchRequest(changedAt)).watchedAt());
            viewingService.deleteMovieWatch(first.id());
            assertEquals(1, viewingService.movieHistory(id).size());
        } finally { cleanup(); }
    }

    private UserContent library(long contentId) {
        return libraryRepository.findByUserIdAndContentId(1L, contentId).orElseThrow();
    }
    private void cleanup() {
        contentRepository.findByTitle(SERIES).ifPresent(contentRepository::delete);
        contentRepository.findByTitle(MOVIE).ifPresent(contentRepository::delete);
    }
}
