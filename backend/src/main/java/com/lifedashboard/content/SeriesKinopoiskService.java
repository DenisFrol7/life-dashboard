package com.lifedashboard.content;

import com.lifedashboard.common.error.DuplicateResourceException;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.dto.*;
import com.lifedashboard.content.myshows.KinopoiskCatalogClient;
import com.lifedashboard.content.myshows.KinopoiskCatalogData;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@Transactional(readOnly = true)
public class SeriesKinopoiskService {
    private final ContentItemRepository items;
    private final ContentSeasonRepository seasons;
    private final ContentEpisodeRepository episodes;
    private final KinopoiskCatalogClient kinopoisk;
    private final ConcurrentMap<Long, KinopoiskCatalogData> previewCache = new ConcurrentHashMap<>();

    public SeriesKinopoiskService(ContentItemRepository items, ContentSeasonRepository seasons,
            ContentEpisodeRepository episodes, KinopoiskCatalogClient kinopoisk) {
        this.items = items; this.seasons = seasons; this.episodes = episodes; this.kinopoisk = kinopoisk;
    }

    public List<KinopoiskSeriesCandidate> search(String query) {
        if (query == null || query.trim().length() < 2)
            throw new InvalidRequestException("Kinopoisk search query must contain at least 2 characters");
        return kinopoisk.searchSeries(query.trim()).stream().map(candidate ->
                new KinopoiskSeriesCandidate(candidate.filmId(), candidate.nameRu(), candidate.nameEn(),
                        candidate.year(), items.findByKinopoiskFilmId(candidate.filmId())
                                .map(ContentItem::getId).orElse(null))).toList();
    }

    public KinopoiskSeriesDetails preview(long filmId) {
        KinopoiskCatalogData catalog = kinopoisk.getCatalog(filmId);
        previewCache.put(filmId, catalog);
        return details(filmId, catalog, items.findByKinopoiskFilmId(filmId)
                .map(ContentItem::getId).orElse(null));
    }

    @Transactional
    public ContentItemResponse create(long filmId, ContentItemRequest request) {
        if (request.itemType() != ContentType.SERIES)
            throw new InvalidRequestException("Kinopoisk catalog entry must be a series");
        items.findByKinopoiskFilmId(filmId).ifPresent(existing -> {
            throw new DuplicateResourceException("Kinopoisk series already exists in catalog with id " + existing.getId());
        });
        KinopoiskCatalogData catalog = Optional.ofNullable(previewCache.remove(filmId))
                .orElseGet(() -> kinopoisk.getCatalog(filmId));
        ContentItem item = findLegacy(catalog).orElseGet(() -> new ContentItem(request.title().trim()));
        item.update(request.title().trim(), normalize(request.originalTitle()), ContentType.SERIES,
                request.format(), request.releaseYear(), normalize(request.description()),
                normalize(request.coverUrl()), request.durationMinutes(), request.releaseStatus(),
                normalize(request.genre()), normalize(request.developer()), request.releaseDate(), false);
        item.setKinopoiskFilmId(filmId);
        item.markKinopoiskEnriched();
        items.save(item);
        mergeStructure(item, catalog);
        return response(item);
    }

    private Optional<ContentItem> findLegacy(KinopoiskCatalogData catalog) {
        String russian = key(catalog.nameRu());
        String original = key(catalog.nameOriginal());
        return items.findAllByItemTypeOrderByTitleAsc(ContentType.SERIES).stream()
                .filter(item -> item.getKinopoiskFilmId() == null)
                .filter(item -> catalog.year() == null || item.getReleaseYear() == null
                        || catalog.year().equals(item.getReleaseYear()))
                .filter(item -> {
                    String title = key(item.getTitle());
                    String itemOriginal = key(item.getOriginalTitle());
                    return (!russian.isEmpty() && (russian.equals(title) || russian.equals(itemOriginal)))
                            || (!original.isEmpty() && (original.equals(title) || original.equals(itemOriginal)));
                }).findFirst();
    }

    private void mergeStructure(ContentItem item, KinopoiskCatalogData catalog) {
        Map<Integer, ContentSeason> currentSeasons = new HashMap<>();
        for (ContentSeason season : seasons.findAllByContentIdOrderBySeasonNumber(item.getId()))
            currentSeasons.put(season.getSeasonNumber(), season);
        for (KinopoiskCatalogData.Season sourceSeason : catalog.seasons()) {
            if (sourceSeason.number() < 1) continue;
            ContentSeason season = currentSeasons.get(sourceSeason.number());
            if (season == null) {
                season = new ContentSeason(item);
                season.update(sourceSeason.number(), "Сезон " + sourceSeason.number(), null);
                season = seasons.save(season);
            }
            Map<Integer, ContentEpisode> currentEpisodes = new HashMap<>();
            for (ContentEpisode episode : episodes.findAllBySeasonIdOrderByEpisodeNumber(season.getId()))
                currentEpisodes.put(episode.getEpisodeNumber(), episode);
            for (KinopoiskCatalogData.Episode sourceEpisode : sourceSeason.episodes()) {
                if (sourceEpisode.number() < 1) continue;
                String title = firstText(sourceEpisode.nameRu(), sourceEpisode.nameEn(),
                        "Эпизод " + sourceEpisode.number());
                ContentEpisode episode = currentEpisodes.get(sourceEpisode.number());
                if (episode == null) episode = new ContentEpisode(season);
                episode.update(sourceEpisode.number(), title, episode.getDurationMinutes(), sourceEpisode.releaseDate());
                episodes.save(episode);
            }
        }
    }

    private KinopoiskSeriesDetails details(long filmId, KinopoiskCatalogData catalog, Long existingId) {
        int episodeCount = catalog.seasons().stream().mapToInt(season -> season.episodes().size()).sum();
        return new KinopoiskSeriesDetails(filmId, firstText(catalog.nameRu(), catalog.nameOriginal(),
                "Сериал " + filmId), normalize(catalog.nameOriginal()), catalog.year(),
                normalize(catalog.description()), normalize(catalog.coverUrl()),
                releaseStatus(catalog.status(), catalog.completed()), normalize(catalog.genre()),
                catalog.seasons().size(), episodeCount, existingId);
    }

    private ReleaseStatus releaseStatus(String value, boolean completed) {
        if (value == null) return completed ? ReleaseStatus.ENDED : ReleaseStatus.ONGOING;
        return switch (value) {
            case "ONGOING", "FILMING", "PRE_PRODUCTION", "POST_PRODUCTION" -> ReleaseStatus.ONGOING;
            case "ANNOUNCED" -> ReleaseStatus.ANNOUNCED;
            case "COMPLETED" -> ReleaseStatus.ENDED;
            case "CLOSED", "CANCELLED" -> ReleaseStatus.CANCELLED;
            default -> completed ? ReleaseStatus.ENDED : ReleaseStatus.RELEASED;
        };
    }

    private String firstText(String... values) {
        for (String value : values) if (value != null && !value.isBlank()) return value.trim();
        return "—";
    }

    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String key(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT); }

    private ContentItemResponse response(ContentItem item) {
        return new ContentItemResponse(item.getId(), item.getTitle(), item.getOriginalTitle(), item.getItemType(),
                item.getFormat(), item.getReleaseYear(), item.getDescription(), item.getCoverUrl(),
                item.getDurationMinutes(), item.getReleaseStatus(), item.getGenre(), item.getDeveloper(),
                item.getReleaseDate(), item.isXboxPlayAnywhere());
    }
}
