package com.lifedashboard.dashboard;

import com.lifedashboard.analytics.AnalyticsService;
import com.lifedashboard.sleep.SleepSession;
import com.lifedashboard.sleep.SleepSessionRepository;
import com.lifedashboard.sleep.SleepSessionService;
import com.lifedashboard.sleep.dto.SleepSessionRequest;
import com.lifedashboard.sleep.dto.SleepSessionResponse;
import com.lifedashboard.timeline.TimelineService;
import com.lifedashboard.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class DashboardSleepIntegrationTests {
    private static final LocalDate DATE = LocalDate.of(2097, 12, 5);
    private static final ZoneId ZONE = ZoneId.of("Europe/Moscow");
    @Autowired DashboardService dashboard;
    @Autowired SleepSessionService sleep;
    @Autowired SleepSessionRepository sessions;
    @Autowired AnalyticsService analytics;
    @Autowired TimelineService timeline;
    @Autowired UserRepository users;

    @BeforeEach
    void useKnownTimezone() {
        var user = users.findById(1L).orElseThrow();
        user.update(user.getUsername(), user.getDisplayName(), user.getEmail(), ZONE.getId());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = {0, 30, 480})
    void subtractsAwakeMinutesAndAgreesWithAnalyticsAndTimeline(Integer awakeMinutes) {
        var created = create(DATE.atTime(7, 0).atZone(ZONE).toInstant(), 480, awakeMinutes, 4);
        long expected = awakeMinutes == null ? 480 : 480 - awakeMinutes;

        assertSummary(expected, 1, 4);
        var item = timeline.get(DATE).stream().filter(entry -> entry.id().equals("sleep-" + created.id()))
                .findFirst().orElseThrow();
        assertEquals("Сон — " + expected / 60 + " ч " + expected % 60 + " мин", item.title());
        assertEquals(created, sleep.getById(created.id()));
    }

    @Test
    void sumsNetSleepAcrossSessionsAndPreservesQualityAndCount() {
        create(DATE.atTime(7, 0).atZone(ZONE).toInstant(), 480, 30, 3);
        create(DATE.atTime(15, 0).atZone(ZONE).toInstant(), 90, 15, 5);

        assertSummary(525, 2, 4);
    }

    @Test
    void usesWakeUpDateInUserTimezoneWithExclusiveNextDayBoundary() {
        Instant start = DATE.atStartOfDay(ZONE).toInstant();
        Instant nextDay = DATE.plusDays(1).atStartOfDay(ZONE).toInstant();
        create(start.minusSeconds(60), 60, 10, null);
        create(start, 480, 30, null);
        create(nextDay.minusSeconds(60), 60, 5, null);
        create(nextDay, 60, 10, null);

        assertSummary(505, 2, null);
    }

    @Test
    void clampsInvalidImportedSessionBeforeSummingOtherSessions() {
        // JSON imports can contain older records that bypass service validation.
        Instant end = DATE.atTime(7, 0).atZone(ZONE).toInstant();
        var imported = new SleepSession(users.findById(1L).orElseThrow());
        imported.update(end.minusSeconds(60 * 60), end, null, null, null, 120, null, "Imported record");
        sessions.saveAndFlush(imported);
        create(DATE.atTime(15, 0).atZone(ZONE).toInstant(), 120, 10, null);

        assertSummary(110, 2, null);
    }

    private SleepSessionResponse create(Instant end, int durationMinutes, Integer awakeMinutes, Integer quality) {
        return sleep.create(new SleepSessionRequest(end.minusSeconds(durationMinutes * 60L), end,
                null, null, null, awakeMinutes, quality, "Dashboard sleep regression test"));
    }

    private void assertSummary(long minutes, int count, Integer quality) {
        var summary = dashboard.get(DATE).sleep();
        assertAll(
                () -> assertEquals(minutes, summary.durationMinutes()),
                () -> assertEquals(count, summary.sessions()),
                () -> assertEquals(quality, summary.qualityRating()));
        var daily = analytics.get(DATE, DATE, false).daily().getFirst();
        assertEquals(minutes, daily.sleepMinutes());
        assertEquals(count, daily.sleepSessions());
    }
}
