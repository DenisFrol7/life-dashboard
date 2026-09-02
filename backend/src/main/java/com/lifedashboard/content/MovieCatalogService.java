package com.lifedashboard.content;

import com.lifedashboard.content.dto.MovieCatalogResponse;
import com.lifedashboard.content.dto.ContentItemResponse;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.content.dto.KinopoiskMovieCandidate;
import com.lifedashboard.content.dto.KinopoiskMovieDetails;
import com.lifedashboard.content.dto.KinopoiskRatingsPreview;
import com.lifedashboard.content.dto.KinopoiskRatingsImportResult;
import com.lifedashboard.content.dto.KinopoiskMovieEnrichmentResult;
import com.lifedashboard.content.dto.MovieCatalogPageResponse;
import com.lifedashboard.content.dto.LibraryEntryRequest;
import com.lifedashboard.data.DataTransferService;
import com.lifedashboard.content.myshows.KinopoiskCatalogClient;
import com.lifedashboard.common.error.DuplicateResourceException;
import com.lifedashboard.common.error.InvalidRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@Transactional(readOnly = true)
public class MovieCatalogService {
    private final ContentItemRepository items; private final KinopoiskCatalogClient kinopoisk;
    private final ContentService contentService; private final DataTransferService dataTransfer; private final long userId;
    private final ConcurrentMap<String, KinopoiskRatingsPreview> ratingsCache = new ConcurrentHashMap<>();
    public MovieCatalogService(ContentItemRepository items, KinopoiskCatalogClient kinopoisk, ContentService contentService,
            DataTransferService dataTransfer,
            @Value("${app.default-user-id}") long userId) {
        this.items = items; this.kinopoisk = kinopoisk; this.contentService = contentService;
        this.dataTransfer = dataTransfer; this.userId = userId;
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

    public MovieCatalogPageResponse getPage(int page, int size, String query, UserContentStatus status) {
        if (page < 0 || size < 1 || size > 100)
            throw new InvalidRequestException("Номер страницы фильмов не может быть отрицательным, а размер должен быть от 1 до 100");
        List<MovieCatalogResponse> all = getAll();
        String normalized = Optional.ofNullable(normalize(query)).orElse("");
        List<MovieCatalogResponse> filtered = all.stream()
                .filter(item -> normalized.isEmpty() || normalize(item.title()).contains(normalized)
                        || normalize(item.originalTitle()) != null && normalize(item.originalTitle()).contains(normalized))
                .filter(item -> status == null || item.userStatus() == status)
                .toList();
        int from = Math.min(page * size, filtered.size());
        int to = Math.min(from + size, filtered.size());
        var statistics = new MovieCatalogPageResponse.Statistics(all.size(),
                (int) all.stream().filter(item -> item.libraryId() != null).count(),
                (int) all.stream().filter(item -> item.userStatus() == UserContentStatus.COMPLETED).count(),
                (int) all.stream().filter(item -> item.userStatus() == UserContentStatus.PLANNED).count(),
                (int) all.stream().filter(item -> item.format() == ContentFormat.LIVE_ACTION).count(),
                (int) all.stream().filter(item -> item.format() == ContentFormat.ANIMATION).count());
        return new MovieCatalogPageResponse(filtered.subList(from, to), page, size, filtered.size(),
                to < filtered.size(), statistics);
    }

    public List<KinopoiskMovieCandidate> searchKinopoisk(String query) {
        if (query == null || query.trim().length() < 2)
            throw new InvalidRequestException("Запрос для поиска фильма должен содержать не менее 2 символов");
        return kinopoisk.searchMovies(query.trim()).stream().map(candidate -> new KinopoiskMovieCandidate(
                candidate.filmId(), candidate.nameRu(), candidate.nameOriginal(), candidate.year(),
                candidate.posterUrlPreview(), items.findByKinopoiskFilmId(candidate.filmId())
                        .map(ContentItem::getId).orElse(null))).toList();
    }

    public KinopoiskMovieDetails previewKinopoisk(long filmId) {
        var details = kinopoisk.getMovie(filmId);
        return response(details, items.findByKinopoiskFilmId(filmId).map(ContentItem::getId).orElse(null));
    }

    public KinopoiskRatingsPreview previewRatings(String profileId) {
        var source = kinopoisk.getUserRatings(profileId);
        List<ContentItem> catalog = items.findAllByItemTypeOrderByTitleAsc(ContentType.MOVIE);
        List<KinopoiskRatingsPreview.Item> movies = source.items().stream()
                .filter(item -> !isSeries(item.type()))
                .map(item -> {
                    Long existingId = catalog.stream()
                            .filter(existing -> existing.getKinopoiskFilmId() != null
                                    && existing.getKinopoiskFilmId() == item.filmId())
                            .map(ContentItem::getId).findFirst()
                            .orElseGet(() -> findLegacyMovie(catalog, item).map(ContentItem::getId).orElse(null));
                    String title = item.nameRu() == null || item.nameRu().isBlank()
                            ? item.nameOriginal() : item.nameRu();
                    return new KinopoiskRatingsPreview.Item(item.filmId(), title, item.nameOriginal(), item.year(),
                            item.userRating(), item.type(), item.posterUrlPreview(), item.genre(), existingId);
                }).toList();
        int seriesCount = source.items().size() - movies.size();
        int existingCount = (int) movies.stream().filter(item -> item.existingContentId() != null).count();
        var preview = new KinopoiskRatingsPreview(profileId, source.total(), source.totalPages(), movies.size(),
                seriesCount, existingCount, movies.size() - existingCount, movies);
        ratingsCache.put(profileId, preview);
        return preview;
    }

    @Transactional
    public KinopoiskRatingsImportResult importRatings(String profileId) {
        KinopoiskRatingsPreview preview = ratingsCache.get(profileId);
        if (preview == null)
            throw new InvalidRequestException("Перед подтверждением импорта загрузите предварительный просмотр оценок Кинопоиска");
        String backupFile = dataTransfer.createAutomaticBackup().toString();
        int created = 0;
        int updated = 0;
        int skipped = 0;
        for (KinopoiskRatingsPreview.Item source : preview.movies()) {
            ContentItem item = items.findByKinopoiskFilmId(source.filmId()).orElse(null);
            if (item == null && source.existingContentId() != null)
                item = items.findById(source.existingContentId()).orElse(null);
            boolean isNew = item == null;
            if (isNew) item = new ContentItem(source.title());
            if (source.title() == null || source.title().isBlank()) { skipped++; continue; }
            item.update(source.title().trim(), trim(source.originalTitle()), ContentType.MOVIE,
                    format(source.genre()), source.year(), isNew ? null : item.getDescription(),
                    trim(source.posterUrlPreview()) == null && !isNew ? item.getCoverUrl() : trim(source.posterUrlPreview()),
                    isNew ? null : item.getDurationMinutes(), isNew ? ReleaseStatus.RELEASED : item.getReleaseStatus(),
                    trim(source.genre()) == null && !isNew ? item.getGenre() : trim(source.genre()), null, null, false);
            item.setKinopoiskFilmId(source.filmId());
            item = items.save(item);
            Short rating = source.userRating() == null ? null : source.userRating().shortValue();
            contentService.putInLibrary(item.getId(), new LibraryEntryRequest(UserContentStatus.COMPLETED,
                    rating, false, null, null, null));
            if (isNew) created++; else updated++;
        }
        ratingsCache.remove(profileId);
        return new KinopoiskRatingsImportResult(preview.movieCount(), created, updated, skipped, backupFile);
    }

    @Transactional
    public KinopoiskMovieEnrichmentResult enrichMovies(int batchSize) {
        if (batchSize < 1 || batchSize > 400)
            throw new InvalidRequestException("За один раз можно обновить от 1 до 400 фильмов");
        List<ContentItem> pending = items
                .findAllByItemTypeAndKinopoiskFilmIdIsNotNullAndKinopoiskEnrichedAtIsNullOrderByIdAsc(ContentType.MOVIE);
        int total = pending.size();
        if (total == 0) return new KinopoiskMovieEnrichmentResult(0, 0, 0, false, null);
        String backupFile = dataTransfer.createAutomaticBackup().toString();
        int updated = 0;
        boolean quotaExhausted = false;
        for (ContentItem item : pending.stream().limit(batchSize).toList()) {
            try {
                var details = kinopoisk.getMovie(item.getKinopoiskFilmId());
                String title = details.nameRu() == null || details.nameRu().isBlank()
                        ? item.getTitle() : details.nameRu().trim();
                item.update(title, trim(details.nameOriginal()), ContentType.MOVIE, format(details.genre()),
                        details.year(), trim(details.description()), trim(details.posterUrl()), details.durationMinutes(),
                        releaseStatus(details.productionStatus(), details.completed()), trim(details.genre()),
                        null, null, false);
                item.markKinopoiskEnriched();
                items.save(item);
                updated++;
            } catch (InvalidRequestException exception) {
                if (exception.getMessage() != null && exception.getMessage().contains("daily quota")) {
                    quotaExhausted = true;
                    break;
                }
            }
        }
        return new KinopoiskMovieEnrichmentResult(total, updated, total - updated, quotaExhausted, backupFile);
    }

    @Transactional
    public ContentItemResponse createFromKinopoisk(long filmId, ContentItemRequest request) {
        items.findByKinopoiskFilmId(filmId).ifPresent(existing -> {
            throw new DuplicateResourceException("Фильм Кинопоиска уже есть в каталоге с идентификатором " + existing.getId());
        });
        var details = kinopoisk.getMovie(filmId);
        if (request.itemType() != ContentType.MOVIE
                || (request.format() != ContentFormat.LIVE_ACTION && request.format() != ContentFormat.ANIMATION))
            throw new InvalidRequestException("Выбранная запись Кинопоиска должна быть фильмом");
        ContentItem item = findLegacyMovie(details, request).orElseGet(() -> new ContentItem(request.title().trim()));
        item.update(request.title().trim(), trim(request.originalTitle()), ContentType.MOVIE, request.format(),
                request.releaseYear(), trim(request.description()), trim(request.coverUrl()), request.durationMinutes(),
                request.releaseStatus(), trim(request.genre()), null, request.releaseDate(), false);
        item.setKinopoiskFilmId(filmId);
        items.save(item);
        return new ContentItemResponse(item.getId(), item.getTitle(), item.getOriginalTitle(), item.getItemType(),
                item.getFormat(), item.getReleaseYear(), item.getDescription(), item.getCoverUrl(),
                item.getDurationMinutes(), item.getReleaseStatus(), item.getGenre(), item.getDeveloper(),
                item.getReleaseDate(), item.isXboxPlayAnywhere());
    }

    private Optional<ContentItem> findLegacyMovie(KinopoiskCatalogClient.MovieDetails details,
            ContentItemRequest request) {
        String russianTitle = normalize(details.nameRu());
        String originalTitle = normalize(details.nameOriginal());
        String requestedTitle = normalize(request.title());
        Integer year = details.year() != null ? details.year() : request.releaseYear();
        return items.findAllByItemTypeOrderByTitleAsc(ContentType.MOVIE).stream()
                .filter(item -> item.getKinopoiskFilmId() == null)
                .filter(item -> year == null || item.getReleaseYear() == null || year.equals(item.getReleaseYear()))
                .filter(item -> {
                    String title = normalize(item.getTitle());
                    String itemOriginal = normalize(item.getOriginalTitle());
                    return matches(title, russianTitle, originalTitle, requestedTitle)
                            || matches(itemOriginal, russianTitle, originalTitle, requestedTitle);
                })
                .findFirst();
    }

    private Optional<ContentItem> findLegacyMovie(List<ContentItem> catalog,
            KinopoiskCatalogClient.UserRating rating) {
        String russianTitle = normalize(rating.nameRu());
        String originalTitle = normalize(rating.nameOriginal());
        return catalog.stream()
                .filter(item -> item.getKinopoiskFilmId() == null)
                .filter(item -> rating.year() == null || item.getReleaseYear() == null
                        || rating.year().equals(item.getReleaseYear()))
                .filter(item -> matches(normalize(item.getTitle()), russianTitle, originalTitle)
                        || matches(normalize(item.getOriginalTitle()), russianTitle, originalTitle))
                .findFirst();
    }

    private boolean isSeries(String type) {
        return type != null && (type.contains("TV_SERIES") || type.contains("MINI_SERIES")
                || type.contains("TV_SHOW"));
    }

    private boolean matches(String value, String... candidates) {
        if (value == null) return false;
        for (String candidate : candidates) if (value.equals(candidate)) return true;
        return false;
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim().toLowerCase(Locale.ROOT).replace('ё', 'е')
                .replaceAll("[^\\p{L}\\p{N}]", "");
    }

    private KinopoiskMovieDetails response(KinopoiskCatalogClient.MovieDetails details, Long existingId) {
        String title = details.nameRu() == null || details.nameRu().isBlank()
                ? details.nameOriginal() : details.nameRu();
        return new KinopoiskMovieDetails(details.filmId(), title, details.nameOriginal(),
                format(details.genre()), details.year(), details.description(), details.posterUrl(),
                details.durationMinutes(), releaseStatus(details.productionStatus(), details.completed()),
                details.genre(), existingId);
    }
    private ContentFormat format(String genre) {
        String value = genre == null ? "" : genre.toLowerCase(java.util.Locale.ROOT);
        return value.contains("мультфильм") || value.contains("аниме")
                ? ContentFormat.ANIMATION : ContentFormat.LIVE_ACTION;
    }
    private ReleaseStatus releaseStatus(String value, boolean completed) {
        if (completed || "COMPLETED".equals(value)) return ReleaseStatus.RELEASED;
        if ("ANNOUNCED".equals(value)) return ReleaseStatus.ANNOUNCED;
        return value == null ? ReleaseStatus.RELEASED : ReleaseStatus.ONGOING;
    }
    private String trim(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
