package com.lifedashboard.activity;

import com.lifedashboard.activity.dto.DailyActivityRequest;
import com.lifedashboard.activity.dto.DailyActivityResponse;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
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
    private final long defaultUserId;

    public DailyActivityService(DailyActivityRepository activityRepository, UserRepository userRepository,
                                @Value("${app.default-user-id}") long defaultUserId) {
        this.activityRepository = activityRepository;
        this.userRepository = userRepository;
        this.defaultUserId = defaultUserId;
    }

    @Transactional
    public DailyActivityResponse put(LocalDate date, DailyActivityRequest request) {
        DailyActivity activity = activityRepository.findByUserIdAndActivityDate(defaultUserId, date)
                .orElseGet(() -> new DailyActivity(findDefaultUser(), date));
        activity.update(request.steps(), request.distanceMeters(), normalizeNullable(request.note()));
        return toResponse(activityRepository.save(activity));
    }

    public DailyActivityResponse getByDate(LocalDate date) {
        return toResponse(findByDate(date));
    }

    public List<DailyActivityResponse> getRange(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new InvalidRequestException("to must not be before from");
        }
        return activityRepository.findAllByUserIdAndActivityDateBetweenOrderByActivityDateAsc(defaultUserId, from, to)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void delete(LocalDate date) {
        activityRepository.delete(findByDate(date));
    }

    private DailyActivity findByDate(LocalDate date) {
        return activityRepository.findByUserIdAndActivityDate(defaultUserId, date)
                .orElseThrow(() -> new ResourceNotFoundException("Daily activity for " + date + " was not found"));
    }

    private User findDefaultUser() {
        return userRepository.findById(defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Default user with id " + defaultUserId + " was not found"));
    }

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private DailyActivityResponse toResponse(DailyActivity activity) {
        return new DailyActivityResponse(activity.getId(), activity.getActivityDate(), activity.getSteps(),
                activity.getDistanceMeters(), activity.getNote());
    }
}
