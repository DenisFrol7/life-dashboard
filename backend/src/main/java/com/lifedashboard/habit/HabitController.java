package com.lifedashboard.habit;

import com.lifedashboard.habit.dto.HabitEntryRequest;
import com.lifedashboard.habit.dto.HabitEntryResponse;
import com.lifedashboard.habit.dto.DatedHabitEntryResponse;
import com.lifedashboard.habit.dto.HabitRequest;
import com.lifedashboard.habit.dto.HabitResponse;
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
@io.swagger.v3.oas.annotations.tags.Tag(name = "Habits")
@RequestMapping("/api/habits")
public class HabitController {

    private final HabitService habitService;

    public HabitController(HabitService habitService) {
        this.habitService = habitService;
    }

    @PostMapping
    public ResponseEntity<HabitResponse> create(@Valid @RequestBody HabitRequest request) {
        HabitResponse response = habitService.create(request);
        return ResponseEntity.created(URI.create("/api/habits/" + response.id())).body(response);
    }

    @GetMapping
    public List<HabitResponse> getAll(@RequestParam(required = false) HabitStatus status) {
        return habitService.getAll(status);
    }

    @GetMapping("/{id}")
    public HabitResponse getById(@PathVariable Long id) {
        return habitService.getById(id);
    }

    @PutMapping("/{id}")
    public HabitResponse update(@PathVariable Long id, @Valid @RequestBody HabitRequest request) {
        return habitService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        habitService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/entries/{date}")
    public HabitEntryResponse putEntry(
            @PathVariable Long id,
            @PathVariable LocalDate date,
            @Valid @RequestBody HabitEntryRequest request
    ) {
        return habitService.putEntry(id, date, request);
    }

    @GetMapping("/{id}/entries")
    public List<HabitEntryResponse> getEntries(@PathVariable Long id) {
        return habitService.getEntries(id);
    }

    @GetMapping("/entries")
    public List<DatedHabitEntryResponse> getEntries(@RequestParam LocalDate date) {
        return habitService.getEntries(date);
    }

    @DeleteMapping("/{id}/entries/{date}")
    public ResponseEntity<Void> deleteEntry(@PathVariable Long id, @PathVariable LocalDate date) {
        habitService.deleteEntry(id, date);
        return ResponseEntity.noContent().build();
    }
}
