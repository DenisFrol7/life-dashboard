package com.lifedashboard.game;

import com.lifedashboard.content.UserContentStatus;
import com.lifedashboard.game.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/games")
public class GameLibraryController {
    private final GameLibraryService service;
    public GameLibraryController(GameLibraryService service) { this.service = service; }
    @GetMapping("/platforms") public List<ReferenceResponse> platforms() { return service.platforms(); }
    @GetMapping("/sources") public List<ReferenceResponse> sources() { return service.sources(); }
    @PostMapping("/library/{contentId}")
    public ResponseEntity<GameLibraryResponse> create(@PathVariable Long contentId,
            @Valid @RequestBody GameLibraryRequest request) {
        GameLibraryResponse result = service.create(contentId, request);
        return ResponseEntity.created(URI.create("/api/games/library/" + result.id())).body(result);
    }
    @GetMapping("/library") public List<GameLibraryResponse> getAll(
            @RequestParam(required = false) UserContentStatus status,
            @RequestParam(required = false) Long platformId) { return service.getAll(status, platformId); }
    @GetMapping("/library/{id}") public GameLibraryResponse get(@PathVariable Long id) { return service.get(id); }
    @PutMapping("/library/{id}") public GameLibraryResponse update(@PathVariable Long id,
            @Valid @RequestBody GameLibraryRequest request) { return service.update(id, request); }
    @DeleteMapping("/library/{id}") public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id); return ResponseEntity.noContent().build();
    }
}
