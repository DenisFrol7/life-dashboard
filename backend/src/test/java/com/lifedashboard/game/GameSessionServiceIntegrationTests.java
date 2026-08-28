package com.lifedashboard.game;

import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.content.dto.LibraryEntryRequest;
import com.lifedashboard.game.dto.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class GameSessionServiceIntegrationTests {
    private static final String TITLE = "Game session integration test";
    @Autowired ContentService contentService;
    @Autowired ContentItemRepository contentRepository;
    @Autowired GameLibraryService gameLibrary;
    @Autowired GameSessionService sessions;
    @Autowired GamePlaythroughService playthroughs;
    @Autowired XboxProgressService xboxProgress;
    @Autowired GamingPlatformRepository platforms;
    @Autowired GameSourceRepository sources;

    @BeforeEach void setUp() { cleanup(); }

    @Test
    void createsUpdatesListsAndDeletesSession() {
        try {
            long contentId = contentService.create(new ContentItemRequest(TITLE, null, ContentType.GAME,
                    null, 2026, null, null, null, ReleaseStatus.RELEASED)).id();
            long platformId = platforms.findByCode("XBOX_SERIES").orElseThrow().getId();
            long sourceId = sources.findByCode("XBOX_STORE").orElseThrow().getId();
            long libraryId = gameLibrary.create(contentId, new GameLibraryRequest(platformId, sourceId,
                    GameAccessType.OWNED, null, null, null, 600L)).id();
            gameLibrary.updateProfile(contentId, new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,
                    null, false, null, null, null));
            xboxProgress.put(libraryId, new XboxProgressRequest(20, 10, 1000, 200));
            Instant startedAt = Instant.parse("2026-08-06T17:00:00Z");

            var created = sessions.create(libraryId, new GameSessionRequest(startedAt, 90, " First run ", 2, 50));
            assertEquals(TITLE, created.title());
            assertEquals("First run", created.note());
            assertEquals(12, xboxProgress.get(libraryId).unlockedAchievements());
            assertEquals(250, xboxProgress.get(libraryId).earnedGamerscore());
            assertEquals(1, sessions.getAll(startedAt.minusSeconds(1), startedAt.plusSeconds(1)).size());

            var updated = sessions.update(created.id(), new GameSessionRequest(startedAt, 120, null, 3, 70));
            assertEquals(120, updated.durationMinutes());
            assertEquals(13, xboxProgress.get(libraryId).unlockedAchievements());
            assertEquals(270, xboxProgress.get(libraryId).earnedGamerscore());
            Instant completedAt = startedAt.plusSeconds(10_000);
            gameLibrary.update(libraryId, new GameLibraryRequest(platformId, sourceId,
                    GameAccessType.OWNED, null, null, null, 600L,
                    UserContentStatus.COMPLETED, startedAt, completedAt));
            assertEquals(1, playthroughs.getAll(libraryId).size());
            assertEquals(completedAt, playthroughs.getAll(libraryId).getFirst().completedAt());
            Instant correctedAt = completedAt.plusSeconds(86_400);
            gameLibrary.update(libraryId, new GameLibraryRequest(platformId, sourceId,
                    GameAccessType.OWNED, null, null, null, 600L,
                    UserContentStatus.COMPLETED, startedAt, correctedAt));
            assertEquals(1, playthroughs.getAll(libraryId).size());
            assertEquals(correctedAt, playthroughs.getAll(libraryId).getFirst().completedAt());
            var playthrough = playthroughs.create(libraryId, new GamePlaythroughRequest(startedAt, "Completed"));
            assertEquals(2, playthrough.playthroughNumber());
            assertEquals(720, playthrough.playtimeMinutes());
            var editedPlaythrough = playthroughs.update(playthrough.id(),
                    new GamePlaythroughRequest(correctedAt, " Updated "));
            assertEquals(correctedAt, editedPlaythrough.completedAt());
            assertEquals("Updated", editedPlaythrough.note());
            playthroughs.delete(playthrough.id());
            assertEquals(1, playthroughs.getAll(libraryId).size());
            sessions.delete(created.id());
            assertTrue(sessions.getAll(startedAt.minusSeconds(1), startedAt.plusSeconds(1)).isEmpty());
            assertEquals(10, xboxProgress.get(libraryId).unlockedAchievements());
            assertEquals(200, xboxProgress.get(libraryId).earnedGamerscore());
        } finally { cleanup(); }
    }

    private void cleanup() { contentRepository.findByTitle(TITLE).ifPresent(contentRepository::delete); }
}
