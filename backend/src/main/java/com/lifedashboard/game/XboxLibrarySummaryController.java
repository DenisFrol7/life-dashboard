package com.lifedashboard.game;

import com.lifedashboard.game.dto.XboxLibrarySummaryResponse;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Games")
@RequestMapping("/api/games/xbox-summary")
public class XboxLibrarySummaryController {
    private final XboxLibrarySummaryService service;

    public XboxLibrarySummaryController(XboxLibrarySummaryService service) {
        this.service = service;
    }

    @GetMapping
    public List<XboxLibrarySummaryResponse> getAll() {
        return service.getAll();
    }
}
