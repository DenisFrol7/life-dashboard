package com.lifedashboard.content.shikimori;

import com.lifedashboard.common.error.DuplicateResourceException;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.AnimeDetailsResponse;
import com.lifedashboard.content.dto.AnimeRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@Transactional(readOnly = true)
public class ShikimoriCatalogService {
    private final ContentItemRepository items;
    private final ContentSeasonRepository seasons;
    private final ContentEpisodeRepository episodes;
    private final ShikimoriClient shikimori;
    private final AnimeService animeService;
    private final ConcurrentMap<Long, ShikimoriClient.AnimeDetails> previewCache = new ConcurrentHashMap<>();

    public ShikimoriCatalogService(ContentItemRepository items, ContentSeasonRepository seasons,
            ContentEpisodeRepository episodes, ShikimoriClient shikimori, AnimeService animeService) {
        this.items = items; this.seasons = seasons; this.episodes = episodes;
        this.shikimori = shikimori; this.animeService = animeService;
    }

    public List<ShikimoriAnimeCandidate> search(String query) {
        if (query == null || query.trim().length() < 2)
            throw new InvalidRequestException("Shikimori search query must contain at least 2 characters");
        return shikimori.search(query.trim()).stream().map(candidate -> new ShikimoriAnimeCandidate(
                candidate.id(), first(candidate.russian(), candidate.name(), "Anime " + candidate.id()),
                normalize(candidate.name()), candidate.kind(), candidate.status(), candidate.imageUrl(),
                items.findByShikimoriId(candidate.id()).map(ContentItem::getId).orElse(null))).toList();
    }

    public ShikimoriAnimeDetails preview(long id) {
        ShikimoriClient.AnimeDetails details = shikimori.getAnime(id);
        rejectMovie(details);
        previewCache.put(id, details);
        return response(details, items.findByShikimoriId(id).map(ContentItem::getId).orElse(null));
    }

    @Transactional
    public AnimeDetailsResponse create(long id, AnimeRequest request) {
        items.findByShikimoriId(id).ifPresent(existing -> {
            throw new DuplicateResourceException("Shikimori anime already exists in catalog with id " + existing.getId());
        });
        ShikimoriClient.AnimeDetails details = Optional.ofNullable(previewCache.remove(id))
                .orElseGet(() -> shikimori.getAnime(id));
        rejectMovie(details);
        ContentItem item = findLegacy(details).orElseGet(() -> new ContentItem(request.title().trim()));
        item.update(request.title().trim(), normalize(request.originalTitle()), ContentType.ANIME,
                ContentFormat.ANIME, request.releaseYear(), normalize(request.description()),
                normalize(request.coverUrl()), details.duration() > 0 ? details.duration() : null,
                request.releaseStatus(), normalize(details.genre()), null, details.airedOn(), false);
        item.setShikimoriId(id);
        items.save(item);
        mergeEpisodes(item, details);
        return animeService.get(item.getId());
    }

    private void mergeEpisodes(ContentItem item, ShikimoriClient.AnimeDetails details) {
        int total = Math.max(details.episodes(), details.episodesAired());
        if (total == 0) return;
        ContentSeason season = seasons.findAllByContentIdOrderBySeasonNumber(item.getId()).stream().findFirst()
                .orElseGet(() -> { ContentSeason value = new ContentSeason(item); value.update(1, "Основной выпуск",
                    details.airedOn() == null ? null : details.airedOn().getYear()); return seasons.save(value); });
        Map<Integer, ContentEpisode> current = new HashMap<>();
        for (ContentEpisode episode : episodes.findAllBySeasonIdOrderByEpisodeNumber(season.getId()))
            current.put(episode.getEpisodeNumber(), episode);
        for (int number = 1; number <= total; number++) if (!current.containsKey(number)) {
            ContentEpisode episode = new ContentEpisode(season);
            episode.update(number, "Эпизод " + number, details.duration() > 0 ? details.duration() : null, null);
            episodes.save(episode);
        }
    }

    private Optional<ContentItem> findLegacy(ShikimoriClient.AnimeDetails details) {
        String russian = key(details.russian()), original = key(details.name());
        return items.findAllByItemTypeOrderByTitleAsc(ContentType.ANIME).stream()
                .filter(item -> item.getShikimoriId() == null).filter(item -> {
                    String title = key(item.getTitle()), itemOriginal = key(item.getOriginalTitle());
                    return (!russian.isEmpty() && (russian.equals(title) || russian.equals(itemOriginal)))
                            || (!original.isEmpty() && (original.equals(title) || original.equals(itemOriginal)));
                }).findFirst();
    }

    private ShikimoriAnimeDetails response(ShikimoriClient.AnimeDetails details, Long existingId) {
        return new ShikimoriAnimeDetails(details.id(), first(details.russian(), details.name(), "Anime " + details.id()),
                normalize(details.name()), details.airedOn() == null ? null : details.airedOn().getYear(),
                normalize(details.description()), normalize(details.imageUrl()), releaseStatus(details.status()),
                normalize(details.genre()), details.duration() > 0 ? details.duration() : null,
                Math.max(details.episodes(), details.episodesAired()), existingId);
    }

    private void rejectMovie(ShikimoriClient.AnimeDetails details) {
        if ("movie".equals(details.kind())) throw new InvalidRequestException(
                "Selected Shikimori item is a movie; add it in the Movies section");
    }
    private ReleaseStatus releaseStatus(String status) { return switch (status == null ? "" : status) {
        case "anons" -> ReleaseStatus.ANNOUNCED; case "ongoing" -> ReleaseStatus.ONGOING;
        case "released" -> ReleaseStatus.ENDED; default -> ReleaseStatus.RELEASED; }; }
    private String first(String... values) { for (String value : values) if (value != null && !value.isBlank()) return value.trim(); return "—"; }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String key(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT); }
}
