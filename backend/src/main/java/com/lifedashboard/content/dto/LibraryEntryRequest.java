package com.lifedashboard.content.dto;

import com.lifedashboard.content.UserContentStatus;
import jakarta.validation.constraints.*;
import java.time.Instant;

public record LibraryEntryRequest(@NotNull UserContentStatus status, @Min(1) @Max(10) Short rating,
        boolean favorite, Instant startedAt, Instant completedAt, String personalNote) {}
