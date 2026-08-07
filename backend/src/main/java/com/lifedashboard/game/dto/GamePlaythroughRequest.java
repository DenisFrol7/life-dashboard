package com.lifedashboard.game.dto;

import jakarta.validation.constraints.Size;
import java.time.Instant;

public record GamePlaythroughRequest(Instant completedAt, @Size(max = 5000) String note) {}
