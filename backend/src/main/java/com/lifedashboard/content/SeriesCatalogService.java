package com.lifedashboard.content;

import com.lifedashboard.content.dto.SeriesCatalogResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class SeriesCatalogService {
    private final ContentItemRepository items;
    private final long userId;

    public SeriesCatalogService(ContentItemRepository items,
            @Value("${app.default-user-id}") long userId) {
        this.items = items;
        this.userId = userId;
    }

    public List<SeriesCatalogResponse> getAll() {
        return items.findSerialCatalog(userId, ContentType.SERIES.name()).stream().map(item -> new SeriesCatalogResponse(
                item.getId(), item.getTitle(), item.getOriginalTitle(), ContentFormat.valueOf(item.getFormat()),
                item.getReleaseYear(), item.getDescription(), item.getCoverUrl(), item.getDurationMinutes(),
                ReleaseStatus.valueOf(item.getReleaseStatus()), item.getGenre(), item.getDeveloper(),
                item.getReleaseDate(), item.getLibraryId(), enumValue(UserContentStatus.class, item.getUserStatus()),
                item.getRating(), Boolean.TRUE.equals(item.getFavorite()), item.getStartedAt(), item.getCompletedAt(),
                item.getPersonalNote(), item.getSeasonCount(),
                item.getEpisodeCount(), item.getWatchedEpisodeCount(), item.getWatchedMinutes())).toList();
    }

    private <T extends Enum<T>> T enumValue(Class<T> type, String value) {
        return value == null ? null : Enum.valueOf(type, value);
    }
}
