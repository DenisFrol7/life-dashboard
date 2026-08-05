package com.lifedashboard.dashboard;

import com.lifedashboard.dashboard.dto.DashboardResponse;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final DashboardService service;
    public DashboardController(DashboardService service) { this.service = service; }
    @GetMapping public DashboardResponse get(@RequestParam(required = false) LocalDate date) {
        return service.get(date);
    }
}
