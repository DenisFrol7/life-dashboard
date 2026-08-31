package com.lifedashboard.content.myshows;

import com.lifedashboard.common.error.InvalidRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.jspecify.annotations.Nullable;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.time.LocalDate;

@Component
public class KinopoiskCatalogClient {

    private static final Logger log = LoggerFactory.getLogger(KinopoiskCatalogClient.class);
    private static final long MIN_REQUEST_INTERVAL_NANOS = TimeUnit.MILLISECONDS.toNanos(350);
    private static final Object RATE_LIMIT_LOCK = new Object();
    private static long lastRequestNanos;

    private final RestClient client;
    private final String apiKey;

    public KinopoiskCatalogClient(@Value("${KINOPOISK_API_KEY:}") String apiKey) {
        this.client = RestClient.builder().baseUrl("https://kinopoiskapiunofficial.tech").build();
        this.apiKey = apiKey.trim();
    }

    public List<KinopoiskMatchPreview.Candidate> searchSeries(String title) {
        if (apiKey.isBlank()) throw new InvalidRequestException("KINOPOISK_API_KEY is not configured");
        try {
            JsonNode response = requestWithRetry(title);
            List<KinopoiskMatchPreview.Candidate> result = new ArrayList<>();
            if (response == null) return result;
            for (JsonNode film : response.path("films")) {
                String type = text(film, "type");
                if (!isSeries(type)) continue;
                result.add(new KinopoiskMatchPreview.Candidate(film.path("filmId").asLong(),
                        text(film, "nameRu"), text(film, "nameEn"), text(film, "year"), type));
                if (result.size() == 5) break;
            }
            return List.copyOf(result);
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("Failed to process Kinopoisk response for title '{}': {}", title,
                    exception.toString(), exception);
            throw new InvalidRequestException("Could not connect to Kinopoisk API");
        }
    }

    public List<MovieCandidate> searchMovies(String title) {
        if (apiKey.isBlank()) throw new InvalidRequestException("KINOPOISK_API_KEY is not configured");
        try {
            JsonNode response = requestWithRetry(title);
            List<MovieCandidate> result = new ArrayList<>();
            if (response == null) return result;
            for (JsonNode film : response.path("films")) {
                String type = text(film, "type");
                if (isSeries(type)) continue;
                result.add(new MovieCandidate(film.path("filmId").asLong(), text(film, "nameRu"),
                        first(text(film, "nameEn"), text(film, "nameOriginal")), text(film, "year"),
                        text(film, "posterUrlPreview")));
                if (result.size() == 8) break;
            }
            return List.copyOf(result);
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("Failed to process Kinopoisk movie search for title '{}': {}", title,
                    exception.toString(), exception);
            throw new InvalidRequestException("Could not connect to Kinopoisk API");
        }
    }

    public MovieDetails getMovie(long filmId) {
        JsonNode details = requestWithRetry("/api/v2.2/films/" + filmId, null);
        if (details.path("serial").asBoolean(false) || isSeries(text(details, "type")))
            throw new InvalidRequestException("Selected Kinopoisk item is a series, not a movie");
        List<String> genres = new ArrayList<>();
        for (JsonNode genre : details.path("genres")) {
            String value = text(genre, "genre");
            if (value != null) genres.add(value);
        }
        return new MovieDetails(filmId, text(details, "nameRu"),
                first(text(details, "nameOriginal"), text(details, "nameEn")),
                details.path("year").isMissingNode() ? null : details.path("year").asInt(),
                text(details, "description"), text(details, "posterUrl"),
                details.path("filmLength").isMissingNode() || details.path("filmLength").isNull()
                        ? null : details.path("filmLength").asInt(),
                String.join(", ", genres), text(details, "productionStatus"),
                details.path("completed").asBoolean(false));
    }

    public UserRatings getUserRatings(String profileId) {
        if (apiKey.isBlank()) throw new InvalidRequestException("KINOPOISK_API_KEY is not configured");
        if (profileId == null || !profileId.matches("[A-Za-z0-9_-]+"))
            throw new InvalidRequestException("Invalid Kinopoisk profile id");
        List<UserRating> ratings = new ArrayList<>();
        int total = 0;
        int totalPages = 1;
        for (int page = 1; page <= totalPages; page++) {
            JsonNode response = requestWithRetry("/api/v1/kp_users/" + profileId + "/votes", "page", page);
            if (page == 1) {
                total = response.path("total").asInt();
                totalPages = response.path("totalPages").asInt(1);
            }
            for (JsonNode item : response.path("items")) {
                List<String> genres = new ArrayList<>();
                for (JsonNode genre : item.path("genres")) {
                    String value = text(genre, "genre");
                    if (value != null) genres.add(value);
                }
                ratings.add(new UserRating(item.path("kinopoiskId").asLong(), text(item, "nameRu"),
                        first(text(item, "nameOriginal"), text(item, "nameEn")),
                        nullableInt(item, "year"), nullableInt(item, "userRating"), text(item, "type"),
                        text(item, "posterUrlPreview"), String.join(", ", genres)));
            }
        }
        return new UserRatings(total, totalPages, List.copyOf(ratings));
    }

