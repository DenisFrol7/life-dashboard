package com.lifedashboard.game.steamgriddb;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/games/steamgriddb")
public class SteamGridDbCatalogController {
    private final SteamGridDbCatalogService service;

    public SteamGridDbCatalogController(SteamGridDbCatalogService service) {
        this.service = service;
    }

    @GetMapping("/search")
    public List<SteamGridDbGameCandidate> search(@RequestParam String query) {
        return service.search(query);
    }

    @GetMapping("/{gameId}/covers")
    public List<SteamGridDbCoverCandidate> covers(@PathVariable long gameId) {
        return service.covers(gameId);
    }
}
