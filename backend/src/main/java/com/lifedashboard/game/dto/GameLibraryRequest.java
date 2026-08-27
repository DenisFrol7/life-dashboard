package com.lifedashboard.game.dto;

import com.lifedashboard.game.GameAccessType;
import jakarta.validation.constraints.*;
import java.time.Instant;

public record GameLibraryRequest(
        @NotNull Long platformId, @NotNull Long sourceId, @NotNull GameAccessType accessType,
        @Size(max = 200) String edition, Instant acquiredAt, String note,
        @NotNull @Min(0) Long legacyPlaytimeMinutes) {}
