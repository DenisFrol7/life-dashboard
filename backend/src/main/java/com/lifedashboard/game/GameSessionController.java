package com.lifedashboard.game;

import com.lifedashboard.game.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.time.Instant;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Game sessions")
@RequestMapping("/api/games")
public class GameSessionController {
    private final GameSessionService service;
    public GameSessionController(GameSessionService service) { this.service = service; }
    @GetMapping("/sessions")
    public List<GameSessionResponse> getAll(@RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to) { return service.getAll(from, to); }
    @PostMapping("/library/{libraryId}/sessions")
    public ResponseEntity<GameSessionResponse> create(@PathVariable Long libraryId,
            @Valid @RequestBody GameSessionRequest request) {
        GameSessionResponse result = service.create(libraryId, request);
        return ResponseEntity.created(URI.create("/api/games/sessions/" + result.id())).body(result);
    }
    @PutMapping("/sessions/{id}")
    public GameSessionResponse update(@PathVariable Long id, @Valid @RequestBody GameSessionRequest request) {
        return service.update(id, request);
    }
    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id); return ResponseEntity.noContent().build();
    }
}
