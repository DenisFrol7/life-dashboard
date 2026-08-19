package com.lifedashboard.calendar;

import com.lifedashboard.calendar.dto.CalendarOccurrenceSummaryResponse;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/calendar/occurrences")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Calendar")
public class CalendarOccurrenceController {
    private final CalendarEventService service;

    public CalendarOccurrenceController(CalendarEventService service) {
        this.service = service;
    }

    @GetMapping
    public List<CalendarOccurrenceSummaryResponse> getAll(@RequestParam LocalDate from,
            @RequestParam LocalDate to) {
        return service.getOccurrences(from, to);
    }
}
