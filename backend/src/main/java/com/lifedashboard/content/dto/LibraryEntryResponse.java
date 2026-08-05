package com.lifedashboard.content.dto;

import com.lifedashboard.content.UserContentStatus;
import java.time.Instant;

public record LibraryEntryResponse(Long id, ContentItemResponse content, UserContentStatus status,
        Short rating, boolean favorite, Instant startedAt, Instant completedAt, String personalNote) {}
