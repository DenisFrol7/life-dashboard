package com.lifedashboard.content;

import com.lifedashboard.content.dto.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class ViewingDatesIntegrationTests {
    private static final Instant FIRST = Instant.parse("2020-02-01T12:00:00Z");
    private static final Instant SECOND = Instant.parse("2020-02-02T12:00:00Z");
    private static final Instant EARLIER = Instant.parse("2020-01-01T12:00:00Z");
    private static final Instant REWATCH = Instant.parse("2021-03-01T12:00:00Z");

    @Autowired ContentService contentService;
    @Autowired ViewingService viewing;
    @Autowired UserContentRepository library;
    @Autowired EntityManager entityManager;

    @ParameterizedTest
    @EnumSource(value = ContentType.class, names = {"SERIES", "ANIME"})
    void historicalEpisodeDatesDetermineCompletionAndAreRecalculatedAfterEdits(ContentType type) {
        long id = create(type, ReleaseStatus.ENDED);
        long season = season(id, 1);
        long firstEpisode = episode(season, 1);
        long secondEpisode = episode(season, 2);
        var first = viewing.watchEpisode(firstEpisode, new WatchRequest(FIRST));
        flushAndClear();
        assertEquals(FIRST, entry(id).getStartedAt());
        assertEquals(UserContentStatus.IN_PROGRESS, entry(id).getStatus());
        assertNull(entry(id).getCompletedAt());

        var second = viewing.watchEpisode(secondEpisode, new WatchRequest(SECOND));
        assertCompletion(id, SECOND);

        viewing.updateEpisodeWatch(second.id(), new WatchRequest(EARLIER));
        assertCompletion(id, FIRST);
        assertEquals(EARLIER, viewing.episodeHistory(secondEpisode).getFirst().watchedAt());

        viewing.updateEpisodeWatch(first.id(), new WatchRequest(SECOND));
        assertCompletion(id, SECOND);
        assertEquals(1, viewing.episodeHistory(firstEpisode).size());
        assertEquals(1, viewing.episodeHistory(secondEpisode).size());
    }

    @ParameterizedTest
    @EnumSource(value = ContentType.class, names = {"SERIES", "ANIME"})
    void olderEpisodeWatchDoesNotReplaceLaterRewatchDate(ContentType type) {
        long id = create(type, ReleaseStatus.ENDED);
        long season = season(id, 1);
        long firstEpisode = episode(season, 1);
        long secondEpisode = episode(season, 2);
        var first = viewing.watchEpisode(firstEpisode, new WatchRequest(FIRST));
        viewing.watchEpisode(secondEpisode, new WatchRequest(SECOND));
        var repeat = viewing.watchEpisode(firstEpisode, new WatchRequest(REWATCH));
        assertCompletion(id, REWATCH);

        viewing.updateEpisodeWatch(first.id(), new WatchRequest(EARLIER));
        assertCompletion(id, REWATCH);
        assertEquals(2, viewing.episodeHistory(firstEpisode).size());
        assertEquals(REWATCH, viewing.episodeHistory(firstEpisode).getLast().watchedAt());

        viewing.updateEpisodeWatch(repeat.id(), new WatchRequest(EARLIER));
        assertCompletion(id, SECOND);
    }

    @ParameterizedTest
    @EnumSource(value = ContentType.class, names = {"SERIES", "ANIME"})
    void combinesKnownEpisodeAndSeasonDatesAndIgnoresUndatedBulkWatches(ContentType type) {
        long id = create(type, ReleaseStatus.ENDED);
        long firstSeason = season(id, 1);
        episode(firstSeason, 1);
        long secondSeason = season(id, 2);
        long individualEpisode = episode(secondSeason, 1);
        long unknownSeason = season(id, 3);
        episode(unknownSeason, 1);

        viewing.watchSeason(firstSeason, new WatchRequest(REWATCH));
        viewing.watchEpisode(individualEpisode, new WatchRequest(SECOND));
        viewing.watchSeason(unknownSeason, new WatchRequest(null));
        assertCompletion(id, REWATCH);
        assertNull(viewing.seasonCompletion(unknownSeason).completedAt());

        viewing.watchSeason(firstSeason, new WatchRequest(EARLIER));
        assertCompletion(id, SECOND);
    }

    @Test
    void allUndatedSeasonWatchesLeaveCompletionDateUnknown() {
        long id = create(ContentType.SERIES, ReleaseStatus.ENDED);
        long season = season(id, 1);
        viewing.createEpisodes(season, new BulkEpisodeRequest(2, 25, true, null));
        assertCompletion(id, null);
    }

    @ParameterizedTest
    @EnumSource(value = ReleaseStatus.class, names = {"ONGOING", "ANNOUNCED"})
    void fullyWatchedOngoingSeriesStaysPausedWithoutCompletionDate(ReleaseStatus releaseStatus) {
        long id = create(ContentType.SERIES, releaseStatus);
        long episode = episode(season(id, 1), 1);

        viewing.watchEpisode(episode, new WatchRequest(FIRST));
        flushAndClear();

        assertEquals(UserContentStatus.PAUSED, entry(id).getStatus());
        assertNull(entry(id).getCompletedAt());
        assertEquals(FIRST, entry(id).getStartedAt());
    }

    @Test
    void olderMovieWatchDoesNotMoveCompletionDateBackwards() {
        long id = create(ContentType.MOVIE, ReleaseStatus.RELEASED);
        viewing.watchMovie(id, new WatchRequest(SECOND));
        viewing.watchMovie(id, new WatchRequest(FIRST));

        assertCompletion(id, SECOND);
        assertEquals(2, viewing.movieHistory(id).size());
    }

    @Test
    void editingMovieHistoryRecalculatesLatestDateWithoutReplacingOtherWatches() {
        long id = create(ContentType.MOVIE, ReleaseStatus.RELEASED);
        var first = viewing.watchMovie(id, new WatchRequest(FIRST));
        var second = viewing.watchMovie(id, new WatchRequest(SECOND));

        viewing.updateMovieWatch(second.id(), new WatchRequest(REWATCH));
        assertCompletion(id, REWATCH);
        viewing.updateMovieWatch(first.id(), new WatchRequest(EARLIER));
        assertCompletion(id, REWATCH);

        viewing.updateMovieWatch(second.id(), new WatchRequest(EARLIER));
        assertCompletion(id, EARLIER);
        assertEquals(2, viewing.movieHistory(id).size());
        assertEquals(1, viewing.movieHistory(id).getFirst().watchNumber());
        assertEquals(2, viewing.movieHistory(id).getLast().watchNumber());
    }

    @Test
    void deletingLatestMovieWatchUsesRemainingDateAndClearsDateWhenHistoryIsEmpty() {
        long id = create(ContentType.MOVIE, ReleaseStatus.RELEASED);
        var first = viewing.watchMovie(id, new WatchRequest(FIRST));
        var second = viewing.watchMovie(id, new WatchRequest(SECOND));

        viewing.deleteMovieWatch(second.id());
        assertCompletion(id, FIRST);
        viewing.deleteMovieWatch(first.id());
        assertCompletion(id, null);
        assertTrue(viewing.movieHistory(id).isEmpty());
    }

    @Test
    void editingOldMovieHistoryPreservesCurrentInProgressStatus() {
        long id = create(ContentType.MOVIE, ReleaseStatus.RELEASED);
        var watch = viewing.watchMovie(id, new WatchRequest(FIRST));
        contentService.putInLibrary(id, new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,
                (short) 8, true, SECOND, null, "Watching again"));

        viewing.updateMovieWatch(watch.id(), new WatchRequest(EARLIER));
        flushAndClear();
        assertEquals(UserContentStatus.IN_PROGRESS, entry(id).getStatus());
        assertEquals(SECOND, entry(id).getStartedAt());
        assertNull(entry(id).getCompletedAt());
        assertEquals("Watching again", entry(id).getPersonalNote());
        assertTrue(entry(id).isFavorite());

        viewing.deleteMovieWatch(watch.id());
        flushAndClear();
        assertEquals(UserContentStatus.IN_PROGRESS, entry(id).getStatus());
        assertNull(entry(id).getCompletedAt());
    }

    private long create(ContentType type, ReleaseStatus releaseStatus) {
        return contentService.create(new ContentItemRequest("Viewing dates regression test", null, type,
                type == ContentType.ANIME ? ContentFormat.ANIME : ContentFormat.LIVE_ACTION,
                2020, null, null, 25, releaseStatus)).id();
    }

    private long season(long id, int number) {
        return viewing.createSeason(id, new SeasonRequest(number, null, 2020)).id();
    }

    private long episode(long season, int number) {
        return viewing.createEpisode(season, new EpisodeRequest(number, "Episode " + number, 25, null)).id();
    }

    private UserContent entry(long id) {
        return library.findByUserIdAndContentId(1L, id).orElseThrow();
    }

    private void assertCompletion(long id, Instant expected) {
        flushAndClear();
        assertEquals(UserContentStatus.COMPLETED, entry(id).getStatus());
        assertEquals(expected, entry(id).getCompletedAt());
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }
}
