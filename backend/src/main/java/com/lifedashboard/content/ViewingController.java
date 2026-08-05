package com.lifedashboard.content;
import com.lifedashboard.content.dto.*; import jakarta.validation.Valid; import org.springframework.http.*; import org.springframework.web.bind.annotation.*; import java.util.*;
@RestController @RequestMapping("/api/content")
public class ViewingController {private final ViewingService service;public ViewingController(ViewingService s){service=s;}
 @PostMapping("/{id}/seasons") public ResponseEntity<SeasonResponse> season(@PathVariable Long id,@Valid @RequestBody SeasonRequest r){return ResponseEntity.status(HttpStatus.CREATED).body(service.createSeason(id,r));}
 @GetMapping("/{id}/seasons") public List<SeasonResponse> seasons(@PathVariable Long id){return service.seasons(id);}
 @PostMapping("/seasons/{id}/episodes") public ResponseEntity<EpisodeResponse> episode(@PathVariable Long id,@Valid @RequestBody EpisodeRequest r){return ResponseEntity.status(HttpStatus.CREATED).body(service.createEpisode(id,r));}
 @GetMapping("/seasons/{id}/episodes") public List<EpisodeResponse> episodes(@PathVariable Long id){return service.episodes(id);}
 @PostMapping("/episodes/{id}/watches") public ResponseEntity<WatchResponse> watchEpisode(@PathVariable Long id,@RequestBody(required=false) WatchRequest r){return ResponseEntity.status(HttpStatus.CREATED).body(service.watchEpisode(id,r));}
 @GetMapping("/episodes/{id}/watches") public List<WatchResponse> episodeHistory(@PathVariable Long id){return service.episodeHistory(id);}
 @PostMapping("/{id}/watches") public ResponseEntity<WatchResponse> watchMovie(@PathVariable Long id,@RequestBody(required=false) WatchRequest r){return ResponseEntity.status(HttpStatus.CREATED).body(service.watchMovie(id,r));}
 @GetMapping("/{id}/watches") public List<WatchResponse> movieHistory(@PathVariable Long id){return service.movieHistory(id);}
}
