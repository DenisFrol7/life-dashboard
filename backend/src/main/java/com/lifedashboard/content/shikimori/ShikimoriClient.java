package com.lifedashboard.content.shikimori;

import com.lifedashboard.common.error.InvalidRequestException;
import org.springframework.http.HttpHeaders;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Component
public class ShikimoriClient {
    private static final Logger log = LoggerFactory.getLogger(ShikimoriClient.class);
    private final RestClient client = RestClient.builder().baseUrl("https://shikimori.io").build();

    public List<AnimeCandidate> search(String query) {
        try {
            JsonNode response = client.get().uri(uri -> uri.path("/api/animes")
                            .queryParam("search", query).queryParam("limit", 12).build())
                    .header(HttpHeaders.USER_AGENT, "LifeDashboard/1.5.0 (personal local application)")
                    .header(HttpHeaders.ACCEPT, "application/json").retrieve().body(JsonNode.class);
            List<AnimeCandidate> result = new ArrayList<>();
            if (response == null) return result;
            for (JsonNode node : response) {
                String kind = text(node, "kind");
                if ("movie".equals(kind)) continue;
                String image = text(node.path("image"), "preview");
                if (image != null && image.startsWith("/")) image = "https://shikimori.io" + image;
                result.add(new AnimeCandidate(node.path("id").asLong(), text(node, "name"),
                        text(node, "russian"), kind, text(node, "status"), image));
            }
            return List.copyOf(result);
        } catch (RestClientResponseException exception) {
            throw new InvalidRequestException("Shikimori API request failed with status "
                    + exception.getStatusCode().value());
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("Failed to search Shikimori for '{}': {}", query, exception.toString(), exception);
            throw new InvalidRequestException("Could not search Shikimori API");
        }
    }

    public AnimeDetails getAnime(long id) {
        try {
            JsonNode node = client.get().uri("/api/animes/{id}", id)
                    .header(HttpHeaders.USER_AGENT, "LifeDashboard/1.5.0 (personal local application)")
                    .header(HttpHeaders.ACCEPT, "application/json").retrieve().body(JsonNode.class);
            if (node == null) throw new InvalidRequestException("Shikimori returned an empty response");
            List<String> genres = new ArrayList<>();
            for (JsonNode genre : node.path("genres")) {
                String value = text(genre, "russian");
                if (value != null) genres.add(value);
            }
            String image = text(node.path("image"), "original");
            if (image != null && image.startsWith("/")) image = "https://shikimori.io" + image;
            return new AnimeDetails(node.path("id").asLong(), text(node, "name"), text(node, "russian"),
                    text(node, "kind"), text(node, "status"), node.path("episodes").asInt(),
                    node.path("episodes_aired").asInt(), node.path("duration").asInt(),
                    date(text(node, "aired_on")), date(text(node, "released_on")),
                    text(node, "description"), image, String.join(", ", genres));
        } catch (RestClientResponseException exception) {
            throw new InvalidRequestException("Shikimori API request failed with status "
                    + exception.getStatusCode().value());
        } catch (InvalidRequestException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            log.warn("Failed to load Shikimori anime {}: {}", id, exception.toString(), exception);
            throw new InvalidRequestException("Could not process Shikimori API response for anime " + id);
        }
    }

    private LocalDate date(String value) { try { return value == null ? null : LocalDate.parse(value); }
        catch (RuntimeException ignored) { return null; } }
    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.stringValue();
    }

    public record AnimeDetails(long id, String name, String russian, String kind, String status,
            int episodes, int episodesAired, int duration, LocalDate airedOn, LocalDate releasedOn,
            String description, String imageUrl, String genre) {}
    public record AnimeCandidate(long id, String name, String russian, String kind, String status,
            String imageUrl) {}
}
