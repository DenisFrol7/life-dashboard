package com.lifedashboard.content.dto;

import com.lifedashboard.content.*;
import jakarta.validation.constraints.*;
import java.time.LocalDate;

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
        @Size(max = 100) String genre,
        @Size(max = 200) String developer,
        LocalDate releaseDate,
        Boolean xboxPlayAnywhere,
        String backgroundUrl,
        Long steamGridDbGameId,
        Long steamGridDbGridId) {
    public ContentItemRequest(String title, String originalTitle, ContentType itemType, ContentFormat format,
            Integer releaseYear, String description, String coverUrl, Integer durationMinutes,
            ReleaseStatus releaseStatus) {
        this(title, originalTitle, itemType, format, releaseYear, description, coverUrl, durationMinutes,
                releaseStatus, null, null, null, Boolean.FALSE, null, null, null);
    }
    public ContentItemRequest(String title, String originalTitle, ContentType itemType, ContentFormat format,
            Integer releaseYear, String description, String coverUrl, Integer durationMinutes,
            ReleaseStatus releaseStatus, String genre, String developer, LocalDate releaseDate,
            Boolean xboxPlayAnywhere) {
        this(title, originalTitle, itemType, format, releaseYear, description, coverUrl, durationMinutes,
                releaseStatus, genre, developer, releaseDate, xboxPlayAnywhere, null, null, null);
    }
}
