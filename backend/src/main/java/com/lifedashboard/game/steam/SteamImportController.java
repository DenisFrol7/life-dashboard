package com.lifedashboard.game.steam;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/import/steam")
public class SteamImportController {
    private final SteamImportPreviewService previewService;
    private final SteamImportService importService;

    public SteamImportController(SteamImportPreviewService previewService,
            SteamImportService importService) {
        this.previewService = previewService;
        this.importService = importService;
    }

    @GetMapping("/preview")
    public SteamImportPreview preview() {
        return previewService.preview();
    }

    @PostMapping
    public SteamImportResult importSelected(@Valid @RequestBody SteamImportRequest request) {
        return importService.importSelected(request);
    }

    @PostMapping("/prepare")
    public SteamImportPreparation prepare(@Valid @RequestBody SteamImportSelection request) {
        return importService.prepare(request);
    }
}
