package com.lifedashboard.content;

import com.lifedashboard.content.dto.MovieCatalogResponse;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Movies")
@RequestMapping("/api/movies")
public class MovieCatalogController {
    private final MovieCatalogService service;
    public MovieCatalogController(MovieCatalogService service) { this.service = service; }
    @GetMapping public List<MovieCatalogResponse> getAll() { return service.getAll(); }
}
