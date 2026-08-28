package com.lifedashboard.content.myshows;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/series/import/myshows")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Series import")
public class MyShowsImportController {

    private final MyShowsImportService service;

    public MyShowsImportController(MyShowsImportService service) {
        this.service = service;
    }

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MyShowsImportPreview preview(@RequestPart("file") MultipartFile file) {
        return service.preview(file);
    }

    @PostMapping(value = "/kinopoisk-match", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public KinopoiskMatchPreview matchWithKinopoisk(@RequestPart("file") MultipartFile file) {
        return service.matchWithKinopoisk(file);
    }

    @PostMapping(value = "/confirm", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MyShowsImportResult confirm(@RequestPart("file") MultipartFile file,
                                       @RequestPart("config") MyShowsImportRequest request) {
        return service.importData(file, request);
    }

    @PostMapping("/enrich")
    public KinopoiskEnrichmentResult enrich(@RequestParam(defaultValue = "10") int batchSize) {
        return service.enrichFromKinopoisk(batchSize);
    }
}
