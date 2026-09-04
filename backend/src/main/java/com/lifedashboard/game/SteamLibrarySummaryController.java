package com.lifedashboard.game;

import com.lifedashboard.game.dto.SteamLibrarySummaryResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Games")
@RequestMapping("/api/games/steam-summary")
public class SteamLibrarySummaryController {
    private final SteamLibrarySummaryService service;

    public SteamLibrarySummaryController(SteamLibrarySummaryService service) {
        this.service = service;
    }

    @GetMapping
    public List<SteamLibrarySummaryResponse> getAll() {
        return service.getAll();
    }
}
