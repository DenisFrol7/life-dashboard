package com.lifedashboard.game;

import com.lifedashboard.game.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Game playthroughs")
@RequestMapping("/api/games")
public class GamePlaythroughController {
    private final GamePlaythroughService service;
    public GamePlaythroughController(GamePlaythroughService service) { this.service = service; }
    @GetMapping("/library/{libraryId}/playthroughs")
    public List<GamePlaythroughResponse> getAll(@PathVariable Long libraryId) { return service.getAll(libraryId); }
    @PostMapping("/library/{libraryId}/playthroughs")
    public ResponseEntity<GamePlaythroughResponse> create(@PathVariable Long libraryId,
            @Valid @RequestBody GamePlaythroughRequest request) {
        GamePlaythroughResponse result = service.create(libraryId, request);
        return ResponseEntity.created(URI.create("/api/games/playthroughs/" + result.id())).body(result);
    }
    @PutMapping("/playthroughs/{id}")
    public GamePlaythroughResponse update(@PathVariable Long id,
            @Valid @RequestBody GamePlaythroughRequest request) {
        return service.update(id, request);
    }
    @DeleteMapping("/playthroughs/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id); return ResponseEntity.noContent().build();
    }
}
