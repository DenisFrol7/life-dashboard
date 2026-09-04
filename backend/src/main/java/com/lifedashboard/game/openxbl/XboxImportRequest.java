package com.lifedashboard.game.openxbl;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record XboxImportRequest(@NotBlank String backupToken,
        @NotEmpty @Size(max = 1000) List<@Valid XboxImportGameRequest> games) {}
