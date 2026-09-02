package com.lifedashboard.timeline;

import com.lifedashboard.activity.*;
import com.lifedashboard.book.*;
import com.lifedashboard.calendar.*;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.content.MediaTimelineService;
import com.lifedashboard.game.*;
import com.lifedashboard.habit.*;
import com.lifedashboard.journal.*;
import com.lifedashboard.sleep.*;
import com.lifedashboard.timeline.dto.TimelineItemResponse;
import com.lifedashboard.user.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.math.RoundingMode;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class TimelineService {
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");
    private final DailyActivityRepository activities;
    private final SleepSessionRepository sleepSessions;
    private final HabitEntryRepository habitEntries;
    private final CalendarEventRepository calendarEvents;
    private final CalendarEventOccurrenceRepository occurrences;
    private final JournalEntryRepository journalEntries;
    private final MediaTimelineService mediaTimeline;
    private final ReadingSessionRepository readingSessions;
    private final GameSessionRepository gameSessions;
    private final UserRepository users;
    private final long userId;

    public TimelineService(DailyActivityRepository activities, SleepSessionRepository sleepSessions,
            HabitEntryRepository habitEntries, CalendarEventRepository calendarEvents,
            CalendarEventOccurrenceRepository occurrences, JournalEntryRepository journalEntries,
            MediaTimelineService mediaTimeline, ReadingSessionRepository readingSessions,
            GameSessionRepository gameSessions, UserRepository users,
            @Value("${app.default-user-id}") long userId) {
        this.activities = activities; this.sleepSessions = sleepSessions; this.habitEntries = habitEntries;
        this.calendarEvents = calendarEvents; this.occurrences = occurrences; this.journalEntries = journalEntries;
        this.mediaTimeline = mediaTimeline; this.readingSessions = readingSessions;
        this.gameSessions = gameSessions; this.users = users; this.userId = userId;
    }

    public List<TimelineItemResponse> get(LocalDate requestedDate) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь по умолчанию не найден"));
        ZoneId zone = ZoneId.of(user.getTimezone());
        LocalDate date = requestedDate == null ? LocalDate.now(zone) : requestedDate;
        Instant from = date.atStartOfDay(zone).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(zone).toInstant();
        List<TimelineItemResponse> result = new ArrayList<>();
        addActivity(result, date);
        addSleep(result, from, to, zone);
        addHabits(result, date);
        addCalendar(result, date);
        addMedia(result, from, to, zone);
        addReading(result, from, to, zone);
        addGames(result, from, to, zone);
        addBlog(result, date);
        result.sort(Comparator.comparing(item -> item.time() == null ? "23:59" : item.time()));
        return result;
    }

    private void addActivity(List<TimelineItemResponse> result, LocalDate date) {
        activities.findByUserIdAndActivityDate(userId, date).ifPresent(activity -> {
            String steps = activity.getSteps() == null ? "—"
                    : String.format(Locale.forLanguageTag("ru-RU"), "%,d", activity.getSteps());
            String distance = activity.getDistanceMeters() == null ? "—"
                    : String.format(Locale.ROOT, "%.2f км", activity.getDistanceMeters() / 1000.0);
            result.add(item("activity-" + activity.getId(), "activity", null, "Дневная активность",
                    steps + " шагов · " + distance, activity.getNote(), null, false));
        });
    }

    private void addSleep(List<TimelineItemResponse> result, Instant from, Instant to, ZoneId zone) {
        for (SleepSession session : sleepSessions.findAllByUserIdAndEndedAtGreaterThanEqualAndEndedAtLessThan(userId, from, to)) {
            long minutes = Math.max(0, Duration.between(session.getStartedAt(), session.getEndedAt()).toMinutes()
                    - Optional.ofNullable(session.getAwakeMinutes()).orElse(0));
            String detail = "Заснул в " + time(session.getStartedAt(), zone)
                    + (session.getQualityRating() == null ? "" : " · качество " + session.getQualityRating() + "/5");
            result.add(item("sleep-" + session.getId(), "sleep", time(session.getEndedAt(), zone),
                    "Сон — " + duration(minutes), detail, null, null, false));
        }
    }

    private void addHabits(List<TimelineItemResponse> result, LocalDate date) {
        for (HabitEntry entry : habitEntries.findAllByHabitUserIdAndEntryDate(userId, date)) {
            Habit habit = entry.getHabit();
            String detail = entry.isSkipped() ? "Пропущено" : habit.getTrackingType() == TrackingType.BOOLEAN
                    ? "Выполнено" : habitValue(habit, entry);
            result.add(item("habit-" + entry.getId(), "habit", null, habit.getName(), detail,
                    null, null, habitCompleted(habit, entry)));
        }
    }

    private void addCalendar(List<TimelineItemResponse> result, LocalDate date) {
        Map<Long, CalendarEventOccurrence> byEvent = new HashMap<>();
        for (CalendarEventOccurrence occurrence : occurrences.findAllByEventUserIdAndOccurrenceDate(userId, date)) {
            byEvent.put(occurrence.getEvent().getId(), occurrence);
        }
        for (CalendarEvent event : calendarEvents.findCandidatesForDate(userId, date)) {
            if (!scheduled(event, date)) continue;
            CalendarEventOccurrence occurrence = byEvent.get(event.getId());
            if (occurrence != null && (occurrence.getStatus() == OccurrenceStatus.CANCELLED
                    || occurrence.getStatus() == OccurrenceStatus.SKIPPED)) continue;
            String detail = eventType(event.getEventType())
                    + (event.getLocation() == null ? "" : " · " + event.getLocation());
            result.add(item("calendar-" + event.getId(), "calendar",
                    event.getStartTime() == null ? null : event.getStartTime().format(TIME_FORMAT), event.getTitle(),
                    detail, null, null, occurrence != null && occurrence.getStatus() == OccurrenceStatus.COMPLETED));
        }
    }

    private void addMedia(List<TimelineItemResponse> result, Instant from, Instant to, ZoneId zone) {
        mediaTimeline.get(from, to).forEach(entry -> result.add(item(entry.id(), "media",
                time(entry.occurredAt(), zone), entry.title(), entry.detail(),
                entry.durationMinutes() == null ? null : duration(entry.durationMinutes()), entry.durationMinutes(), false)));
    }

    private void addReading(List<TimelineItemResponse> result, Instant from, Instant to, ZoneId zone) {
        for (ReadingSession session : readingSessions
                .findAllByUserContentUserIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAtAsc(userId, from, to)) {
            String detail = session.getListenedMinutes() > 0 ? "Прослушано " + session.getListenedMinutes() + " мин."
                    : session.getPagesRead() > 0 ? "Прочитано " + session.getPagesRead() + " стр." : "Сеанс чтения";
            result.add(item("book-" + session.getId(), "media", time(session.getStartedAt(), zone),
                    session.getUserContent().getContent().getTitle(), detail, duration(session.getDurationMinutes()),
                    session.getDurationMinutes(), false));
        }
    }

    private void addGames(List<TimelineItemResponse> result, Instant from, Instant to, ZoneId zone) {
        for (GameSession session : gameSessions
                .findAllByLibraryEntryUserContentUserIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAtDesc(userId, from, to)) {
            List<String> details = new ArrayList<>();
            if (session.getUnlockedAchievements() > 0) details.add(session.getUnlockedAchievements() + " достиж.");
            if (session.getEarnedGamerscore() > 0) details.add(session.getEarnedGamerscore() + " G");
            if (session.getNote() != null) details.add(session.getNote());
            result.add(item("game-" + session.getId(), "game", time(session.getStartedAt(), zone),
                    session.getLibraryEntry().getUserContent().getContent().getTitle(),
                    details.isEmpty() ? "Игровая сессия" : String.join(" · ", details),
                    duration(session.getDurationMinutes()), session.getDurationMinutes(), false));
        }
    }

    private void addBlog(List<TimelineItemResponse> result, LocalDate date) {
        for (JournalEntry entry : journalEntries.findAllByUserIdAndEntryDateOrderByIdAsc(userId, date)) {
            String content = entry.getContent().length() > 100 ? entry.getContent().substring(0, 100) + "…" : entry.getContent();
            result.add(item("blog-" + entry.getId(), "blog", null,
                    entry.getTitle() == null ? "Запись без заголовка" : entry.getTitle(), content, null, null, false));
        }
    }

    private boolean scheduled(CalendarEvent event, LocalDate date) {
        if (event.getStatus() != CalendarEventStatus.ACTIVE || date.isBefore(event.getStartDate())
                || event.getRepeatUntil() != null && date.isAfter(event.getRepeatUntil())) return false;
        return switch (event.getScheduleType()) {
            case ONCE -> date.equals(event.getStartDate());
            case DAILY -> true;
            case WEEKLY -> date.getDayOfWeek() == event.getStartDate().getDayOfWeek();
            case SELECTED_DAYS -> event.getScheduleDays().contains((short) date.getDayOfWeek().getValue());
        };
    }

    private String eventType(EventType type) {
        return switch (type) { case EVENT -> "Событие"; case TASK -> "Задача"; case REMINDER -> "Напоминание"; };
    }

    private TimelineItemResponse item(String id, String kind, String time, String title, String detail,
            String value, Integer durationMinutes, boolean completed) {
        return new TimelineItemResponse(id, kind, time, title, detail, value, durationMinutes, completed);
    }
    private String time(Instant value, ZoneId zone) { return value.atZone(zone).format(TIME_FORMAT); }
    private String duration(long minutes) { return minutes / 60 + " ч " + minutes % 60 + " мин"; }
    private String habitValue(Habit habit, HabitEntry entry) {
        if (habit.getDataSource() == HabitDataSource.SLEEP_DURATION) {
            long minutes = entry.getValue().setScale(0, RoundingMode.HALF_UP).longValue();
            return duration(minutes);
        }
        return entry.getValue().stripTrailingZeros().toPlainString()
                + (habit.getUnit() == null ? "" : " " + habit.getUnit());
    }

    private boolean habitCompleted(Habit habit, HabitEntry entry) {
        if (entry.isSkipped() || entry.getValue() == null) return false;
        if (habit.getTrackingType() == TrackingType.BOOLEAN) {
            return entry.getValue().compareTo(BigDecimal.ONE) == 0;
        }
        BigDecimal target = entry.getTargetValueSnapshot() == null
                ? habit.getTargetValue()
                : entry.getTargetValueSnapshot();
        return target == null || entry.getValue().compareTo(target) >= 0;
    }
}
