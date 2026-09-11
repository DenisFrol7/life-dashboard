package com.lifedashboard.game.steam;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SteamImportRequest(
        @NotBlank String backupToken,
        @NotEmpty @Size(max = 1000) List<@Valid SteamImportGameRequest> games) {}
