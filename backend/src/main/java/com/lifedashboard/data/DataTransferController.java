package com.lifedashboard.data;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/data")
public class DataTransferController {

    private static final DateTimeFormatter FILE_TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");
    private final DataTransferService service;

    public DataTransferController(DataTransferService service) {
        this.service = service;
    }

    @GetMapping(value = "/export", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> exportData() {
        String fileName = "life-dashboard_" + FILE_TIMESTAMP.format(LocalDateTime.now()) + ".json";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(fileName, StandardCharsets.UTF_8).build().toString())
                .body(service.exportData());
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DataTransferResponse importData(@RequestPart("file") MultipartFile file) throws IOException {
        return service.importData(file.getBytes());
    }
}
