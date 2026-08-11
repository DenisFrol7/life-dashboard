package com.lifedashboard.content;

import com.lifedashboard.content.dto.SeriesCatalogResponse;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Series")
@RequestMapping("/api/series")
public class SeriesCatalogController {
    private final SeriesCatalogService service;

    public SeriesCatalogController(SeriesCatalogService service) { this.service = service; }

    @GetMapping
    public List<SeriesCatalogResponse> getAll() { return service.getAll(); }
}
