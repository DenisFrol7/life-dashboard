package com.lifedashboard.content;

import com.lifedashboard.common.error.*;
import com.lifedashboard.content.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class AnimeService {
    private final ContentItemRepository items;
    private final UserContentRepository library;
    private final ContentSeasonRepository seasons;
    private final ContentEpisodeRepository episodes;
    private final EpisodeWatchRepository watches;
    private final ContentService contentService;
    private final long userId;

    public AnimeService(ContentItemRepository items, UserContentRepository library,
            ContentSeasonRepository seasons, ContentEpisodeRepository episodes,
            EpisodeWatchRepository watches, ContentService contentService,
            @Value("${app.default-user-id}") long userId) {
        this.items = items; this.library = library; this.seasons = seasons; this.episodes = episodes;
        this.watches = watches; this.contentService = contentService; this.userId = userId;
    }

    @Transactional
    public AnimeDetailsResponse create(AnimeRequest request) {
        ContentItemResponse created = contentService.create(contentRequest(request));
        return details(findAnime(created.id()));
    }
    public List<AnimeSummaryResponse> getAll(ReleaseStatus releaseStatus, UserContentStatus userStatus) {
        return items.findAllByItemTypeOrderByTitleAsc(ContentType.ANIME).stream()
                .filter(item -> releaseStatus == null || item.getReleaseStatus() == releaseStatus)
                .filter(item -> userStatus == null || library.findByUserIdAndContentId(userId, item.getId())
                        .map(entry -> entry.getStatus() == userStatus).orElse(false))
                .map(this::summary).toList();
    }
    public AnimeDetailsResponse get(Long id) { return details(findAnime(id)); }
    @Transactional
    public AnimeDetailsResponse update(Long id, AnimeRequest request) {
        findAnime(id);
        contentService.update(id, contentRequest(request));
        return details(findAnime(id));
    }
    @Transactional public void delete(Long id) { contentService.delete(findAnime(id).getId()); }
    @Transactional
    public AnimeDetailsResponse putInLibrary(Long id, LibraryEntryRequest request) {
        findAnime(id); contentService.putInLibrary(id, request); return details(findAnime(id));
    }
    @Transactional public void removeFromLibrary(Long id) { findAnime(id); contentService.removeFromLibrary(id); }

    private AnimeSummaryResponse summary(ContentItem item) {
        UserContent entry = library.findByUserIdAndContentId(userId, item.getId()).orElse(null);
        return new AnimeSummaryResponse(item.getId(), item.getTitle(), item.getOriginalTitle(), item.getReleaseYear(),
                item.getCoverUrl(), item.getReleaseStatus(), entry == null ? null : entry.getStatus(),
                entry == null ? null : entry.getRating(), entry != null && entry.isFavorite(),
                seasons.countByContentId(item.getId()), episodes.countByContent(item.getId()),
                watches.watchedCount(userId, item.getId()));
    }
    private AnimeDetailsResponse details(ContentItem item) {
        UserContent entry = library.findByUserIdAndContentId(userId, item.getId()).orElse(null);
        List<AnimeSeasonResponse> seasonResponses = seasons.findAllByContentIdOrderBySeasonNumber(item.getId()).stream()
                .map(season -> new AnimeSeasonResponse(season.getId(), season.getSeasonNumber(), season.getTitle(),
                        season.getReleaseYear(), episodes.findAllBySeasonIdOrderByEpisodeNumber(season.getId()).stream()
                        .map(episode -> { long count = watches.countByEpisodeIdAndUserId(episode.getId(), userId);
                            return new AnimeEpisodeResponse(episode.getId(), episode.getEpisodeNumber(), episode.getTitle(),
                                    episode.getDurationMinutes(), episode.getReleaseDate(), count > 0, count); })
                        .toList())).toList();
        return new AnimeDetailsResponse(item.getId(), item.getTitle(), item.getOriginalTitle(), item.getReleaseYear(),
                item.getDescription(), item.getCoverUrl(), item.getReleaseStatus(), entry == null ? null : entry.getStatus(),
                entry == null ? null : entry.getRating(), entry != null && entry.isFavorite(),
                entry == null ? null : entry.getStartedAt(), entry == null ? null : entry.getCompletedAt(),
                entry == null ? null : entry.getPersonalNote(), seasonResponses);
    }
    private ContentItem findAnime(Long id) {
        ContentItem item = items.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Anime with id " + id + " was not found"));
        if (item.getItemType() != ContentType.ANIME)
            throw new ResourceNotFoundException("Anime with id " + id + " was not found");
        return item;
    }
    private ContentItemRequest contentRequest(AnimeRequest r) {
        return new ContentItemRequest(r.title(), r.originalTitle(), ContentType.ANIME, ContentFormat.ANIME,
                r.releaseYear(), r.description(), r.coverUrl(), null, r.releaseStatus());
    }
}
