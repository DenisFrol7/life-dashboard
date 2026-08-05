package com.lifedashboard.calendar;

import com.lifedashboard.calendar.dto.CalendarEventRequest;
import com.lifedashboard.calendar.dto.CalendarEventResponse;
import com.lifedashboard.calendar.dto.OccurrenceRequest;
import com.lifedashboard.calendar.dto.OccurrenceResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Calendar")
@RequestMapping("/api/calendar/events")
public class CalendarEventController {

    private final CalendarEventService eventService;

    public CalendarEventController(CalendarEventService eventService) {
        this.eventService = eventService;
    }

    @PostMapping
    public ResponseEntity<CalendarEventResponse> create(@Valid @RequestBody CalendarEventRequest request) {
        CalendarEventResponse response = eventService.create(request);
        return ResponseEntity.created(URI.create("/api/calendar/events/" + response.id())).body(response);
    }

    @GetMapping
    public List<CalendarEventResponse> getAll(
            @RequestParam(required = false) EventType eventType,
            @RequestParam(required = false) CalendarEventStatus status
    ) {
        return eventService.getAll(eventType, status);
    }

    @GetMapping("/{id}")
    public CalendarEventResponse getById(@PathVariable Long id) {
        return eventService.getById(id);
    }

    @PutMapping("/{id}")
    public CalendarEventResponse update(@PathVariable Long id, @Valid @RequestBody CalendarEventRequest request) {
        return eventService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        eventService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/occurrences/{date}")
    public OccurrenceResponse putOccurrence(
            @PathVariable Long id,
            @PathVariable LocalDate date,
            @Valid @RequestBody OccurrenceRequest request
    ) {
        return eventService.putOccurrence(id, date, request);
    }

    @GetMapping("/{id}/occurrences")
    public List<OccurrenceResponse> getOccurrences(@PathVariable Long id) {
        return eventService.getOccurrences(id);
    }

    @DeleteMapping("/{id}/occurrences/{date}")
    public ResponseEntity<Void> deleteOccurrence(@PathVariable Long id, @PathVariable LocalDate date) {
        eventService.deleteOccurrence(id, date);
        return ResponseEntity.noContent().build();
    }
}
