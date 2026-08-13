package com.lifedashboard.content;

import com.lifedashboard.content.dto.MovieCatalogResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class MovieCatalogService {
    private final ContentItemRepository items; private final long userId;
    public MovieCatalogService(ContentItemRepository items, @Value("${app.default-user-id}") long userId) {
        this.items = items; this.userId = userId;
    }
    public List<MovieCatalogResponse> getAll() {
        return items.findMovieCatalog(userId).stream().map(item -> new MovieCatalogResponse(item.getId(),
                item.getTitle(), item.getOriginalTitle(), ContentFormat.valueOf(item.getFormat()),
                item.getReleaseYear(), item.getDescription(), item.getCoverUrl(), item.getDurationMinutes(),
                ReleaseStatus.valueOf(item.getReleaseStatus()), item.getGenre(), item.getDeveloper(),
                item.getReleaseDate(), item.getLibraryId(), item.getUserStatus() == null ? null
                : UserContentStatus.valueOf(item.getUserStatus()), item.getRating(),
                Boolean.TRUE.equals(item.getFavorite()), item.getStartedAt(), item.getCompletedAt(),
                item.getPersonalNote(), item.getWatchCount(), item.getWatchedMinutes())).toList();
    }
}
