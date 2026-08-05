package com.lifedashboard.content;

import com.lifedashboard.content.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/content")
public class ContentController {
    private final ContentService service;
    public ContentController(ContentService service) { this.service = service; }
    @PostMapping public ResponseEntity<ContentItemResponse> create(@Valid @RequestBody ContentItemRequest request) {
        ContentItemResponse response = service.create(request);
        return ResponseEntity.created(URI.create("/api/content/" + response.id())).body(response);
    }
    @GetMapping public List<ContentItemResponse> getAll(@RequestParam(required = false) ContentType type) {
        return service.getAll(type);
    }
    @GetMapping("/{id}") public ContentItemResponse get(@PathVariable Long id) { return service.get(id); }
    @PutMapping("/{id}") public ContentItemResponse update(@PathVariable Long id,
            @Valid @RequestBody ContentItemRequest request) { return service.update(id, request); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id); return ResponseEntity.noContent().build();
    }
}
