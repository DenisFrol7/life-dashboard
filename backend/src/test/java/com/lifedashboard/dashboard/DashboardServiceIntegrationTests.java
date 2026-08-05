package com.lifedashboard.dashboard;

import com.lifedashboard.activity.*;
import com.lifedashboard.activity.dto.DailyActivityRequest;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.*;
import com.lifedashboard.journal.*;
import com.lifedashboard.journal.dto.JournalEntryRequest;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class DashboardServiceIntegrationTests {
    private static final LocalDate DATE = LocalDate.of(2098, 8, 5);
    @Autowired DashboardService dashboard;
    @Autowired DailyActivityService activityService;
    @Autowired DailyActivityRepository activityRepository;
    @Autowired JournalService journalService;
    @Autowired ContentService contentService;
    @Autowired ContentItemRepository contentRepository;
    private final List<Long> contentIds = new ArrayList<>();
    private Long journalId;

    @BeforeEach void setUp() { cleanup(); }

    @Test
    void aggregatesDailyActivityJournalAndFourMediaSections() {
        try {
            activityService.put(DATE, new DailyActivityRequest(9000L, 6500L, null));
            journalId = journalService.create(new JournalEntryRequest(DATE, "Dashboard test", "Entry", false)).id();
            addContent("Dashboard movie", ContentType.MOVIE, ContentFormat.LIVE_ACTION, UserContentStatus.IN_PROGRESS);
            addContent("Dashboard series", ContentType.SERIES, ContentFormat.LIVE_ACTION, UserContentStatus.PAUSED);
            addContent("Dashboard anime", ContentType.ANIME, ContentFormat.ANIME, UserContentStatus.IN_PROGRESS);
            addContent("Dashboard game", ContentType.GAME, null, UserContentStatus.IN_PROGRESS);

            var result = dashboard.get(DATE);
            assertEquals(9000L, result.activity().steps());
            assertEquals(6500L, result.activity().distanceMeters());
            assertEquals(1, result.journalEntries());
            assertEquals(1, result.media().currentMovies());
            assertEquals(1, result.media().pausedSeries());
            assertEquals(1, result.media().currentAnime());
            assertEquals(1, result.media().currentGames());
        } finally { cleanup(); }
    }

    @Test
    void returnsZeroValuesForAnEmptyDay() {
        var result = dashboard.get(DATE.plusDays(1));
        assertNull(result.activity().steps());
        assertEquals(0, result.sleep().durationMinutes());
        assertEquals(0, result.journalEntries());
    }

    private void addContent(String title, ContentType type, ContentFormat format, UserContentStatus status) {
        long id = contentService.create(new ContentItemRequest(title, null, type, format, 2098,
                null, null, type == ContentType.MOVIE ? 100 : null, ReleaseStatus.RELEASED)).id();
        contentIds.add(id);
        contentService.putInLibrary(id, new LibraryEntryRequest(status, null, false, null, null, null));
    }
    private void cleanup() {
        if (journalId != null) { journalService.delete(journalId); journalId = null; }
        activityRepository.findByUserIdAndActivityDate(1L, DATE).ifPresent(activityRepository::delete);
        for (Long id : contentIds) contentRepository.findById(id).ifPresent(contentRepository::delete);
        contentIds.clear();
        for (String title : List.of("Dashboard movie", "Dashboard series", "Dashboard anime", "Dashboard game"))
            contentRepository.findByTitle(title).ifPresent(contentRepository::delete);
    }
}
