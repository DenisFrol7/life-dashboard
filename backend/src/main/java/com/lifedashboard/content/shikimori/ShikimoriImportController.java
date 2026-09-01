package com.lifedashboard.content.shikimori;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/anime/shikimori")
public class ShikimoriImportController {
    private final ShikimoriImportService service;
    private final ShikimoriCatalogService catalog;
    public ShikimoriImportController(ShikimoriImportService service, ShikimoriCatalogService catalog) {
        this.service = service; this.catalog = catalog;
    }

    @GetMapping("/search")
    public java.util.List<ShikimoriAnimeCandidate> search(@RequestParam String query) { return catalog.search(query); }

    @GetMapping("/{id}")
    public ShikimoriAnimeDetails previewAnime(@PathVariable long id) { return catalog.preview(id); }

    @PostMapping("/{id}")
    public com.lifedashboard.content.dto.AnimeDetailsResponse createAnime(@PathVariable long id,
            @jakarta.validation.Valid @RequestBody com.lifedashboard.content.dto.AnimeRequest request) {
        return catalog.create(id, request);
    }

    @PostMapping("/preview")
    public ShikimoriImportPreview preview(@RequestPart("file") MultipartFile file) { return service.preview(file); }

    @PostMapping("/import/{token}")
    public ShikimoriImportResult importData(@PathVariable String token) { return service.importData(token); }
}
