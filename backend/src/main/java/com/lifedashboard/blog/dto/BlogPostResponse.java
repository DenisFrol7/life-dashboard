package com.lifedashboard.blog.dto;

import com.lifedashboard.blog.BlogPostStatus;
import com.lifedashboard.journal.dto.TagResponse;

import java.time.Instant;
import java.util.List;

public record BlogPostResponse(
        Long id,
        Long sourceJournalEntryId,
        String title,
        String slug,
        String excerpt,
        String content,
        String coverImageUrl,
        BlogPostStatus status,
        Instant publishedAt,
        List<TagResponse> tags
) {
}
