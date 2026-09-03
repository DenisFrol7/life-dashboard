package com.lifedashboard.game.steam;

import com.lifedashboard.common.error.InvalidRequestException;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SteamClientTests {
    private final ObjectMapper mapper = new ObjectMapper();
    private final SteamClient client = new SteamClient("0123456789abcdef0123456789abcdef",
            "76561198000000000");

    @Test
    void mergesAchievementSchemaWithPlayerUnlocks() {
        JsonNode schema = mapper.readTree("""
                {"game":{"gameName":"Portal 2","availableGameStats":{"achievements":[
                  {"name":"OPEN_DOOR","displayName":"Открыть дверь","description":"Описание",
                   "icon":"https://cdn/unlocked.jpg","icongray":"https://cdn/locked.jpg","hidden":0},
                  {"name":"SECRET","displayName":"Секрет","description":"Тайна",
                   "icon":"https://cdn/secret.jpg","icongray":"https://cdn/secret-gray.jpg","hidden":1}
                ]}}}
                """);
        JsonNode player = mapper.readTree("""
                {"playerstats":{"success":true,"achievements":[
                  {"apiname":"OPEN_DOOR","achieved":1,"unlocktime":1700000000},
                  {"apiname":"SECRET","achieved":0,"unlocktime":0}
                ]}}
                """);

        SteamAchievementSnapshot result = client.parseAchievements(620L, schema, player);

        assertEquals(620L, result.appId());
        assertEquals("Portal 2", result.gameName());
        assertEquals(2, result.achievements().size());
        assertEquals("Открыть дверь", result.achievements().get(0).displayName());
        assertTrue(result.achievements().get(0).unlocked());
        assertEquals(Instant.ofEpochSecond(1700000000), result.achievements().get(0).unlockedAt());
        assertTrue(result.achievements().get(1).hidden());
        assertFalse(result.achievements().get(1).unlocked());
        assertNull(result.achievements().get(1).unlockedAt());
    }

    @Test
    void returnsEmptySnapshotForGameWithoutAchievements() {
        JsonNode schema = mapper.readTree("{" +
                "\"game\":{\"gameName\":\"No achievements\",\"availableGameStats\":{}}}");

        SteamAchievementSnapshot result = client.parseAchievements(10L, schema, null);

        assertEquals("No achievements", result.gameName());
        assertTrue(result.achievements().isEmpty());
    }

    @Test
    void rejectsUnavailablePrivateAchievementData() {
        JsonNode schema = mapper.readTree("""
                {"game":{"availableGameStats":{"achievements":[{"name":"ONE"}]}}}
                """);
        JsonNode player = mapper.readTree("{" +
                "\"playerstats\":{\"success\":false,\"error\":\"Profile is not public\"}}");

        InvalidRequestException error = assertThrows(InvalidRequestException.class,
                () -> client.parseAchievements(10L, schema, player));
        assertTrue(error.getMessage().contains("Доступ к игровой информации"));
    }
}
