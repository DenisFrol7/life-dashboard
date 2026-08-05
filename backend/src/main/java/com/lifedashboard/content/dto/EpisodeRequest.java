package com.lifedashboard.content.dto; import jakarta.validation.constraints.*; import java.time.LocalDate;
public record EpisodeRequest(@NotNull @Positive Integer episodeNumber,@NotBlank @Size(max=300) String title,@Positive Integer durationMinutes,LocalDate releaseDate){}
