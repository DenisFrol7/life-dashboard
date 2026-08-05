package com.lifedashboard.content.dto; import jakarta.validation.constraints.*;
public record SeasonRequest(@NotNull @Positive Integer seasonNumber,@Size(max=300) String title,@Positive Integer releaseYear){}
