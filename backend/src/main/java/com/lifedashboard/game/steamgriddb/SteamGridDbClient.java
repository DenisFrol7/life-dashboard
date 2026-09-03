package com.lifedashboard.game.steamgriddb;

import com.lifedashboard.common.error.InvalidRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Component
public class SteamGridDbClient {
    private static final Logger log = LoggerFactory.getLogger(SteamGridDbClient.class);
    private final RestClient client;
    private final String apiKey;

    public SteamGridDbClient(@Value("${STEAMGRIDDB_API_KEY:}") String apiKey) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.client = RestClient.builder()
                .baseUrl("https://www.steamgriddb.com/api/v2")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + this.apiKey)
                .build();
    }

    public List<SteamGridDbGameCandidate> search(String query) {
        ensureConfigured();
        try {
            JsonNode root = client.get().uri(uri -> uri.path("/search/autocomplete/{query}").build(query))
                    .retrieve().body(JsonNode.class);
            if (root == null) return List.of();
            List<SteamGridDbGameCandidate> result = new ArrayList<>();
            for (JsonNode node : root.path("data")) {
                long id = node.path("id").asLong();
                String name = text(node, "name");
                if (id <= 0 || name == null) continue;
                result.add(new SteamGridDbGameCandidate(id, name, node.path("verified").asBoolean(),
                        strings(node.path("types"))));
            }
            return List.copyOf(result);
        } catch (RestClientResponseException exception) {
            throw apiError(exception);
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("SteamGridDB search failed for '{}': {}", query, exception.toString());
            throw new InvalidRequestException("Не удалось подключиться к API SteamGridDB");
        }
    }

    public List<SteamGridDbCoverCandidate> covers(long gameId) {
        ensureConfigured();
        try {
            JsonNode root = client.get().uri(uri -> uri.path("/grids/game/{id}")
                            .queryParam("dimensions", "600x900")
                            .queryParam("types", "static")
                            .queryParam("nsfw", "false")
                            .queryParam("humor", "false")
                            .queryParam("epilepsy", "false")
                            .queryParam("limit", 12)
                            .build(gameId))
                    .retrieve().body(JsonNode.class);
            if (root == null) return List.of();
            List<SteamGridDbCoverCandidate> result = new ArrayList<>();
            for (JsonNode node : root.path("data")) {
                long gridId = node.path("id").asLong();
                String imageUrl = text(node, "url");
                if (gridId <= 0 || imageUrl == null) continue;
                result.add(new SteamGridDbCoverCandidate(gameId, gridId, imageUrl, text(node, "thumb"),
                        node.path("score").asInt(), text(node, "style"), text(node.path("author"), "name")));
            }
            result.sort(Comparator.comparingInt(SteamGridDbCoverCandidate::score).reversed()
                    .thenComparingLong(SteamGridDbCoverCandidate::gridId));
            return List.copyOf(result);
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == 404) return List.of();
            throw apiError(exception);
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("SteamGridDB cover request failed for {}: {}", gameId, exception.toString());
            throw new InvalidRequestException("Не удалось загрузить обложки из SteamGridDB");
        }
    }

    private void ensureConfigured() {
        if (apiKey.isBlank())
            throw new InvalidRequestException(
                    "Добавьте STEAMGRIDDB_API_KEY в файл .env и перезапустите backend");
    }

    private InvalidRequestException apiError(RestClientResponseException exception) {
        return switch (exception.getStatusCode().value()) {
            case 401, 403 -> new InvalidRequestException(
                    "SteamGridDB отклонил API-ключ. Проверьте STEAMGRIDDB_API_KEY в .env");
            case 429 -> new InvalidRequestException(
                    "SteamGridDB временно ограничил запросы. Попробуйте немного позже");
            default -> new InvalidRequestException("Запрос к API SteamGridDB завершился ошибкой "
                    + exception.getStatusCode().value());
        };
    }

    private List<String> strings(JsonNode node) {
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            String value = item.stringValue();
            if (value != null && !value.isBlank()) values.add(value.trim());
        }
        return List.copyOf(values);
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) return null;
        String result = value.stringValue();
        return result == null || result.isBlank() ? null : result.trim();
    }
}
