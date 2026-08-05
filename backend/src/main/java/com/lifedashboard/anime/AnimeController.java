package com.lifedashboard.anime;

import com.lifedashboard.anime.dto.*;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.LibraryEntryRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/anime")
public class AnimeController {
    private final AnimeService service;
    private final ViewingService viewingService;

    public AnimeController(AnimeService service, ViewingService viewingService) {
        this.service = service; this.viewingService = viewingService;
    }
    @PostMapping
    public ResponseEntity<AnimeDetailsResponse> create(@Valid @RequestBody AnimeRequest request) {
        AnimeDetailsResponse result = service.create(request);
        return ResponseEntity.created(URI.create("/api/anime/" + result.id())).body(result);
    }
    @GetMapping
    public List<AnimeSummaryResponse> getAll(@RequestParam(required = false) ReleaseStatus releaseStatus,
            @RequestParam(required = false) UserContentStatus status) {
        return service.getAll(releaseStatus, status);
    }
    @GetMapping("/{id}") public AnimeDetailsResponse get(@PathVariable Long id) { return service.get(id); }
    @PutMapping("/{id}") public AnimeDetailsResponse update(@PathVariable Long id,
            @Valid @RequestBody AnimeRequest request) { return service.update(id, request); }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id); return ResponseEntity.noContent().build();
    }
    @PutMapping("/{id}/library") public AnimeDetailsResponse putInLibrary(@PathVariable Long id,
            @Valid @RequestBody LibraryEntryRequest request) { return service.putInLibrary(id, request); }
    @DeleteMapping("/{id}/library") public ResponseEntity<Void> removeFromLibrary(@PathVariable Long id) {
        service.removeFromLibrary(id); return ResponseEntity.noContent().build();
    }
    @PostMapping("/{id}/seasons") public AnimeDetailsResponse createSeason(@PathVariable Long id,
            @Valid @RequestBody com.lifedashboard.content.dto.SeasonRequest request) {
        service.get(id);
        viewingService.createSeason(id, request); return service.get(id);
    }
    @PostMapping("/seasons/{seasonId}/episodes") public AnimeDetailsResponse createEpisode(
            @PathVariable Long seasonId, @Valid @RequestBody com.lifedashboard.content.dto.EpisodeRequest request) {
        long animeId = viewingService.contentIdForSeason(seasonId);
        service.get(animeId);
        viewingService.createEpisode(seasonId, request);
        return service.get(animeId);
    }
    @PostMapping("/episodes/{episodeId}/watches") public AnimeDetailsResponse watchEpisode(
            @PathVariable Long episodeId, @RequestBody(required = false) com.lifedashboard.content.dto.WatchRequest request) {
        long animeId = viewingService.contentIdForEpisode(episodeId);
        service.get(animeId);
        viewingService.watchEpisode(episodeId, request);
        return service.get(animeId);
    }
}
