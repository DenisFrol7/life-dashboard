package com.lifedashboard.habit;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.habit.dto.HabitEntryRequest;
import com.lifedashboard.habit.dto.HabitEntryResponse;
import com.lifedashboard.habit.dto.DatedHabitEntryResponse;
import com.lifedashboard.habit.dto.HabitRequest;
import com.lifedashboard.habit.dto.HabitResponse;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import jakarta.persistence.EntityManager;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class HabitService {

    private final HabitRepository habitRepository;
    private final HabitEntryRepository entryRepository;
    private final UserRepository userRepository;
    private final EntityManager entityManager;
    private final long defaultUserId;

    public HabitService(HabitRepository habitRepository, HabitEntryRepository entryRepository,
                        UserRepository userRepository, EntityManager entityManager,
                        @Value("${app.default-user-id}") long defaultUserId) {
        this.habitRepository = habitRepository;
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
        this.entityManager = entityManager;
        this.defaultUserId = defaultUserId;
    }

    @Transactional
    public HabitResponse create(HabitRequest request) {
        validateHabit(request);
        User user = userRepository.findById(defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Default user with id " + defaultUserId + " was not found"));
        Habit habit = new Habit(user);
        apply(habit, request);
        return toResponse(habitRepository.save(habit));
    }

    public HabitResponse getById(Long id) {
        return toResponse(findHabit(id));
    }

    public List<HabitResponse> getAll(HabitStatus status) {
        return habitRepository.findAllByUserIdOrderByStartDateAscIdAsc(defaultUserId).stream()
                .filter(habit -> status == null || habit.getStatus() == status)
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public HabitResponse update(Long id, HabitRequest request) {
        validateHabit(request);
        Habit habit = findHabit(id);
        apply(habit, request);
        return toResponse(habitRepository.save(habit));
    }

    @Transactional
    public void delete(Long id) {
        habitRepository.delete(findHabit(id));
    }

    @Transactional
    public HabitEntryResponse putEntry(Long habitId, LocalDate date, HabitEntryRequest request) {
        Habit habit = findHabit(habitId);
        if (date.isBefore(habit.getStartDate()) || habit.getEndDate() != null && date.isAfter(habit.getEndDate())) {
            throw new InvalidRequestException("Entry date is outside the habit date range");
        }
        validateEntry(habit, request);
        HabitEntry entry = entryRepository.findByHabitIdAndEntryDate(habitId, date)
                .orElseGet(() -> new HabitEntry(habit, date, habit.getTargetValue()));
        entry.update(request.skipped() ? null : request.value(), request.skipped(), normalizeNullable(request.note()));
        entryRepository.saveAndFlush(entry);
        entityManager.refresh(entry);
        return toResponse(entry);
    }

    public List<HabitEntryResponse> getEntries(Long habitId) {
        findHabit(habitId);
        return entryRepository.findAllByHabitIdOrderByEntryDateAsc(habitId).stream()
                .map(this::toResponse)
                .toList();
    }

    public List<DatedHabitEntryResponse> getEntries(LocalDate date) {
        return entryRepository.findAllByHabitUserIdAndEntryDate(defaultUserId, date).stream()
                .map(entry -> new DatedHabitEntryResponse(entry.getHabit().getId(), toResponse(entry))).toList();
    }

    @Transactional
    public void deleteEntry(Long habitId, LocalDate date) {
        findHabit(habitId);
        HabitEntry entry = entryRepository.findByHabitIdAndEntryDate(habitId, date)
                .orElseThrow(() -> new ResourceNotFoundException("Habit entry for " + date + " was not found"));
        entryRepository.delete(entry);
    }

    private Habit findHabit(Long id) {
        return habitRepository.findByIdAndUserId(id, defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Habit with id " + id + " was not found"));
    }

    private void validateHabit(HabitRequest request) {
        if (request.endDate() != null && request.endDate().isBefore(request.startDate())) {
            throw new InvalidRequestException("endDate must not be before startDate");
        }
        boolean hasDays = request.scheduleDays() != null && !request.scheduleDays().isEmpty();
        if (request.scheduleType() == HabitScheduleType.SELECTED_DAYS && !hasDays) {
            throw new InvalidRequestException("scheduleDays are required for SELECTED_DAYS");
        }
        if (request.scheduleType() != HabitScheduleType.SELECTED_DAYS && hasDays) {
            throw new InvalidRequestException("scheduleDays are only allowed for SELECTED_DAYS");
        }
    }

    private void validateEntry(Habit habit, HabitEntryRequest request) {
        if (request.skipped() && request.value() != null) {
            throw new InvalidRequestException("Skipped entries must not contain a value");
        }
        if (!request.skipped() && request.value() == null) {
            throw new InvalidRequestException("A non-skipped entry must contain a value");
        }
        if (!request.skipped() && habit.getTrackingType() == TrackingType.BOOLEAN
                && request.value().compareTo(BigDecimal.ZERO) != 0
                && request.value().compareTo(BigDecimal.ONE) != 0) {
            throw new InvalidRequestException("BOOLEAN habit values must be 0 or 1");
        }
    }

    private void apply(Habit habit, HabitRequest request) {
        Set<Short> days = new LinkedHashSet<>();
        if (request.scheduleDays() != null) {
            request.scheduleDays().stream().sorted()
                    .map((@NonNull Integer day) -> day.shortValue())
                    .forEach((@NonNull Short day) -> days.add(day));
        }
        habit.update(request.name().trim(), normalizeNullable(request.description()), request.trackingType(),
                request.dataSource(), request.targetValue(), normalizeNullable(request.unit()), request.scheduleType(),
                request.startDate(), request.endDate(), request.status(), days);
    }

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private HabitResponse toResponse(Habit habit) {
        Set<Integer> days = new LinkedHashSet<>();
        habit.getScheduleDays().stream().sorted()
                .map((@NonNull Short day) -> day.intValue())
                .forEach((@NonNull Integer day) -> days.add(day));
        return new HabitResponse(habit.getId(), habit.getName(), habit.getDescription(), habit.getTrackingType(),
                habit.getDataSource(), habit.getTargetValue(), habit.getUnit(), habit.getScheduleType(),
                habit.getStartDate(), habit.getEndDate(), habit.getStatus(), days);
    }

    private HabitEntryResponse toResponse(HabitEntry entry) {
        return new HabitEntryResponse(entry.getId(), entry.getEntryDate(), entry.getValue(),
                entry.getTargetValueSnapshot(), entry.isSkipped(), entry.getNote(), entry.getRecordedAt());
    }
}
