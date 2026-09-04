package com.lifedashboard.game.openxbl;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

public record XboxImportGameRequest(@Positive long titleId,
        @NotBlank @Pattern(regexp = "XBOX_STORE|GAME_PASS") String sourceCode) {}
