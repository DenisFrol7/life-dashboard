package com.lifedashboard.tag.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TagRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(max = 100) String slug
) {
}
