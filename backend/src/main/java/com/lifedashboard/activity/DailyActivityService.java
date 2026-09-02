package com.lifedashboard.activity;

import org.jspecify.annotations.NonNull;
import com.lifedashboard.activity.dto.DailyActivityRequest;
import com.lifedashboard.activity.dto.DailyActivityResponse;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.habit.HabitAutomationService;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class DailyActivityService {

    private final DailyActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final HabitAutomationService habitAutomationService;
    private final long defaultUserId;

    public DailyActivityService(DailyActivityRepository activityRepository, UserRepository userRepository,
                                HabitAutomationService habitAutomationService,
                                @Value("${app.default-user-id}") long defaultUserId) {
        this.activityRepository = activityRepository;
        this.userRepository = userRepository;
        this.habitAutomationService = habitAutomationService;
        this.defaultUserId = defaultUserId;
    }

    @Transactional
    public DailyActivityResponse put(LocalDate date, DailyActivityRequest request) {
        DailyActivity activity = activityRepository.findByUserIdAndActivityDate(defaultUserId, date)
                .orElseGet(() -> new DailyActivity(findDefaultUser(), date));
        activity.update(request.steps(), request.distanceMeters(), normalizeNullable(request.note()));
        activityRepository.saveAndFlush(activity);
        habitAutomationService.syncDailyActivity(defaultUserId, date, request.steps(), request.distanceMeters());
        return toResponse(activity);
    }

    public DailyActivityResponse getByDate(LocalDate date) {
        return toResponse(findByDate(date));
    }

    public List<DailyActivityResponse> getRange(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new InvalidRequestException("Конец периода не может быть раньше его начала");
        }
        return activityRepository.findAllByUserIdAndActivityDateBetweenOrderByActivityDateAsc(defaultUserId, from, to)
                .stream()
                .map((@NonNull DailyActivity activity) -> toResponse(activity))
                .toList();
    }

    @Transactional
    public void delete(LocalDate date) {
        activityRepository.delete(findByDate(date));
        habitAutomationService.syncDailyActivity(defaultUserId, date, null, null);
    }

    private DailyActivity findByDate(LocalDate date) {
        return activityRepository.findByUserIdAndActivityDate(defaultUserId, date)
                .orElseThrow(() -> new ResourceNotFoundException("Данные об активности за " + date + " не найдены"));
    }

    private User findDefaultUser() {
        return userRepository.findById(defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь с идентификатором " + defaultUserId + " не найден"));
    }

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private DailyActivityResponse toResponse(DailyActivity activity) {
        return new DailyActivityResponse(activity.getId(), activity.getActivityDate(), activity.getSteps(),
                activity.getDistanceMeters(), activity.getNote());
    }
}
