package com.lifedashboard.book.dto;
import jakarta.validation.constraints.*;
import java.time.Instant;
public record ReadingSessionRequest(@NotNull Instant startedAt,@Min(1) int durationMinutes,
        @PositiveOrZero int pagesRead,@PositiveOrZero int listenedMinutes,@Size(max=5000) String note){}
