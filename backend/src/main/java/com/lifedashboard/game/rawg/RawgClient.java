package com.lifedashboard.game.rawg;

import com.lifedashboard.common.error.InvalidRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Component
public class RawgClient {
    private static final Logger log = LoggerFactory.getLogger(RawgClient.class);
    private final RestClient client;
    private final String apiKey;

    public RawgClient(@Value("${RAWG_API_KEY:}") String apiKey) {
        this.client = RestClient.builder().baseUrl("https://api.rawg.io/api").build();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    public List<GameData> search(String query) {
        ensureConfigured();
        try {
            JsonNode root = client.get().uri(uri -> uri.path("/games")
                            .queryParam("key", apiKey)
                            .queryParam("search", query)
                            .queryParam("search_precise", true)
                            .queryParam("page_size", 12)
                            .build())
                    .retrieve().body(JsonNode.class);
            if (root == null) return List.of();
            List<GameData> result = new ArrayList<>();
            for (JsonNode node : root.path("results")) result.add(map(node));
            return List.copyOf(result);
        } catch (RestClientResponseException exception) {
            throw apiError(exception);
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("RAWG search failed for '{}': {}", query, exception.toString());
            throw new InvalidRequestException("Не удалось подключиться к API RAWG");
        }
    }

    public GameData getGame(long rawgId) {
        ensureConfigured();
        try {
            JsonNode node = client.get().uri(uri -> uri.path("/games/{id}")
                            .queryParam("key", apiKey).build(rawgId))
                    .retrieve().body(JsonNode.class);
            if (node == null) throw new InvalidRequestException("RAWG вернул пустой ответ");
            return map(node);
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == 404)
                throw new InvalidRequestException("Игра не найдена в RAWG");
            throw apiError(exception);
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("RAWG game request failed for {}: {}", rawgId, exception.toString());
            throw new InvalidRequestException("Не удалось загрузить игру из RAWG");
        }
    }

    private GameData map(JsonNode node) {
        LocalDate releaseDate = date(text(node, "released"));
        String description = text(node, "description_raw");
        if (description == null) description = plainText(text(node, "description"));
        return new GameData(node.path("id").asLong(), text(node, "slug"), text(node, "name"),
                different(text(node, "name_original"), text(node, "name")), releaseDate,
                description, text(node, "background_image"), names(node.path("genres"), false, 100),
                names(node.path("developers"), false, 200), platformNames(node), node.path("tba").asBoolean());
    }

    private List<String> platformNames(JsonNode node) {
        List<String> values = new ArrayList<>();
        for (JsonNode item : node.path("platforms")) {
            String name = text(item.path("platform"), "name");
            if (name != null) values.add(name);
        }
        return List.copyOf(values);
    }

    private String names(JsonNode node, boolean nested, int maximumLength) {
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            String name = text(nested ? item.path("value") : item, "name");
            if (name != null) values.add(name);
        }
        String joined = String.join(", ", values);
        return joined.isEmpty() ? null : joined.substring(0, Math.min(joined.length(), maximumLength));
    }

    private void ensureConfigured() {
        if (apiKey.isBlank())
            throw new InvalidRequestException("Добавьте RAWG_API_KEY в файл .env и перезапустите backend");
    }

    private InvalidRequestException apiError(RestClientResponseException exception) {
        return switch (exception.getStatusCode().value()) {
            case 401, 403 -> new InvalidRequestException("RAWG отклонил API-ключ. Проверьте RAWG_API_KEY в .env");
            case 429 -> new InvalidRequestException("Месячный лимит запросов RAWG исчерпан");
            default -> new InvalidRequestException("Запрос к API RAWG завершился ошибкой "
                    + exception.getStatusCode().value());
        };
    }

    private LocalDate date(String value) {
        try { return value == null ? null : LocalDate.parse(value); }
        catch (RuntimeException ignored) { return null; }
    }

    private String different(String value, String other) {
        return value == null || value.equalsIgnoreCase(other == null ? "" : other) ? null : value;
    }

    private String plainText(String value) {
        return value == null ? null : value.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) return null;
        String result = value.stringValue();
        return result == null || result.isBlank() ? null : result.trim();
    }

    public record GameData(long rawgId, String slug, String title, String originalTitle,
            LocalDate releaseDate, String description, String backgroundUrl, String genre,
            String developer, List<String> platforms, boolean tba) {}
}
