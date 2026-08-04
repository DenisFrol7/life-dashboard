package com.lifedashboard.user.dto;

import java.time.Instant;

public record UserResponse(
        Long id,
        String username,
        String displayName,
        String email,
        String timezone,
        Instant createdAt,
        Instant updatedAt
) {
}
