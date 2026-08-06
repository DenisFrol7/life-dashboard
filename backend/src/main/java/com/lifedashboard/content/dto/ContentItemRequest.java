package com.lifedashboard.content.dto;

import com.lifedashboard.content.*;
import jakarta.validation.constraints.*;

public record ContentItemRequest(
        @NotBlank @Size(max = 300) String title,
        @Size(max = 300) String originalTitle,
        @NotNull ContentType itemType,
        ContentFormat format,
        @Positive Integer releaseYear,
        String description,
        String coverUrl,
        @Positive Integer durationMinutes,
        @NotNull ReleaseStatus releaseStatus,
        @Size(max = 100) String genre) {
    public ContentItemRequest(String title, String originalTitle, ContentType itemType, ContentFormat format,
            Integer releaseYear, String description, String coverUrl, Integer durationMinutes,
            ReleaseStatus releaseStatus) {
        this(title, originalTitle, itemType, format, releaseYear, description, coverUrl, durationMinutes,
                releaseStatus, null);
    }
}
