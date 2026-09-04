package com.lifedashboard.game;

import com.lifedashboard.game.dto.SteamRecentSyncResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Games")
@RequestMapping("/api/games/steam-progress")
public class SteamRecentProgressController {
    private final SteamRecentProgressService service;

    public SteamRecentProgressController(SteamRecentProgressService service) {
        this.service = service;
    }

    @PostMapping("/sync-recent")
    public SteamRecentSyncResponse syncRecent() {
        return service.syncRecent();
    }
}
