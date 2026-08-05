package com.lifedashboard.sleep;

import com.lifedashboard.sleep.dto.SleepSessionRequest;
import com.lifedashboard.sleep.dto.SleepSessionResponse;
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
import java.time.Instant;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Sleep")
@RequestMapping("/api/sleep-sessions")
public class SleepSessionController {

    private final SleepSessionService sessionService;

    public SleepSessionController(SleepSessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping
    public ResponseEntity<SleepSessionResponse> create(@Valid @RequestBody SleepSessionRequest request) {
        SleepSessionResponse response = sessionService.create(request);
        return ResponseEntity.created(URI.create("/api/sleep-sessions/" + response.id())).body(response);
    }

    @GetMapping("/{id}")
    public SleepSessionResponse getById(@PathVariable Long id) {
        return sessionService.getById(id);
    }

    @GetMapping
    public List<SleepSessionResponse> getRange(@RequestParam Instant from, @RequestParam Instant to) {
        return sessionService.getRange(from, to);
    }

    @PutMapping("/{id}")
    public SleepSessionResponse update(@PathVariable Long id, @Valid @RequestBody SleepSessionRequest request) {
        return sessionService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        sessionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
