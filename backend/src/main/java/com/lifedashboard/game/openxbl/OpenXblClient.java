package com.lifedashboard.game.openxbl;

import com.lifedashboard.common.error.InvalidRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class OpenXblClient {
    private static final Logger log = LoggerFactory.getLogger(OpenXblClient.class);
    private final RestClient client;
    private final String apiKey;

    public OpenXblClient(@Value("${OPENXBL_API_KEY:}") String apiKey) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));
        this.client = RestClient.builder()
                .baseUrl("https://xbl.io/api/v2")
                .requestFactory(requestFactory)
                .defaultHeader("X-Authorization", this.apiKey)
                .defaultHeader("Accept", "application/json")
                .build();
    }

    public OpenXblTitleHistory titleHistory() {
        ensureConfigured();
        try {
            JsonNode root = client.get().uri("/player/titleHistory")
                    .retrieve().body(JsonNode.class);
            return parseTitleHistory(root);
        } catch (RestClientResponseException exception) {
            throw apiError(exception);
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("OpenXBL title history request failed: {}", exception.getClass().getSimpleName());
            throw new InvalidRequestException("Не удалось подключиться к OpenXBL");
        }
    }

    public OpenXblProgress progress(String xuid, OpenXblTitle title) {
        ensureConfigured();
        if (title.sourceVersion() <= 1) {
            return aggregateProgress(title);
        }
        try {
            JsonNode root = client.get()
                    .uri("/achievements/player/{xuid}/{titleId}", xuid, title.titleId())
                    .retrieve().body(JsonNode.class);
            OpenXblProgress detailed = parseModernProgress(title, root);
            return detailed.totalAchievements() == 0 && title.totalGamerscore() > 0
                    ? aggregateProgress(title) : detailed;
        } catch (RestClientResponseException exception) {
            throw apiError(exception);
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("OpenXBL achievement request failed for title {}: {}", title.titleId(),
                    exception.getClass().getSimpleName());
            throw new InvalidRequestException("Не удалось загрузить достижения из OpenXBL");
        }
    }

    public Map<Long, Long> playtimeMinutes(String xuid, List<Long> titleIds) {
        ensureConfigured();
        if (xuid == null || xuid.isBlank() || titleIds.isEmpty()) return Map.of();
        List<Map<String, String>> requestedStats = titleIds.stream().distinct()
                .map(titleId -> Map.of("name", "MinutesPlayed",
                        "titleId", String.valueOf(titleId)))
                .toList();
        Map<String, Object> body = Map.of(
                "xuids", List.of(xuid),
                "groups", List.of(),
                "stats", requestedStats);
        try {
            JsonNode root = client.post().uri("/player/stats")
                    .body(body).retrieve().body(JsonNode.class);
            return parsePlaytimeMinutes(root);
        } catch (RestClientResponseException exception) {
            throw apiError(exception);
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("OpenXBL playtime request failed: {}", exception.getClass().getSimpleName());
            throw new InvalidRequestException("Не удалось загрузить игровое время из OpenXBL");
        }
    }

    OpenXblTitleHistory parseTitleHistory(JsonNode root) {
        JsonNode content = root == null ? null : root.path("content");
        String xuid = content == null ? null : text(content, "xuid");
        if (xuid == null) throw new InvalidRequestException("OpenXBL не вернул XUID профиля");
        List<OpenXblTitle> titles = new ArrayList<>();
        for (JsonNode node : content.path("titles")) {
            long titleId = node.path("titleId").asLong();
            String name = text(node, "name");
            if (titleId <= 0 || name == null || !"Game".equalsIgnoreCase(text(node, "type"))) continue;
            List<String> devices = new ArrayList<>();
            for (JsonNode device : node.path("devices")) {
                String value = device.stringValue();
                if (value != null && !value.isBlank()) devices.add(value.trim());
            }
            JsonNode achievement = node.path("achievement");
            titles.add(new OpenXblTitle(titleId, name, List.copyOf(devices),
                    nonNegative(achievement.path("currentAchievements").asInt()),
                    nonNegative(achievement.path("totalAchievements").asInt()),
                    nonNegative(achievement.path("currentGamerscore").asInt()),
                    nonNegative(achievement.path("totalGamerscore").asInt()),
                    nonNegative(achievement.path("sourceVersion").asInt()),
                    instant(node.path("titleHistory"), "lastTimePlayed"),
                    text(node, "mediaItemType"), secureImage(text(node, "displayImage")),
                    node.path("gamePass").path("isGamePass").asBoolean()));
        }
        return new OpenXblTitleHistory(xuid, List.copyOf(titles));
    }

    OpenXblProgress parseModernProgress(OpenXblTitle title, JsonNode root) {
        JsonNode achievements = root == null ? null : root.path("content").path("achievements");
        if (achievements == null || !achievements.isArray()) return aggregateProgress(title);
        int total = 0;
        int unlocked = 0;
        int totalScore = 0;
        int earnedScore = 0;
        List<Instant> unlockDates = new ArrayList<>();
        for (JsonNode achievement : achievements) {
            total++;
            int score = gamerscore(achievement);
            totalScore += score;
            boolean achieved = "Achieved".equalsIgnoreCase(text(achievement, "progressState"));
            if (achieved) {
                unlocked++;
                earnedScore += score;
                Instant unlockedAt = instant(achievement.path("progression"), "timeUnlocked");
                if (unlockedAt != null) unlockDates.add(unlockedAt);
            }
        }
        Instant lastUnlockedAt = unlockDates.stream().max(Comparator.naturalOrder()).orElse(null);
        return new OpenXblProgress(title.titleId(), total, unlocked, totalScore, earnedScore,
                lastUnlockedAt, true);
    }

    Map<Long, Long> parsePlaytimeMinutes(JsonNode root) {
        Map<Long, Long> result = new LinkedHashMap<>();
        JsonNode collections = root == null ? null
                : root.path("content").path("statlistscollection");
        if (collections == null || !collections.isArray()) return Map.of();
        for (JsonNode collection : collections) {
            for (JsonNode stat : collection.path("stats")) {
                if (!"MinutesPlayed".equalsIgnoreCase(text(stat, "name"))) continue;
                long titleId = stat.path("titleid").asLong();
                String value = text(stat, "value");
                if (titleId <= 0 || value == null) continue;
                try {
                    long minutes = Long.parseLong(value);
                    if (minutes >= 0) result.put(titleId, minutes);
                } catch (NumberFormatException ignored) {
                    // A title may expose MinutesPlayed using an unsupported value format.
                }
            }
        }
        return Map.copyOf(result);
    }

    private OpenXblProgress aggregateProgress(OpenXblTitle title) {
        return new OpenXblProgress(title.titleId(), title.totalAchievements(),
                title.currentAchievements(), title.totalGamerscore(), title.currentGamerscore(),
                null, false);
    }

    private int gamerscore(JsonNode achievement) {
        for (JsonNode reward : achievement.path("rewards")) {
            if (!"Gamerscore".equalsIgnoreCase(text(reward, "type"))) continue;
            String value = text(reward, "value");
            try {
                return value == null ? 0 : Math.max(0, Integer.parseInt(value));
            } catch (NumberFormatException ignored) {
                return 0;
            }
        }
        return 0;
    }

    private Instant instant(JsonNode node, String field) {
        String value = node == null ? null : text(node, field);
        if (value == null) return null;
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) return null;
        String result = value.stringValue();
        return result == null || result.isBlank() ? null : result.trim();
    }

    private int nonNegative(int value) {
        return Math.max(0, value);
    }

    private String secureImage(String value) {
        return value != null && value.startsWith("http://")
                ? "https://" + value.substring("http://".length()) : value;
    }

    private void ensureConfigured() {
        if (apiKey.isBlank()) {
            throw new InvalidRequestException(
                    "Добавьте OPENXBL_API_KEY в файл .env и перезапустите backend");
        }
    }

    private InvalidRequestException apiError(RestClientResponseException exception) {
        return switch (exception.getStatusCode().value()) {
            case 401, 403 -> new InvalidRequestException(
                    "OpenXBL отклонил API-ключ. Проверьте OPENXBL_API_KEY в .env");
            case 429 -> new InvalidRequestException(
                    "Лимит запросов OpenXBL исчерпан. Попробуйте после его обновления");
            default -> new InvalidRequestException(
                    "Запрос к OpenXBL завершился ошибкой " + exception.getStatusCode().value());
        };
    }
}
