package com.lifedashboard.game.steam;

import com.lifedashboard.common.error.InvalidRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class SteamClient {
    private static final Logger log = LoggerFactory.getLogger(SteamClient.class);
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);
    private final RestClient client;
    private final String apiKey;
    private final String steamId64;
    private volatile CachedLibrary cachedLibrary;

    public SteamClient(@Value("${STEAM_API_KEY:}") String apiKey,
            @Value("${STEAM_ID64:}") String steamId64) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.steamId64 = steamId64 == null ? "" : steamId64.trim();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(10));
        requestFactory.setReadTimeout(Duration.ofSeconds(20));
        this.client = RestClient.builder()
                .baseUrl("https://api.steampowered.com")
                .requestFactory(requestFactory)
                .defaultHeader("x-webapi-key", this.apiKey)
                .build();
    }

    public SteamLibrary library() {
        CachedLibrary current = cachedLibrary;
        if (current != null && Instant.now().isBefore(current.loadedAt().plus(CACHE_TTL)))
            return current.library();
        synchronized (this) {
            current = cachedLibrary;
            if (current != null && Instant.now().isBefore(current.loadedAt().plus(CACHE_TTL)))
                return current.library();
            SteamLibrary loaded = loadLibrary();
            cachedLibrary = new CachedLibrary(Instant.now(), loaded);
            return loaded;
        }
    }

    private SteamLibrary loadLibrary() {
        ensureConfigured();
        try {
            JsonNode profileRoot = client.get()
                    .uri(uri -> uri.path("/ISteamUser/GetPlayerSummaries/v2/")
                            .queryParam("steamids", steamId64).build())
                    .retrieve().body(JsonNode.class);
            String profileName = firstProfileName(profileRoot);
            JsonNode libraryRoot = client.get()
                    .uri(uri -> uri.path("/IPlayerService/GetOwnedGames/v1/")
                            .queryParam("steamid", steamId64)
                            .queryParam("include_appinfo", true)
                            .queryParam("include_played_free_games", true)
                            .queryParam("format", "json")
                            .build())
                    .retrieve().body(JsonNode.class);
            if (libraryRoot == null || libraryRoot.path("response").get("game_count") == null)
                throw new InvalidRequestException(
                        "Steam не вернул библиотеку. Откройте доступ к игровой информации в настройках приватности");
            List<SteamOwnedGame> games = new ArrayList<>();
            for (JsonNode node : libraryRoot.path("response").path("games")) {
                long appId = node.path("appid").asLong();
                String title = text(node, "name");
                if (appId <= 0 || title == null) continue;
                long lastPlayed = node.path("rtime_last_played").asLong();
                games.add(new SteamOwnedGame(appId, title,
                        Math.max(0, node.path("playtime_forever").asLong()),
                        lastPlayed > 0 ? Instant.ofEpochSecond(lastPlayed) : null,
                        "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/"
                                + appId + "/capsule_sm_120.jpg"));
            }
            return new SteamLibrary(profileName, List.copyOf(games));
        } catch (RestClientResponseException exception) {
            throw apiError(exception);
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("Steam library request failed: {}", exception.getClass().getSimpleName());
            throw new InvalidRequestException("Не удалось подключиться к Steam Web API");
        }
    }

    public SteamAchievementSnapshot achievements(long appId) {
        ensureConfigured();
        if (appId <= 0) throw new InvalidRequestException("Некорректный Steam App ID");
        try {
            JsonNode schemaRoot = client.get()
                    .uri(uri -> uri.path("/ISteamUserStats/GetSchemaForGame/v2/")
                            .queryParam("key", apiKey)
                            .queryParam("appid", appId)
                            .queryParam("l", "russian")
                            .build())
                    .retrieve().body(JsonNode.class);
            JsonNode game = schemaRoot == null ? null : schemaRoot.path("game");
            JsonNode definitions = game == null ? null
                    : game.path("availableGameStats").path("achievements");
            if (definitions == null || !definitions.isArray() || definitions.isEmpty()) {
                return parseAchievements(appId, schemaRoot, null);
            }

            JsonNode playerRoot = client.get()
                    .uri(uri -> uri.path("/ISteamUserStats/GetPlayerAchievements/v1/")
                            .queryParam("key", apiKey)
                            .queryParam("appid", appId)
                            .queryParam("steamid", steamId64)
                            .queryParam("l", "russian")
                            .build())
                    .retrieve().body(JsonNode.class);
            return parseAchievements(appId, schemaRoot, playerRoot);
        } catch (RestClientResponseException exception) {
            log.debug("Steam achievement API error for app {}: status {}, body {}", appId,
                    exception.getStatusCode().value(), exception.getResponseBodyAsString());
            if (isPrivateProfileResponse(exception.getResponseBodyAsString())) {
                throw privateProfileError();
            }
            throw apiError(exception);
        } catch (RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            log.warn("Steam achievement request failed for app {}: {}", appId,
                    exception.getClass().getSimpleName());
            throw new InvalidRequestException("Не удалось загрузить достижения из Steam");
        }
    }

    SteamAchievementSnapshot parseAchievements(long appId, JsonNode schemaRoot, JsonNode playerRoot) {
        JsonNode game = schemaRoot == null ? null : schemaRoot.path("game");
        String gameName = game == null ? null : text(game, "gameName");
        JsonNode definitions = game == null ? null
                : game.path("availableGameStats").path("achievements");
        if (definitions == null || !definitions.isArray() || definitions.isEmpty()) {
            return new SteamAchievementSnapshot(appId, gameName, List.of());
        }
        JsonNode playerStats = playerRoot == null ? null : playerRoot.path("playerstats");
        if (playerStats == null || !playerStats.path("success").asBoolean()) {
            if (playerStats != null && isPrivateProfileResponse(text(playerStats, "error"))) {
                throw privateProfileError();
            }
            throw new InvalidRequestException(
                    "Steam не вернул достижения. Проверьте открытый доступ к игровой информации профиля");
        }
        Map<String, JsonNode> playerAchievements = new LinkedHashMap<>();
        for (JsonNode achievement : playerStats.path("achievements")) {
            String apiName = text(achievement, "apiname");
            if (apiName != null) playerAchievements.put(apiName, achievement);
        }

        List<SteamAchievementData> result = new ArrayList<>();
        for (JsonNode definition : definitions) {
            String apiName = text(definition, "name");
            if (apiName == null) continue;
            JsonNode playerAchievement = playerAchievements.get(apiName);
            boolean unlocked = playerAchievement != null
                    && playerAchievement.path("achieved").asInt() == 1;
            long unlockTime = unlocked ? playerAchievement.path("unlocktime").asLong() : 0L;
            String displayName = text(definition, "displayName");
            result.add(new SteamAchievementData(apiName,
                    displayName == null ? apiName : displayName,
                    text(definition, "description"), text(definition, "icon"),
                    text(definition, "icongray"), definition.path("hidden").asInt() == 1,
                    unlocked, unlockTime > 0 ? Instant.ofEpochSecond(unlockTime) : null));
        }
        return new SteamAchievementSnapshot(appId, gameName, List.copyOf(result));
    }

    private String firstProfileName(JsonNode root) {
        if (root == null) throw new InvalidRequestException("SteamID64 не найден");
        for (JsonNode player : root.path("response").path("players")) {
            String name = text(player, "personaname");
            if (name != null) return name;
        }
        throw new InvalidRequestException("SteamID64 не найден");
    }

    private void ensureConfigured() {
        if (apiKey.isBlank())
            throw new InvalidRequestException("Добавьте STEAM_API_KEY в файл .env и перезапустите backend");
        if (!steamId64.matches("7656119\\d{10}"))
            throw new InvalidRequestException("Добавьте корректный STEAM_ID64 в файл .env и перезапустите backend");
    }

    private InvalidRequestException apiError(RestClientResponseException exception) {
        return switch (exception.getStatusCode().value()) {
            case 401, 403 -> new InvalidRequestException(
                    "Steam отклонил API-ключ. Проверьте STEAM_API_KEY в .env");
            case 429 -> new InvalidRequestException(
                    "Steam временно ограничил запросы. Попробуйте немного позже");
            default -> new InvalidRequestException(
                    "Запрос к Steam Web API завершился ошибкой " + exception.getStatusCode().value());
        };
    }

    private boolean isPrivateProfileResponse(String response) {
        return response != null && response.toLowerCase(Locale.ROOT).contains("profile is not public");
    }

    private InvalidRequestException privateProfileError() {
        return new InvalidRequestException(
                "Steam не отдаёт достижения: откройте «Мой профиль» и «Доступ к игровой информации» "
                        + "в Steam → Редактировать профиль → Приватность");
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) return null;
        String result = value.stringValue();
        return result == null || result.isBlank() ? null : result.trim();
    }

    private record CachedLibrary(Instant loadedAt, SteamLibrary library) {}
}
