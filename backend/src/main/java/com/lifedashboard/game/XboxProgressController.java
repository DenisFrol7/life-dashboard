package com.lifedashboard.game;

import com.lifedashboard.game.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Games")
@RequestMapping("/api/games/library/{libraryEntryId}/xbox-progress")
public class XboxProgressController {
    private final XboxProgressService service;
    private final XboxProgressSyncService syncService;
    public XboxProgressController(XboxProgressService service, XboxProgressSyncService syncService) {
        this.service = service;
        this.syncService = syncService;
    }
    @PutMapping public XboxProgressResponse put(@PathVariable Long libraryEntryId,
            @Valid @RequestBody XboxProgressRequest request) { return service.put(libraryEntryId, request); }
    @GetMapping public XboxProgressResponse get(@PathVariable Long libraryEntryId) {
        return service.get(libraryEntryId);
    }
    @PostMapping("/sync") public XboxProgressSyncResponse sync(@PathVariable Long libraryEntryId) {
        return syncService.sync(libraryEntryId);
    }
    @DeleteMapping public ResponseEntity<Void> delete(@PathVariable Long libraryEntryId) {
        service.delete(libraryEntryId); return ResponseEntity.noContent().build();
    }
}
