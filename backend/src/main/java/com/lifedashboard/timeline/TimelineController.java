package com.lifedashboard.timeline;

import com.lifedashboard.timeline.dto.TimelineItemResponse;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/timeline")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Timeline")
public class TimelineController {
    private final TimelineService service;
    public TimelineController(TimelineService service) { this.service = service; }
    @GetMapping public List<TimelineItemResponse> get(@RequestParam(required = false) LocalDate date) {
        return service.get(date);
    }
}
