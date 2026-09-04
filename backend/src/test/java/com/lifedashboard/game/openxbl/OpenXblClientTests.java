package com.lifedashboard.game.openxbl;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OpenXblClientTests {
    private final ObjectMapper mapper = new ObjectMapper();
    private final OpenXblClient client = new OpenXblClient("test-key");

    @Test
    void parsesXboxTitleHistory() throws Exception {
        OpenXblTitleHistory history = client.parseTitleHistory(mapper.readTree("""
                {"content":{"xuid":"2533274908559471","titles":[
                  {"titleId":"1397819386","name":"DEUS EX: HUMAN REVOLUTION","type":"Game",
                   "devices":["Xbox360","XboxOne"],
                   "achievement":{"currentAchievements":59,"totalAchievements":59,
                     "currentGamerscore":1250,"totalGamerscore":1250,"sourceVersion":1},
                   "titleHistory":{"lastTimePlayed":"2026-02-20T12:52:31.738Z"}},
                  {"titleId":"1","name":"Not a game","type":"Application"}
                ]}}
                """));

        assertEquals("2533274908559471", history.xuid());
        assertEquals(1, history.titles().size());
        OpenXblTitle title = history.titles().getFirst();
        assertEquals(1397819386L, title.titleId());
        assertEquals(59, title.currentAchievements());
        assertEquals(Instant.parse("2026-02-20T12:52:31.738Z"), title.lastPlayedAt());
    }

    @Test
    void calculatesModernProgressAndLastUnlockDate() throws Exception {
        OpenXblTitle title = new OpenXblTitle(2117095676L, "Planet of Lana",
                java.util.List.of("XboxSeries"), 2, 0, 300, 1000, 2, null);
        OpenXblProgress progress = client.parseModernProgress(title, mapper.readTree("""
                {"content":{"achievements":[
                  {"progressState":"Achieved","progression":{"timeUnlocked":"2026-05-15T19:47:12.377Z"},
                   "rewards":[{"type":"Gamerscore","value":"100"}]},
                  {"progressState":"Achieved","progression":{"timeUnlocked":"2026-05-16T00:31:04.903Z"},
                   "rewards":[{"type":"Gamerscore","value":"200"}]},
                  {"progressState":"NotStarted","progression":{},
                   "rewards":[{"type":"Gamerscore","value":"50"}]}
                ]}}
                """));

        assertEquals(3, progress.totalAchievements());
        assertEquals(2, progress.unlockedAchievements());
        assertEquals(350, progress.totalGamerscore());
        assertEquals(300, progress.earnedGamerscore());
        assertEquals(Instant.parse("2026-05-16T00:31:04.903Z"), progress.lastUnlockedAt());
        assertTrue(progress.exactAchievementDetails());
    }

    @Test
    void usesAggregateWithoutInventingXbox360UnlockDates() {
        OpenXblTitle title = new OpenXblTitle(1397819386L, "Deus Ex",
                java.util.List.of("Xbox360"), 59, 59, 1250, 1250, 1, null);

        OpenXblProgress progress = client.progress("xuid", title);

        assertEquals(59, progress.unlockedAchievements());
        assertEquals(1250, progress.earnedGamerscore());
        assertFalse(progress.exactAchievementDetails());
        assertEquals(null, progress.lastUnlockedAt());
    }
}
