package com.lifedashboard.timeline;

import com.lifedashboard.activity.*;
import com.lifedashboard.activity.dto.DailyActivityRequest;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.game.*;
import com.lifedashboard.game.dto.GameLibraryRequest;
import com.lifedashboard.game.dto.GameSessionRequest;
import com.lifedashboard.journal.*;
import com.lifedashboard.journal.dto.JournalEntryRequest;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.time.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class TimelineServiceIntegrationTests {
    private static final LocalDate DATE = LocalDate.of(2098, 9, 12);
    private static final String GAME_TITLE = "Timeline game session test";
    @Autowired TimelineService timeline;
    @Autowired DailyActivityService activityService;
    @Autowired DailyActivityRepository activityRepository;
    @Autowired JournalService journalService;
    @Autowired ContentService contentService;
    @Autowired ContentItemRepository contentRepository;
    @Autowired GameLibraryService gameLibraryService;
    @Autowired GameSessionService gameSessionService;
    @Autowired GamingPlatformRepository platforms;
    @Autowired GameSourceRepository sources;
    private Long journalId;

    @BeforeEach void setUp() { cleanup(); }
    @AfterEach void tearDown() { cleanup(); }

    @Test
    void aggregatesAndSortsDailyItems() {
        activityService.put(DATE, new DailyActivityRequest(7200L, 5100L, "Прогулка"));
        journalId = journalService.create(new JournalEntryRequest(DATE, "Итоги дня", "Хороший день", false)).id();

        var result = timeline.get(DATE);

        assertTrue(result.stream().anyMatch(item -> item.kind().equals("activity")
                && item.detail().contains("7 200 шагов") && "Прогулка".equals(item.value())));
        assertTrue(result.stream().anyMatch(item -> item.kind().equals("blog")
                && item.title().equals("Итоги дня") && item.detail().equals("Хороший день")));
    }

    @Test
    void returnsEmptyListForDayWithoutEntries() {
        assertTrue(timeline.get(DATE.plusDays(1)).isEmpty());
    }

    @Test
    void includesRealGameSessionButNotLegacyPlaytime() {
        long contentId = contentService.create(new ContentItemRequest(GAME_TITLE, null, ContentType.GAME,
                null, 2098, null, null, null, ReleaseStatus.RELEASED)).id();
        long platformId = platforms.findByCode("PC").orElseThrow().getId();
        long sourceId = sources.findByCode("STEAM").orElseThrow().getId();
        long libraryId = gameLibraryService.create(contentId, new GameLibraryRequest(platformId, sourceId,
                GameAccessType.OWNED, null, null, null, UserContentStatus.IN_PROGRESS,
                null, false, null, null, null, 600L)).id();
        Instant startedAt = Instant.parse("2098-09-12T09:00:00Z");
        gameSessionService.create(libraryId, new GameSessionRequest(startedAt, 90, "Story mission"));

        var gameItem = timeline.get(DATE).stream()
                .filter(item -> item.kind().equals("game") && item.title().equals(GAME_TITLE))
                .findFirst().orElseThrow();

        assertEquals(90, gameItem.durationMinutes());
        assertEquals("1 ч 30 мин", gameItem.value());
        assertTrue(gameItem.detail().contains("Story mission"));
    }

    private void cleanup() {
        if (journalId != null) { journalService.delete(journalId); journalId = null; }
        activityRepository.findByUserIdAndActivityDate(1L, DATE).ifPresent(activityRepository::delete);
        contentRepository.findByTitle(GAME_TITLE).ifPresent(contentRepository::delete);
    }
}