    public KinopoiskCatalogData getCatalog(long filmId) {
        JsonNode details = requestWithRetry("/api/v2.2/films/" + filmId, null);
        JsonNode seasonsResponse = requestWithRetry("/api/v2.2/films/" + filmId + "/seasons", null);
        List<KinopoiskCatalogData.Season> seasons = new ArrayList<>();
        for (JsonNode seasonNode : seasonsResponse.path("items")) {
            List<KinopoiskCatalogData.Episode> episodes = new ArrayList<>();
            for (JsonNode episode : seasonNode.path("episodes")) {
                String releaseDate = text(episode, "releaseDate");
                LocalDate date = null;
                try { if (releaseDate != null) date = LocalDate.parse(releaseDate); }
                catch (RuntimeException ignored) { }
                episodes.add(new KinopoiskCatalogData.Episode(episode.path("episodeNumber").asInt(),
                        text(episode, "nameRu"), text(episode, "nameEn"), date));
            }
            seasons.add(new KinopoiskCatalogData.Season(seasonNode.path("number").asInt(), List.copyOf(episodes)));
        }
        List<String> genres = new ArrayList<>();
        for (JsonNode genre : details.path("genres")) {
            String value = text(genre, "genre");
            if (value != null) genres.add(value);
        }
        return new KinopoiskCatalogData(text(details, "nameRu"), text(details, "nameOriginal"),
                details.path("year").isMissingNode() ? null : details.path("year").asInt(),
                text(details, "description"), text(details, "posterUrl"), String.join(", ", genres),
                text(details, "productionStatus"), details.path("completed").asBoolean(false),
                List.copyOf(seasons));
    }

    private JsonNode requestWithRetry(String title) {
        return requestWithRetry("/api/v2.1/films/search-by-keyword", title);
    }

    private JsonNode requestWithRetry(String path, String title) {
        return requestWithRetry(path, title == null ? null : "keyword", title);
    }

    private JsonNode requestWithRetry(String path, String queryName, Object queryValue) {
        for (int attempt = 0; attempt < 4; attempt++) {
            awaitRequestSlot();
            try {
                return client.get()
                        .uri(uri -> {
                            var builder = uri.path(path);
                            if (queryName != null) builder.queryParam(queryName, queryValue);
                            if ("keyword".equals(queryName)) builder.queryParam("page", 1);
                            return builder.build();
                        })
                        .header("X-API-KEY", apiKey)
                        .header(HttpHeaders.ACCEPT, "application/json")
                        .retrieve()
                        .body(JsonNode.class);
            } catch (RestClientResponseException exception) {
                int status = exception.getStatusCode().value();
                if (status == 401) throw new InvalidRequestException("Kinopoisk API key was rejected");
                if (status == 402) throw new InvalidRequestException("Kinopoisk API daily quota is exhausted");
                if (status != 429) {
                    throw new InvalidRequestException("Kinopoisk API request failed with status " + status);
                }
                if (attempt == 3) {
                    throw new InvalidRequestException(
                            "Kinopoisk API rate limit is still active. Please wait a few minutes and try again");
                }
                sleep(5_000L * (attempt + 1));
            }
        }
        throw new IllegalStateException("Unreachable Kinopoisk retry state");
    }

    private void awaitRequestSlot() {
        synchronized (RATE_LIMIT_LOCK) {
            long remaining = MIN_REQUEST_INTERVAL_NANOS - (System.nanoTime() - lastRequestNanos);
            if (remaining > 0) sleep(TimeUnit.NANOSECONDS.toMillis(remaining) + 1);
            lastRequestNanos = System.nanoTime();
        }
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new InvalidRequestException("Kinopoisk search was interrupted");
        }
    }

    private boolean isSeries(String type) {
        return type != null && (type.contains("TV_SERIES") || type.contains("MINI_SERIES") || type.contains("TV_SHOW"));
    }

    private String first(String primary, String fallback) { return primary == null ? fallback : primary; }

    public record MovieCandidate(long filmId, String nameRu, String nameOriginal, String year,
            String posterUrlPreview) {}
    public record MovieDetails(long filmId, String nameRu, String nameOriginal, Integer year,
            String description, String posterUrl, Integer durationMinutes, String genre,
            String productionStatus, boolean completed) {}
    public record UserRatings(int total, int totalPages, List<UserRating> items) {}
    public record UserRating(long filmId, String nameRu, String nameOriginal, Integer year,
            Integer userRating, String type, String posterUrlPreview, String genre) {}

    private Integer nullableInt(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asInt();
    }

    private @Nullable String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.stringValue();
    }
}
