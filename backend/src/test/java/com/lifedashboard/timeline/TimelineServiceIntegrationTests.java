package com.lifedashboard.timeline;

import com.lifedashboard.activity.*;
import com.lifedashboard.activity.dto.DailyActivityRequest;
import com.lifedashboard.journal.*;
import com.lifedashboard.journal.dto.JournalEntryRequest;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class TimelineServiceIntegrationTests {
    private static final LocalDate DATE = LocalDate.of(2098, 9, 12);
    @Autowired TimelineService timeline;
    @Autowired DailyActivityService activityService;
    @Autowired DailyActivityRepository activityRepository;
    @Autowired JournalService journalService;
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

    private void cleanup() {
        if (journalId != null) { journalService.delete(journalId); journalId = null; }
        activityRepository.findByUserIdAndActivityDate(1L, DATE).ifPresent(activityRepository::delete);
    }
}
