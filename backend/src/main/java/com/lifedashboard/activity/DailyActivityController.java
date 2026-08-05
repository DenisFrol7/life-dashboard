package com.lifedashboard.activity;

import com.lifedashboard.activity.dto.DailyActivityRequest;
import com.lifedashboard.activity.dto.DailyActivityResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Activity")
@RequestMapping("/api/daily-activity")
public class DailyActivityController {

    private final DailyActivityService activityService;

    public DailyActivityController(DailyActivityService activityService) {
        this.activityService = activityService;
    }

    @PutMapping("/{date}")
    public DailyActivityResponse put(
            @PathVariable LocalDate date,
            @Valid @RequestBody DailyActivityRequest request
    ) {
        return activityService.put(date, request);
    }

    @GetMapping("/{date}")
    public DailyActivityResponse getByDate(@PathVariable LocalDate date) {
        return activityService.getByDate(date);
    }

    @GetMapping
    public List<DailyActivityResponse> getRange(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        return activityService.getRange(from, to);
    }

    @DeleteMapping("/{date}")
    public ResponseEntity<Void> delete(@PathVariable LocalDate date) {
        activityService.delete(date);
        return ResponseEntity.noContent().build();
    }
}
