package com.lifedashboard.journal.dto;

import java.time.LocalDate;
import java.util.List;

public record JournalEntryResponse(
        Long id,
        LocalDate entryDate,
        String title,
        String content,
        boolean pinned,
        List<TagResponse> tags
) {
}
