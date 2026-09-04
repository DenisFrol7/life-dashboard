package com.lifedashboard.game.openxbl;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/games/import/xbox")
public class XboxImportController {
    private final XboxImportPreviewService previewService;
    private final XboxImportService importService;

    public XboxImportController(XboxImportPreviewService previewService,
            XboxImportService importService) {
        this.previewService = previewService;
        this.importService = importService;
    }

    @GetMapping("/preview")
    public XboxImportPreview preview() {
        return previewService.preview();
    }

    @PostMapping("/prepare")
    public XboxImportPreparation prepare(@Valid @RequestBody XboxImportSelection request) {
        return importService.prepare(request);
    }

    @PostMapping
    public XboxImportResult importSelected(@Valid @RequestBody XboxImportRequest request) {
        return importService.importSelected(request);
    }
}
