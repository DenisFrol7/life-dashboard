package com.lifedashboard.content;

import com.lifedashboard.content.dto.MovieCatalogResponse;
import com.lifedashboard.content.dto.ContentItemResponse;
import com.lifedashboard.content.dto.ContentItemRequest;
import jakarta.validation.Valid;
import com.lifedashboard.content.dto.KinopoiskMovieCandidate;
import com.lifedashboard.content.dto.KinopoiskMovieDetails;
import com.lifedashboard.content.dto.KinopoiskRatingsPreview;
import com.lifedashboard.content.dto.KinopoiskRatingsImportResult;
import com.lifedashboard.content.dto.KinopoiskMovieEnrichmentResult;
import com.lifedashboard.content.dto.MovieCatalogPageResponse;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Movies")
@RequestMapping("/api/movies")
public class MovieCatalogController {
    private final MovieCatalogService service;
    public MovieCatalogController(MovieCatalogService service) { this.service = service; }
    @GetMapping public List<MovieCatalogResponse> getAll() { return service.getAll(); }
    @GetMapping("/page") public MovieCatalogPageResponse getPage(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) UserContentStatus status) {
        return service.getPage(page, size, query, status);
    }
    @GetMapping("/kinopoisk/search") public List<KinopoiskMovieCandidate> searchKinopoisk(@RequestParam String query) { return service.searchKinopoisk(query); }
    @GetMapping("/kinopoisk/{filmId}") public KinopoiskMovieDetails previewKinopoisk(@PathVariable long filmId) { return service.previewKinopoisk(filmId); }
    @PostMapping("/kinopoisk/{filmId}") public ContentItemResponse createFromKinopoisk(@PathVariable long filmId,
            @Valid @RequestBody ContentItemRequest request) { return service.createFromKinopoisk(filmId, request); }
    @GetMapping("/kinopoisk/profile/{profileId}/ratings")
    public KinopoiskRatingsPreview previewRatings(@PathVariable String profileId) {
        return service.previewRatings(profileId);
    }
    @PostMapping("/kinopoisk/profile/{profileId}/ratings/import")
    public KinopoiskRatingsImportResult importRatings(@PathVariable String profileId) {
        return service.importRatings(profileId);
    }
    @PostMapping("/kinopoisk/enrich")
    public KinopoiskMovieEnrichmentResult enrich(@RequestParam(defaultValue = "350") int batchSize) {
        return service.enrichMovies(batchSize);
    }
}
