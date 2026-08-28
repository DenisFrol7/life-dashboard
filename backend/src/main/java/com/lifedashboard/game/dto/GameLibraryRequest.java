package com.lifedashboard.game.dto;

import com.lifedashboard.game.GameAccessType;
import com.lifedashboard.content.UserContentStatus;
import jakarta.validation.constraints.*;
import java.time.Instant;

public record GameLibraryRequest(
        @NotNull Long platformId, @NotNull Long sourceId, @NotNull GameAccessType accessType,
        @Size(max = 200) String edition, Instant acquiredAt, String note,
        @NotNull @Min(0) Long legacyPlaytimeMinutes, @NotNull UserContentStatus status,
        Instant startedAt, Instant completedAt) {
    public GameLibraryRequest(Long platformId, Long sourceId, GameAccessType accessType,
            String edition, Instant acquiredAt, String note, Long legacyPlaytimeMinutes) {
        this(platformId, sourceId, accessType, edition, acquiredAt, note, legacyPlaytimeMinutes,
                UserContentStatus.NOT_STARTED, null, null);
    }
}
