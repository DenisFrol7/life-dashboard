package com.lifedashboard.dashboard;

import com.lifedashboard.dashboard.dto.DashboardResponse;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Dashboard")
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final DashboardService service;
    public DashboardController(DashboardService service) { this.service = service; }
    @GetMapping public DashboardResponse get(@RequestParam(required = false) LocalDate date) {
        return service.get(date);
    }
}
