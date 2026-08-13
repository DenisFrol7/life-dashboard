package com.lifedashboard.content;

import java.time.Instant;

public interface MediaTimelineProjection {
    String getKind();
    Long getEventId();
    Instant getOccurredAt();
    String getTitle();
    Integer getWatchNumber();
    Integer getSeasonNumber();
    Integer getEpisodeNumber();
    String getEpisodeTitle();
    Integer getEpisodeCount();
    Integer getDurationMinutes();
}
