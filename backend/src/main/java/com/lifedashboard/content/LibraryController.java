package com.lifedashboard.content;

import com.lifedashboard.content.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/library")
public class LibraryController {
    private final ContentService service;
    public LibraryController(ContentService service) { this.service = service; }
    @GetMapping public List<LibraryEntryResponse> getAll(@RequestParam(required = false) UserContentStatus status) {
        return service.getLibrary(status);
    }
    @PutMapping("/{contentId}") public LibraryEntryResponse put(@PathVariable Long contentId,
            @Valid @RequestBody LibraryEntryRequest request) { return service.putInLibrary(contentId, request); }
    @DeleteMapping("/{contentId}") public ResponseEntity<Void> remove(@PathVariable Long contentId) {
        service.removeFromLibrary(contentId); return ResponseEntity.noContent().build();
    }
}
