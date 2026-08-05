package com.lifedashboard.journal.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record JournalEntryRequest(
        @NotNull LocalDate entryDate,
        @Size(max = 300) String title,
        @NotBlank String content,
        @NotNull Boolean pinned
) {
}
