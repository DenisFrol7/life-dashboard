package com.lifedashboard.game;

import com.lifedashboard.game.dto.SteamProgressResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Games")
@RequestMapping("/api/games/library/{libraryEntryId}/steam-progress")
public class SteamProgressController {
    private final SteamProgressService service;

    public SteamProgressController(SteamProgressService service) {
        this.service = service;
    }

    @GetMapping
    public SteamProgressResponse get(@PathVariable Long libraryEntryId) {
        return service.get(libraryEntryId);
    }

    @PostMapping("/sync")
    public SteamProgressResponse sync(@PathVariable Long libraryEntryId) {
        return service.sync(libraryEntryId);
    }
}
