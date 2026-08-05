package com.lifedashboard.blog.dto;

import com.lifedashboard.blog.BlogPostStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BlogPostRequest(
        @NotBlank @Size(max = 300) String title,
        @NotBlank @Size(max = 300) String slug,
        String excerpt,
        @NotBlank String content,
        String coverImageUrl,
        @NotNull BlogPostStatus status
) {
}
