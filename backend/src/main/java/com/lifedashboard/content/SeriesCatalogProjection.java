package com.lifedashboard.content;

import java.time.LocalDate;
import java.time.Instant;

public interface SeriesCatalogProjection {
    Long getId();
    String getTitle();
    String getOriginalTitle();
    String getFormat();
    Integer getReleaseYear();
    String getDescription();
    String getCoverUrl();
    Integer getDurationMinutes();
    String getReleaseStatus();
    String getGenre();
    String getDeveloper();
    LocalDate getReleaseDate();
    Long getLibraryId();
    String getUserStatus();
    Short getRating();
    Boolean getFavorite();
    Instant getStartedAt();
    Instant getCompletedAt();
    String getPersonalNote();
    Long getSeasonCount();
    Long getEpisodeCount();
    Long getWatchedEpisodeCount();
    Long getWatchedMinutes();
}
