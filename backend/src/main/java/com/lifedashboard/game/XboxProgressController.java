package com.lifedashboard.game;

import com.lifedashboard.game.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/games/library/{libraryEntryId}/xbox-progress")
public class XboxProgressController {
    private final XboxProgressService service;
    public XboxProgressController(XboxProgressService service) { this.service = service; }
    @PutMapping public XboxProgressResponse put(@PathVariable Long libraryEntryId,
            @Valid @RequestBody XboxProgressRequest request) { return service.put(libraryEntryId, request); }
    @GetMapping public XboxProgressResponse get(@PathVariable Long libraryEntryId) {
        return service.get(libraryEntryId);
    }
    @DeleteMapping public ResponseEntity<Void> delete(@PathVariable Long libraryEntryId) {
        service.delete(libraryEntryId); return ResponseEntity.noContent().build();
    }
}
