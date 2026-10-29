package com.lifedashboard.content;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.dto.MovieCatalogPageResponse;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class MovieCatalogPageIntegrationTests {
    private static final Instant WATCHED = Instant.parse("2025-01-01T12:00:00Z");
    private static final MovieCatalogPageResponse.Statistics TOTALS =
            new MovieCatalogPageResponse.Statistics(6, 4, 1, 1, 4, 2);

    @Autowired MovieCatalogService service;
    @Autowired ContentItemRepository items;
    @Autowired UserContentRepository library;
    @Autowired MovieWatchRepository watches;
    @Autowired UserRepository users;
    @Autowired EntityManager entityManager;
    @Autowired EntityManagerFactory entityManagerFactory;

    private Statistics statistics;
    private boolean statisticsWereEnabled;
    private ContentItem first;
    private ContentItem second;
    private ContentItem outsideLibrary;
    private ContentItem duplicateOne;
    private ContentItem duplicateTwo;
    private ContentItem last;

    @BeforeEach
    void setUp() {
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statisticsWereEnabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        User owner = users.findById(1L).orElseThrow();
        User other = users.save(new User("movie-page-other-user", "Other user", null, "Europe/Moscow"));
        first = movie("Ёлки: Новые!", "New Year", ContentFormat.LIVE_ACTION, 90);
        second = movie("Матрица", "The Matrix", ContentFormat.LIVE_ACTION, 120);
        outsideLibrary = movie("Без библиотеки", null, ContentFormat.ANIMATION, null);
        duplicateOne = movie("Одинаковый", "First original", ContentFormat.LIVE_ACTION, 100);
        duplicateTwo = movie("Одинаковый", "Second original", ContentFormat.ANIMATION, 80);
        last = movie("Пустые поля №2", "", ContentFormat.LIVE_ACTION, null);
        profile(owner, first, UserContentStatus.COMPLETED);
        profile(owner, second, UserContentStatus.PLANNED);
        profile(owner, duplicateOne, UserContentStatus.IN_PROGRESS);
        profile(owner, duplicateTwo, UserContentStatus.NOT_STARTED);
        profile(other, first, UserContentStatus.PLANNED);
        profile(other, outsideLibrary, UserContentStatus.COMPLETED);
        watches.save(new MovieWatch(owner, first, WATCHED, 1));
        watches.save(new MovieWatch(owner, first, WATCHED.plusSeconds(60), 2));
        watches.save(new MovieWatch(other, first, WATCHED, 1));
        watches.save(new MovieWatch(owner, second, WATCHED, 1));
        watches.save(new MovieWatch(owner, outsideLibrary, WATCHED, 1));
        ContentItem series = new ContentItem("Ёлки: сериал");
        series.update(series.getTitle(), null, ContentType.SERIES, ContentFormat.LIVE_ACTION,
                2020, null, null, null, ReleaseStatus.ONGOING, null, null, null, false);
        items.save(series);
        flushAndClear();
    }

    @AfterEach
    void restoreStatisticsSetting() {
        statistics.setStatisticsEnabled(statisticsWereEnabled);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" \t ", "!? - _ %"})
    void emptyNormalizedSearchIncludesEntireCatalog(String query) {
        var page = service.getPage(0, 50, query, null);

        assertEquals(service.getAll(), page.items());
        assertEquals(6, page.totalItems());
        assertEquals(TOTALS, page.statistics());
        assertFalse(page.hasMore());
    }

    @ParameterizedTest
    @CsvSource({"ЕЛКИ новые,first", "ёЛкИ:НОВЫЕ,first", "new_year,first",
            "tHe - mAtRiX,second", "матрица,second", "№2,last"})
    void searchPreservesCasePunctuationAndYoNormalization(String query, String expected) {
        long expectedId = switch (expected) {
            case "first" -> first.getId();
            case "second" -> second.getId();
            default -> last.getId();
        };

        var page = service.getPage(0, 2, query, null);

        assertEquals(List.of(expectedId), page.items().stream().map(item -> item.id()).toList());
        assertEquals(1, page.totalItems());
        assertFalse(page.hasMore());
        assertEquals(TOTALS, page.statistics());
    }

    @ParameterizedTest
    @EnumSource(UserContentStatus.class)
    void statusFilteringUsesOnlyCurrentUsersLibrary(UserContentStatus status) {
        var expected = service.getAll().stream().filter(item -> item.userStatus() == status).toList();

        var page = service.getPage(0, 50, null, status);

        assertEquals(expected, page.items());
        assertEquals(expected.size(), page.totalItems());
        assertEquals(TOTALS, page.statistics());
    }

    @Test
    void searchAndStatusFiltersAreCombined() {
        var matching = service.getPage(0, 1, "newyear", UserContentStatus.COMPLETED);
        var excluded = service.getPage(0, 1, "newyear", UserContentStatus.PLANNED);

        assertEquals(first.getId(), matching.items().getFirst().id());
        assertEquals(1, matching.totalItems());
        assertTrue(excluded.items().isEmpty());
        assertEquals(0, excluded.totalItems());
        assertEquals(TOTALS, excluded.statistics());
    }

    @ParameterizedTest
    @CsvSource({"0,4,4,true", "1,4,2,false", "2,4,0,false", "2147483647,100,0,false"})
    void handlesPageBoundariesAndLargeOffsets(int pageNumber, int size, int expectedSize, boolean hasMore) {
        var all = service.getAll();
        int from = (int) Math.min((long) pageNumber * size, all.size());
        var expected = all.subList(from, Math.min(from + size, all.size()));

        var page = service.getPage(pageNumber, size, null, null);

        assertEquals(expected, page.items());
        assertEquals(expectedSize, page.items().size());
        assertEquals(pageNumber, page.page());
        assertEquals(size, page.size());
        assertEquals(6, page.totalItems());
        assertEquals(hasMore, page.hasMore());
        assertEquals(TOTALS, page.statistics());
    }

    @Test
    void equalTitlesHaveStableOrderAcrossPages() {
        var firstPage = service.getPage(0, 1, "одинаковый", null);
        var secondPage = service.getPage(1, 1, "одинаковый", null);

        assertEquals(duplicateOne.getId(), firstPage.items().getFirst().id());
        assertEquals(duplicateTwo.getId(), secondPage.items().getFirst().id());
        assertEquals(2, firstPage.totalItems());
        assertEquals(2, secondPage.totalItems());
        assertTrue(firstPage.hasMore());
        assertFalse(secondPage.hasMore());
    }

    @Test
    void retainsPersonalFieldsAndWatchTotalsWithoutCountingOtherUsersWatches() {
        var all = service.getAll();
        var page = service.getPage(0, 50, null, null);

        assertEquals(all, page.items());
        var watched = page.items().stream().filter(item -> item.id().equals(first.getId())).findFirst().orElseThrow();
        assertEquals(2, watched.watchCount());
        assertEquals(180, watched.watchedMinutes());
        assertEquals((short) 8, watched.rating());
        assertTrue(watched.favorite());
        assertEquals("Personal note", watched.personalNote());
        assertEquals(WATCHED, watched.startedAt());
        assertEquals(WATCHED.plusSeconds(3600), watched.completedAt());
        var unlisted = page.items().stream().filter(item -> item.id().equals(outsideLibrary.getId())).findFirst().orElseThrow();
        assertNull(unlisted.libraryId());
        assertNull(unlisted.userStatus());
        assertFalse(unlisted.favorite());
        assertEquals(1, unlisted.watchCount());
        assertEquals(0, unlisted.watchedMinutes());
    }

    @Test
    void missingSearchReturnsEmptyPageWithUnfilteredStatistics() {
        var page = service.getPage(0, 50, "no-such-title%_", null);

        assertTrue(page.items().isEmpty());
        assertEquals(0, page.totalItems());
        assertFalse(page.hasMore());
        assertEquals(TOTALS, page.statistics());
    }

    @Test
    void emptyMovieCatalogReturnsZeroStatistics() {
        items.deleteAllById(List.of(first.getId(), second.getId(), outsideLibrary.getId(),
                duplicateOne.getId(), duplicateTwo.getId(), last.getId()));
        flushAndClear();

        var page = service.getPage(0, 50, null, null);

        assertTrue(page.items().isEmpty());
        assertEquals(0, page.totalItems());
        assertFalse(page.hasMore());
        assertEquals(new MovieCatalogPageResponse.Statistics(0, 0, 0, 0, 0, 0), page.statistics());
    }

    @ParameterizedTest
    @CsvSource({"-1,50", "0,0", "0,-1", "0,101"})
    void invalidPageParametersAreRejected(int pageNumber, int size) {
        assertThrows(InvalidRequestException.class, () -> service.getPage(pageNumber, size, null, null));
    }

    @Test
    void databaseReturnsOnlyRequestedPageAndOneStatisticsRow() {
        for (int index = 0; index < 80; index++) {
            movie("Bulk movie " + index, null, ContentFormat.LIVE_ACTION, 90);
        }
        flushAndClear();
        statistics.clear();

        var page = service.getPage(1, 3, "bulk movie", null);

        assertEquals(3, page.items().size());
        assertEquals(80, page.totalItems());
        assertEquals(86, page.statistics().totalMovies());
        long returnedRows = Arrays.stream(statistics.getQueries())
                .mapToLong(query -> statistics.getQueryStatistics(query).getExecutionRowCount()).sum();
        assertEquals(4, returnedRows, "JDBC must receive only three movies and one statistics row");
        assertEquals(2, statistics.getPrepareStatementCount());
    }

    private ContentItem movie(String title, String original, ContentFormat format, Integer duration) {
        ContentItem item = new ContentItem(title);
        item.update(title, original, ContentType.MOVIE, format, 2020, "Description",
                "https://example.com/poster.jpg", duration, ReleaseStatus.RELEASED,
                "драма", null, null, false);
        return items.save(item);
    }

    private void profile(User user, ContentItem item, UserContentStatus status) {
        UserContent entry = new UserContent(user, item);
        entry.update(status, (short) 8, true, WATCHED, WATCHED.plusSeconds(3600), "Personal note");
        library.save(entry);
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }
}
