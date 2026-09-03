package com.lifedashboard.content.dto;

import com.lifedashboard.content.*;
import java.time.LocalDate;

public record ContentItemResponse(Long id, String title, String originalTitle, ContentType itemType,
        ContentFormat format, Integer releaseYear, String description, String coverUrl,
        Integer durationMinutes, ReleaseStatus releaseStatus, String genre, String developer,
        LocalDate releaseDate, boolean xboxPlayAnywhere, Long rawgId, String rawgSlug,
        String backgroundUrl, Long steamGridDbGameId, Long steamGridDbGridId) {}
