package com.lifedashboard.game.dto;

import com.lifedashboard.content.UserContentStatus;
import com.lifedashboard.game.GameAccessType;
import jakarta.validation.constraints.*;
import java.time.Instant;

public record GameLibraryRequest(
        @NotNull Long platformId, @NotNull Long sourceId, @NotNull GameAccessType accessType,
        @Size(max = 200) String edition, Instant acquiredAt, String note,
        @NotNull UserContentStatus status, @Min(1) @Max(10) Short rating, boolean favorite,
        Instant startedAt, Instant completedAt, String personalNote) {}
