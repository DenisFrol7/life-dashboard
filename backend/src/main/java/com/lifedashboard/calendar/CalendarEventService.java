package com.lifedashboard.calendar;

import com.lifedashboard.calendar.dto.CalendarEventRequest;
import com.lifedashboard.calendar.dto.CalendarEventResponse;
import com.lifedashboard.calendar.dto.OccurrenceRequest;
import com.lifedashboard.calendar.dto.OccurrenceResponse;
import com.lifedashboard.calendar.dto.CalendarOccurrenceSummaryResponse;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class CalendarEventService {

    private final CalendarEventRepository eventRepository;
    private final CalendarEventOccurrenceRepository occurrenceRepository;
    private final UserRepository userRepository;
    private final long defaultUserId;

    public CalendarEventService(CalendarEventRepository eventRepository,
                                CalendarEventOccurrenceRepository occurrenceRepository,
                                UserRepository userRepository,
                                @Value("${app.default-user-id}") long defaultUserId) {
        this.eventRepository = eventRepository;
        this.occurrenceRepository = occurrenceRepository;
        this.userRepository = userRepository;
        this.defaultUserId = defaultUserId;
    }

    @Transactional
    public CalendarEventResponse create(CalendarEventRequest request) {
        validate(request);
        User user = userRepository.findById(defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Default user with id " + defaultUserId + " was not found"));
        CalendarEvent event = new CalendarEvent(user);
        apply(event, request);
        return toResponse(eventRepository.save(event));
    }

    public CalendarEventResponse getById(Long id) {
        return toResponse(findEvent(id));
    }

    public List<CalendarEventResponse> getAll(EventType eventType, CalendarEventStatus status) {
        return eventRepository.findAllByUserIdOrderByStartDateAscIdAsc(defaultUserId).stream()
                .filter(event -> eventType == null || event.getEventType() == eventType)
                .filter(event -> status == null || event.getStatus() == status)
                .map((@NonNull CalendarEvent event) -> toResponse(event))
                .toList();
    }

    @Transactional
    public CalendarEventResponse update(Long id, CalendarEventRequest request) {
        validate(request);
        CalendarEvent event = findEvent(id);
        apply(event, request);
        return toResponse(eventRepository.save(event));
    }

    @Transactional
    public void delete(Long id) {
        eventRepository.delete(findEvent(id));
    }

    @Transactional
    public OccurrenceResponse putOccurrence(Long eventId, LocalDate date, OccurrenceRequest request) {
        CalendarEvent event = findEvent(eventId);
        if (date.isBefore(event.getStartDate()) || event.getRepeatUntil() != null && date.isAfter(event.getRepeatUntil())) {
            throw new InvalidRequestException("Occurrence date is outside the event date range");
        }
        CalendarEventOccurrence occurrence = occurrenceRepository
                .findByEventIdAndOccurrenceDate(eventId, date)
                .orElseGet(() -> new CalendarEventOccurrence(event, date));
        Instant completedAt = request.status() == OccurrenceStatus.COMPLETED
                ? request.completedAt() == null ? Instant.now() : request.completedAt()
                : null;
        occurrence.update(request.status(), completedAt, normalizeNullable(request.note()));
        return toResponse(occurrenceRepository.save(occurrence));
    }

    public List<OccurrenceResponse> getOccurrences(Long eventId) {
        findEvent(eventId);
        return occurrenceRepository.findAllByEventIdOrderByOccurrenceDateAsc(eventId).stream()
                .map((@NonNull CalendarEventOccurrence occurrence) -> toResponse(occurrence))
                .toList();
    }

    public List<CalendarOccurrenceSummaryResponse> getOccurrences(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) throw new InvalidRequestException("to must not be before from");
        return occurrenceRepository
                .findAllByEventUserIdAndOccurrenceDateBetweenOrderByOccurrenceDateAsc(defaultUserId, from, to)
                .stream().map(occurrence -> new CalendarOccurrenceSummaryResponse(
                        occurrence.getEvent().getId(), toResponse(occurrence))).toList();
    }

    @Transactional
    public void deleteOccurrence(Long eventId, LocalDate date) {
        findEvent(eventId);
        CalendarEventOccurrence occurrence = occurrenceRepository.findByEventIdAndOccurrenceDate(eventId, date)
                .orElseThrow(() -> new ResourceNotFoundException("Occurrence for " + date + " was not found"));
        occurrenceRepository.delete(occurrence);
    }

    private CalendarEvent findEvent(Long id) {
        return eventRepository.findByIdAndUserId(id, defaultUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar event with id " + id + " was not found"));
    }

    private void apply(CalendarEvent event, CalendarEventRequest request) {
        Set<Short> days = new LinkedHashSet<>();
        if (request.scheduleDays() != null) {
            request.scheduleDays().stream().sorted()
                    .map((@NonNull Integer day) -> day.shortValue())
                    .forEach((@NonNull Short day) -> days.add(day));
        }
        event.update(request.title().trim(), normalizeNullable(request.description()), request.eventType(),
                request.scheduleType(), request.startDate(), request.repeatUntil(), request.startTime(),
                request.endTime(), request.allDay(), normalizeNullable(request.location()), request.status(), days);
    }

    private void validate(CalendarEventRequest request) {
        if (request.repeatUntil() != null && request.repeatUntil().isBefore(request.startDate())) {
            throw new InvalidRequestException("repeatUntil must not be before startDate");
        }
        if (request.endTime() != null && request.startTime() != null && !request.endTime().isAfter(request.startTime())) {
            throw new InvalidRequestException("endTime must be after startTime");
        }
        if (request.allDay() && (request.startTime() != null || request.endTime() != null)) {
            throw new InvalidRequestException("All-day events must not contain startTime or endTime");
        }
        boolean hasDays = request.scheduleDays() != null && !request.scheduleDays().isEmpty();
        if (request.scheduleType() == ScheduleType.SELECTED_DAYS && !hasDays) {
            throw new InvalidRequestException("scheduleDays are required for SELECTED_DAYS");
        }
        if (request.scheduleType() != ScheduleType.SELECTED_DAYS && hasDays) {
            throw new InvalidRequestException("scheduleDays are only allowed for SELECTED_DAYS");
        }
    }

    private String normalizeNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private CalendarEventResponse toResponse(CalendarEvent event) {
        Set<Integer> days = new LinkedHashSet<>();
        event.getScheduleDays().stream().sorted()
                .map((@NonNull Short day) -> day.intValue())
                .forEach((@NonNull Integer day) -> days.add(day));
        return new CalendarEventResponse(event.getId(), event.getTitle(), event.getDescription(), event.getEventType(),
                event.getScheduleType(), event.getStartDate(), event.getRepeatUntil(), event.getStartTime(),
                event.getEndTime(), event.isAllDay(), event.getLocation(), event.getStatus(), days);
    }

    private OccurrenceResponse toResponse(CalendarEventOccurrence occurrence) {
        return new OccurrenceResponse(occurrence.getId(), occurrence.getOccurrenceDate(), occurrence.getStatus(),
                occurrence.getCompletedAt(), occurrence.getNote());
    }
}
