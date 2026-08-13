package com.lifedashboard.content;

import com.lifedashboard.content.dto.MediaTimelineResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class MediaTimelineService {
    private final ContentItemRepository items;
    private final long userId;

    public MediaTimelineService(ContentItemRepository items, @Value("${app.default-user-id}") long userId) {
        this.items = items; this.userId = userId;
    }

    public List<MediaTimelineResponse> get(Instant from, Instant to) {
        return items.findMediaTimeline(userId, from, to).stream().map(item -> new MediaTimelineResponse(
                item.getKind().toLowerCase() + "-" + item.getEventId(), item.getOccurredAt(), item.getTitle(),
                detail(item), item.getDurationMinutes())).toList();
    }

    private String detail(MediaTimelineProjection item) {
        return switch (item.getKind()) {
            case "MOVIE" -> item.getWatchNumber() != null && item.getWatchNumber() > 1
                    ? "Повторный просмотр №" + item.getWatchNumber() : "Просмотрен фильм";
            case "EPISODE" -> "Сезон " + item.getSeasonNumber() + ", серия " + item.getEpisodeNumber()
                    + (item.getEpisodeTitle() == null ? "" : " — " + item.getEpisodeTitle());
            case "SEASON" -> "Просмотрен сезон " + item.getSeasonNumber() + " · " + item.getEpisodeCount() + " эпизодов";
            default -> "Просмотр";
        };
    }
}
