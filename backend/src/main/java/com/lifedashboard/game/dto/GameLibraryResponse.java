package com.lifedashboard.game.dto;

import com.lifedashboard.content.UserContentStatus;
import com.lifedashboard.game.GameAccessType;
import java.time.Instant;

public record GameLibraryResponse(Long id, Long contentId, String title, ReferenceResponse platform,
        ReferenceResponse source, GameAccessType accessType, String edition, Instant acquiredAt, String note,
        UserContentStatus status, Short rating, boolean favorite, Instant startedAt, Instant completedAt,
        String personalNote, long legacyPlaytimeMinutes, Long steamAppId, Long xboxTitleId) {}
