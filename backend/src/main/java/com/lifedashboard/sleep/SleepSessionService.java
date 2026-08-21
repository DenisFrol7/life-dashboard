package com.lifedashboard.sleep;

import org.jspecify.annotations.NonNull;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.habit.HabitAutomationService;
import com.lifedashboard.sleep.dto.SleepSessionRequest;
import com.lifedashboard.sleep.dto.SleepSessionResponse;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class SleepSessionService {

    private final SleepSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final HabitAutomationService habitAutomationService;
    private final long defaultUserId;

    public SleepSessionService(SleepSessionRepository sessionRepository, UserRepository userRepository,
                               HabitAutomationService habitAutomationService,
                               @Value("${app.default-user-id}") long defaultUserId) {
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.habitAutomationService = habitAutomationService;
        this.defaultUserId = defaultUserId;
    }

    @Transactional
    public SleepSessionResponse create(SleepSessionRequest request) {
        validateSession(request);
        User user = userRepository.findById(defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Default user with id " + defaultUserId + " was not found"));
        SleepSession session = new SleepSession(user);
        apply(session, request);
        sessionRepository.saveAndFlush(session);
        habitAutomationService.syncSleepDuration(defaultUserId, habitAutomationService.sleepDate(session));
        return toResponse(session);
    }

    public SleepSessionResponse getById(Long id) {
        return toResponse(findSession(id));
    }

    public List<SleepSessionResponse> getRange(Instant from, Instant to) {
        if (!to.isAfter(from)) {
            throw new InvalidRequestException("to must be after from");
        }
        return sessionRepository.findOverlapping(defaultUserId, from, to).stream()
                .map((@NonNull SleepSession session) -> toResponse(session))
                .toList();
    }

    @Transactional
    public SleepSessionResponse update(Long id, SleepSessionRequest request) {
        validateSession(request);
        SleepSession session = findSession(id);
        LocalDate previousDate = habitAutomationService.sleepDate(session);
        apply(session, request);
        sessionRepository.saveAndFlush(session);
        LocalDate currentDate = habitAutomationService.sleepDate(session);
        habitAutomationService.syncSleepDuration(defaultUserId, previousDate);
        if (!currentDate.equals(previousDate)) {
            habitAutomationService.syncSleepDuration(defaultUserId, currentDate);
        }
        return toResponse(session);
    }

    @Transactional
    public void delete(Long id) {
        SleepSession session = findSession(id);
        LocalDate date = habitAutomationService.sleepDate(session);
        sessionRepository.delete(session);
        sessionRepository.flush();
        habitAutomationService.syncSleepDuration(defaultUserId, date);
    }

    private SleepSession findSession(Long id) {
        return sessionRepository.findByIdAndUserId(id, defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Sleep session with id " + id + " was not found"));
    }

    private void validateSession(SleepSessionRequest request) {
        if (!request.endedAt().isAfter(request.startedAt())) {
            throw new InvalidRequestException("endedAt must be after startedAt");
        }
        long durationMinutes = Duration.between(request.startedAt(), request.endedAt()).toMinutes();
        long sleepStageMinutes = nullableMinutes(request.deepSleepMinutes())
                + nullableMinutes(request.lightSleepMinutes())
                + nullableMinutes(request.remSleepMinutes())
                + nullableMinutes(request.awakeMinutes());
        if (sleepStageMinutes > durationMinutes) {
            throw new InvalidRequestException("Sleep stages must not exceed the session duration");
        }
    }

    private long nullableMinutes(Integer value) {
        return value == null ? 0 : value;
    }

    private void apply(SleepSession session, SleepSessionRequest request) {
        Short qualityRating = request.qualityRating() == null ? null : request.qualityRating().shortValue();
        session.update(request.startedAt(), request.endedAt(), request.deepSleepMinutes(), request.lightSleepMinutes(),
                request.remSleepMinutes(), request.awakeMinutes(), qualityRating, normalizeNullable(request.note()));
    }

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private SleepSessionResponse toResponse(SleepSession session) {
        Integer qualityRating = session.getQualityRating() == null ? null : session.getQualityRating().intValue();
        return new SleepSessionResponse(session.getId(), session.getStartedAt(), session.getEndedAt(),
                session.getDeepSleepMinutes(), session.getLightSleepMinutes(), session.getRemSleepMinutes(),
                session.getAwakeMinutes(), qualityRating, session.getNote());
    }
}
