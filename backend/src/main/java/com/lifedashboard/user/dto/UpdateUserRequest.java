package com.lifedashboard.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @NotBlank @Size(max = 100) String username,
        @Size(max = 200) String displayName,
        @Email @Size(max = 320) String email,
        @NotBlank @Size(max = 100) String timezone
) {
}
