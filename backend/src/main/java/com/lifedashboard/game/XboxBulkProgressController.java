package com.lifedashboard.game;

import com.lifedashboard.game.dto.XboxBulkSyncResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Games")
@RequestMapping("/api/games/xbox-progress")
public class XboxBulkProgressController {
    private final XboxBulkProgressService service;

    public XboxBulkProgressController(XboxBulkProgressService service) {
        this.service = service;
    }

    @PostMapping("/sync-linked")
    public XboxBulkSyncResponse syncLinked() {
        return service.syncLinked();
    }
}
