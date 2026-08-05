package com.lifedashboard.content.dto;

import com.lifedashboard.content.ReleaseStatus;
import jakarta.validation.constraints.*;

public record AnimeRequest(
        @NotBlank @Size(max = 300) String title,
        @Size(max = 300) String originalTitle,
        @Positive Integer releaseYear,
        String description,
        String coverUrl,
        @NotNull ReleaseStatus releaseStatus) {}
