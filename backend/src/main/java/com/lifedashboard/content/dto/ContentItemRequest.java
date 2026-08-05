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
        @NotNull ReleaseStatus releaseStatus) {}
