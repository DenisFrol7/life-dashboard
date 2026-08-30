package com.lifedashboard.content;

import com.lifedashboard.content.dto.MovieCatalogResponse;
import com.lifedashboard.content.dto.ContentItemResponse;
import com.lifedashboard.content.dto.ContentItemRequest;
import jakarta.validation.Valid;
import com.lifedashboard.content.dto.KinopoiskMovieCandidate;
import com.lifedashboard.content.dto.KinopoiskMovieDetails;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Movies")
@RequestMapping("/api/movies")
public class MovieCatalogController {
    private final MovieCatalogService service;
    public MovieCatalogController(MovieCatalogService service) { this.service = service; }
    @GetMapping public List<MovieCatalogResponse> getAll() { return service.getAll(); }
    @GetMapping("/kinopoisk/search") public List<KinopoiskMovieCandidate> searchKinopoisk(@RequestParam String query) { return service.searchKinopoisk(query); }
    @GetMapping("/kinopoisk/{filmId}") public KinopoiskMovieDetails previewKinopoisk(@PathVariable long filmId) { return service.previewKinopoisk(filmId); }
    @PostMapping("/kinopoisk/{filmId}") public ContentItemResponse createFromKinopoisk(@PathVariable long filmId,
            @Valid @RequestBody ContentItemRequest request) { return service.createFromKinopoisk(filmId, request); }
}
