package com.lifedashboard.game.rawg;

import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.content.dto.ContentItemResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/games/rawg")
public class RawgCatalogController {
    private final RawgCatalogService service;

    public RawgCatalogController(RawgCatalogService service) { this.service = service; }

    @GetMapping("/search")
    public List<RawgGameCandidate> search(@RequestParam String query) { return service.search(query); }

    @GetMapping("/{rawgId}")
    public RawgGameDetails preview(@PathVariable long rawgId) { return service.preview(rawgId); }

    @PostMapping("/{rawgId}")
    public ContentItemResponse create(@PathVariable long rawgId,
            @Valid @RequestBody ContentItemRequest request) { return service.create(rawgId, request); }

    @PutMapping("/{rawgId}/content/{contentId}")
    public ContentItemResponse update(@PathVariable long rawgId, @PathVariable long contentId,
            @Valid @RequestBody ContentItemRequest request) { return service.update(contentId, rawgId, request); }
}
