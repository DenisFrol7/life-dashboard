package com.lifedashboard.content;
import com.lifedashboard.content.dto.*; import jakarta.validation.Valid; import org.springframework.http.*; import org.springframework.web.bind.annotation.*; import java.util.*;
@RestController @RequestMapping("/api/content")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Content")
public class ViewingController {private final ViewingService service;public ViewingController(ViewingService s){service=s;}
 @PostMapping("/{id}/seasons") public ResponseEntity<SeasonResponse> season(@PathVariable Long id,@Valid @RequestBody SeasonRequest r){return ResponseEntity.status(HttpStatus.CREATED).body(service.createSeason(id,r));}
 @GetMapping("/{id}/seasons") public List<SeasonResponse> seasons(@PathVariable Long id){return service.seasons(id);}
 @PutMapping("/seasons/{id}") public SeasonResponse updateSeason(@PathVariable Long id,@Valid @RequestBody SeasonRequest r){return service.updateSeason(id,r);}
 @DeleteMapping("/seasons/{id}") public ResponseEntity<Void> deleteSeason(@PathVariable Long id){service.deleteSeason(id);return ResponseEntity.noContent().build();}
 @PostMapping("/seasons/{id}/episodes") public ResponseEntity<EpisodeResponse> episode(@PathVariable Long id,@Valid @RequestBody EpisodeRequest r){return ResponseEntity.status(HttpStatus.CREATED).body(service.createEpisode(id,r));}
 @PostMapping("/seasons/{id}/episodes/bulk") public ResponseEntity<List<EpisodeResponse>> bulkEpisodes(@PathVariable Long id,@Valid @RequestBody BulkEpisodeRequest r){return ResponseEntity.status(HttpStatus.CREATED).body(service.createEpisodes(id,r));}
 @GetMapping("/seasons/{id}/episodes") public List<EpisodeResponse> episodes(@PathVariable Long id){return service.episodes(id);}
 @PostMapping("/seasons/{id}/watches") public ResponseEntity<Void> watchSeason(@PathVariable Long id,@RequestBody(required=false) WatchRequest r){service.watchSeason(id,r);return ResponseEntity.noContent().build();}
 @GetMapping("/seasons/{id}/completion") public ResponseEntity<SeasonCompletionResponse> seasonCompletion(@PathVariable Long id){SeasonCompletionResponse result=service.seasonCompletion(id);return result==null?ResponseEntity.noContent().build():ResponseEntity.ok(result);}
 @DeleteMapping("/seasons/{id}/watches") public ResponseEntity<Void> clearSeasonWatches(@PathVariable Long id){service.clearSeasonWatches(id);return ResponseEntity.noContent().build();}
 @PutMapping("/episodes/{id}") public EpisodeResponse updateEpisode(@PathVariable Long id,@Valid @RequestBody EpisodeRequest r){return service.updateEpisode(id,r);}
 @DeleteMapping("/episodes/{id}") public ResponseEntity<Void> deleteEpisode(@PathVariable Long id){service.deleteEpisode(id);return ResponseEntity.noContent().build();}
 @PostMapping("/episodes/{id}/watches") public ResponseEntity<WatchResponse> watchEpisode(@PathVariable Long id,@RequestBody(required=false) WatchRequest r){return ResponseEntity.status(HttpStatus.CREATED).body(service.watchEpisode(id,r));}
 @GetMapping("/episodes/{id}/watches") public List<WatchResponse> episodeHistory(@PathVariable Long id){return service.episodeHistory(id);}
 @PostMapping("/{id}/watches") public ResponseEntity<WatchResponse> watchMovie(@PathVariable Long id,@RequestBody(required=false) WatchRequest r){return ResponseEntity.status(HttpStatus.CREATED).body(service.watchMovie(id,r));}
 @GetMapping("/{id}/watches") public List<WatchResponse> movieHistory(@PathVariable Long id){return service.movieHistory(id);}
 @PutMapping("/watches/{watchId}") public WatchResponse updateMovieWatch(@PathVariable Long watchId,@RequestBody WatchRequest r){return service.updateMovieWatch(watchId,r);}
 @DeleteMapping("/watches/{watchId}") public ResponseEntity<Void> deleteMovieWatch(@PathVariable Long watchId){service.deleteMovieWatch(watchId);return ResponseEntity.noContent().build();}
}
