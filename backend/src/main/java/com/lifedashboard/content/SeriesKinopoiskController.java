package com.lifedashboard.content;

import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.content.dto.ContentItemResponse;
import com.lifedashboard.content.dto.KinopoiskSeriesCandidate;
import com.lifedashboard.content.dto.KinopoiskSeriesDetails;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/series/kinopoisk")
public class SeriesKinopoiskController {
    private final SeriesKinopoiskService service;

    public SeriesKinopoiskController(SeriesKinopoiskService service) { this.service = service; }

    @GetMapping("/search")
    public List<KinopoiskSeriesCandidate> search(@RequestParam String query) { return service.search(query); }

    @GetMapping("/{filmId}")
    public KinopoiskSeriesDetails preview(@PathVariable long filmId) { return service.preview(filmId); }

    @PostMapping("/{filmId}")
    public ContentItemResponse create(@PathVariable long filmId,
            @Valid @RequestBody ContentItemRequest request) { return service.create(filmId, request); }
}
