package com.lifedashboard.common.health;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    @GetMapping("/api/health")
    public ResponseEntity<HealthResponse> health() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new HealthResponse("UP"));
    }

    public record HealthResponse(String status) {}
}
