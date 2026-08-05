package com.lifedashboard.blog.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BlogPostFromJournalRequest(
        @Size(max = 300) String title,
        @NotBlank @Size(max = 300) String slug,
        String excerpt,
        String coverImageUrl
) {
}
