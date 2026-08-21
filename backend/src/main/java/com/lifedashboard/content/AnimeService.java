package com.lifedashboard.content;

import org.jspecify.annotations.NonNull;
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
        return items.findSerialCatalog(userId, ContentType.ANIME.name()).stream()
                .filter(item -> releaseStatus == null || item.getReleaseStatus().equals(releaseStatus.name()))
                .filter(item -> userStatus == null || userStatus.name().equals(item.getUserStatus()))
                .map(item -> new AnimeSummaryResponse(item.getId(), item.getTitle(), item.getOriginalTitle(),
                        item.getReleaseYear(), item.getCoverUrl(), ReleaseStatus.valueOf(item.getReleaseStatus()),
                        item.getUserStatus() == null ? null : UserContentStatus.valueOf(item.getUserStatus()),
                        item.getRating(), Boolean.TRUE.equals(item.getFavorite()), item.getSeasonCount(),
                        item.getEpisodeCount(), item.getWatchedEpisodeCount(), item.getWatchedMinutes())).toList();
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

    private AnimeDetailsResponse details(ContentItem item) {
        UserContent entry = library.findByUserIdAndContentId(userId, item.getId()).orElse(null);
        Map<Long, List<ContentEpisode>> episodesBySeason = new HashMap<>();
        for (ContentEpisode episode : episodes.findAllByContentId(item.getId()))
            episodesBySeason.computeIfAbsent(episode.getSeason().getId(), ignored -> new ArrayList<>()).add(episode);
        Map<Long, Long> watchCountsByEpisode = new HashMap<>();
        for (EpisodeWatch watch : watches.findAllByUserIdAndContentId(userId, item.getId()))
            watchCountsByEpisode.merge(watch.getEpisode().getId(), 1L,
                    (@NonNull Long current, @NonNull Long increment) -> current + increment);
        List<AnimeSeasonResponse> seasonResponses = seasons.findAllByContentIdOrderBySeasonNumber(item.getId()).stream()
                .map(season -> new AnimeSeasonResponse(season.getId(), season.getSeasonNumber(), season.getTitle(),
                        season.getReleaseYear(), episodesBySeason.getOrDefault(season.getId(), List.of()).stream()
                        .map(episode -> { long count = watchCountsByEpisode.getOrDefault(episode.getId(), 0L);
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
