package com.lifedashboard.content;

import com.lifedashboard.content.dto.MovieCatalogResponse;
import com.lifedashboard.content.dto.ContentItemResponse;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.content.dto.KinopoiskMovieCandidate;
import com.lifedashboard.content.dto.KinopoiskMovieDetails;
import com.lifedashboard.content.myshows.KinopoiskCatalogClient;
import com.lifedashboard.common.error.DuplicateResourceException;
import com.lifedashboard.common.error.InvalidRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class MovieCatalogService {
    private final ContentItemRepository items; private final KinopoiskCatalogClient kinopoisk; private final long userId;
    public MovieCatalogService(ContentItemRepository items, KinopoiskCatalogClient kinopoisk,
            @Value("${app.default-user-id}") long userId) {
        this.items = items; this.kinopoisk = kinopoisk; this.userId = userId;
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

    public List<KinopoiskMovieCandidate> searchKinopoisk(String query) {
        if (query == null || query.trim().length() < 2)
            throw new InvalidRequestException("Movie search query must contain at least 2 characters");
        return kinopoisk.searchMovies(query.trim()).stream().map(candidate -> new KinopoiskMovieCandidate(
                candidate.filmId(), candidate.nameRu(), candidate.nameOriginal(), candidate.year(),
                candidate.posterUrlPreview(), items.findByKinopoiskFilmId(candidate.filmId())
                        .map(ContentItem::getId).orElse(null))).toList();
    }

    public KinopoiskMovieDetails previewKinopoisk(long filmId) {
        var details = kinopoisk.getMovie(filmId);
        return response(details, items.findByKinopoiskFilmId(filmId).map(ContentItem::getId).orElse(null));
    }

    @Transactional
    public ContentItemResponse createFromKinopoisk(long filmId, ContentItemRequest request) {
        items.findByKinopoiskFilmId(filmId).ifPresent(existing -> {
            throw new DuplicateResourceException("Kinopoisk movie already exists in catalog with id " + existing.getId());
        });
        var details = kinopoisk.getMovie(filmId);
        if (request.itemType() != ContentType.MOVIE
                || (request.format() != ContentFormat.LIVE_ACTION && request.format() != ContentFormat.ANIMATION))
            throw new InvalidRequestException("Kinopoisk catalog entry must be a movie");
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
