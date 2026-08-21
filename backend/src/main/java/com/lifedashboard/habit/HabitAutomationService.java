package com.lifedashboard.habit;

import org.jspecify.annotations.NonNull;
import com.lifedashboard.sleep.SleepSession;
import com.lifedashboard.sleep.SleepSessionRepository;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Service
public class HabitAutomationService {

    private final HabitRepository habitRepository;
    private final HabitEntryRepository entryRepository;
    private final SleepSessionRepository sleepSessionRepository;
    private final UserRepository userRepository;

    public HabitAutomationService(HabitRepository habitRepository, HabitEntryRepository entryRepository,
                                  SleepSessionRepository sleepSessionRepository, UserRepository userRepository) {
        this.habitRepository = habitRepository;
        this.entryRepository = entryRepository;
        this.sleepSessionRepository = sleepSessionRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void syncDailyActivity(Long userId, LocalDate date, Long steps, Long distanceMeters) {
        syncValue(userId, HabitDataSource.DAILY_ACTIVITY_STEPS, date, toDecimal(steps));
        syncValue(userId, HabitDataSource.DAILY_ACTIVITY_DISTANCE, date, toDecimal(distanceMeters));
    }

    @Transactional
    public void syncSleepDuration(Long userId, LocalDate date) {
        User user = userRepository.findById(userId).orElseThrow();
        ZoneId zone = ZoneId.of(user.getTimezone());
        Instant from = date.atStartOfDay(zone).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(zone).toInstant();
        List<SleepSession> sessions = sleepSessionRepository
                .findAllByUserIdAndEndedAtGreaterThanEqualAndEndedAtLessThan(userId, from, to);

        BigDecimal totalMinutes = sessions.isEmpty() ? null : BigDecimal.valueOf(sessions.stream()
                .mapToLong((@NonNull SleepSession session) -> sleepMinutes(session))
                .sum());
        syncValue(userId, HabitDataSource.SLEEP_DURATION, date, totalMinutes);
    }

    public LocalDate sleepDate(SleepSession session) {
        ZoneId zone = ZoneId.of(session.getUser().getTimezone());
        return session.getEndedAt().atZone(zone).toLocalDate();
    }

    private void syncValue(Long userId, HabitDataSource dataSource, LocalDate date, BigDecimal value) {
        List<Habit> habits = habitRepository.findAllByUserIdAndDataSourceAndStatusOrderByIdAsc(
                userId, dataSource, HabitStatus.ACTIVE);
        for (Habit habit : habits) {
            if (!isScheduled(habit, date)) {
                continue;
            }
            var existing = entryRepository.findByHabitIdAndEntryDate(habit.getId(), date);
            if (value == null) {
                existing.ifPresent((@NonNull HabitEntry entry) -> entryRepository.delete(entry));
                continue;
            }
            HabitEntry entry = existing.orElseGet(() -> new HabitEntry(habit, date, habit.getTargetValue()));
            entry.update(value, false, null);
            entryRepository.save(entry);
        }
    }

    private boolean isScheduled(Habit habit, LocalDate date) {
        if (date.isBefore(habit.getStartDate()) || habit.getEndDate() != null && date.isAfter(habit.getEndDate())) {
            return false;
        }
        return habit.getScheduleType() == HabitScheduleType.DAILY
                || habit.getScheduleDays().contains((short) date.getDayOfWeek().getValue());
    }

    private long sleepMinutes(SleepSession session) {
        long duration = Duration.between(session.getStartedAt(), session.getEndedAt()).toMinutes();
        long awake = session.getAwakeMinutes() == null ? 0 : session.getAwakeMinutes();
        return Math.max(0, duration - awake);
    }

    private BigDecimal toDecimal(Long value) {
        return value == null ? null : BigDecimal.valueOf(value);
    }
}
