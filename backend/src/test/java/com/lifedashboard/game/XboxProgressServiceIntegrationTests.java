package com.lifedashboard.game;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.game.dto.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;

@SpringBootTest
class XboxProgressServiceIntegrationTests {
    private static final String TITLE = "Xbox progress integration test";
    @Autowired ContentService contentService;
    @Autowired ContentItemRepository contentRepository;
    @Autowired GameLibraryService gameLibraryService;
    @Autowired XboxProgressService progressService;
    @Autowired XboxAchievementGroupService groupService;
    @Autowired XboxLibrarySummaryService summaryService;
    @Autowired GamingPlatformRepository platforms;
    @Autowired GameSourceRepository sources;

    @BeforeEach void setUp() { cleanup(); }

    @Test
    void upsertsProgressAndCalculatesPercentages() {
        try {
            long entryId = createLibraryEntry("XBOX_SERIES");
            var result = progressService.put(entryId, new XboxProgressRequest(50, 25, 1000, 333));
            assertEquals(50.0, result.achievementPercent());
            assertEquals(33.3, result.gamerscorePercent());
            assertNotNull(result.lastUpdatedAt());

            var updated = progressService.put(entryId, new XboxProgressRequest(50, 50, 1000, 1000));
            assertEquals(result.id(), updated.id());
            assertEquals(100.0, updated.achievementPercent());
            assertEquals(100.0, updated.gamerscorePercent());
            var loaded = progressService.get(entryId);
            assertEquals(updated.id(), loaded.id());
            assertEquals(updated.earnedGamerscore(), loaded.earnedGamerscore());
            assertEquals(updated.gamerscorePercent(), loaded.gamerscorePercent());
            assertEquals(updated.lastUpdatedAt().toEpochMilli(), loaded.lastUpdatedAt().toEpochMilli());
        } finally { cleanup(); }
    }

    @Test
    void rejectsInvalidTotalsAndNonXboxPlatform() {
        try {
            long xboxEntry = createLibraryEntry("XBOX_SERIES");
            assertThrows(InvalidRequestException.class, () -> progressService.put(xboxEntry,
                    new XboxProgressRequest(10, 11, 100, 50)));
            cleanup();
            long pcEntry = createLibraryEntry("PC");
            assertThrows(InvalidRequestException.class, () -> progressService.put(pcEntry,
                    new XboxProgressRequest(10, 5, 100, 50)));
        } finally { cleanup(); }
    }

    @Test
    void aggregatesBaseGameAndDlcProgress() {
        try {
            long entryId = createLibraryEntry("XBOX_SERIES");
            progressService.put(entryId, new XboxProgressRequest(50, 25, 1000, 300));
            var dlc = groupService.createDlc(entryId,
                    new XboxAchievementGroupRequest("Expansion", 10, 2, 500, 100,
                            Instant.parse("2025-08-16T09:00:00Z")));
            assertEquals(Instant.parse("2025-08-16T09:00:00Z"), dlc.completedAt());

            var aggregate = progressService.get(entryId);
            assertEquals(60, aggregate.totalAchievements());
            assertEquals(27, aggregate.unlockedAchievements());
            assertEquals(1500, aggregate.totalGamerscore());
            assertEquals(400, aggregate.earnedGamerscore());

            groupService.update(dlc.id(), new XboxAchievementGroupRequest("Expansion", 10, 5, 500, 200,
                    Instant.parse("2025-08-16T09:00:00Z")));
            assertEquals(30, progressService.get(entryId).unlockedAchievements());
            assertEquals(500, progressService.get(entryId).earnedGamerscore());
            groupService.delete(dlc.id());
            assertEquals(50, progressService.get(entryId).totalAchievements());
            assertEquals(1000, progressService.get(entryId).totalGamerscore());
        } finally { cleanup(); }
    }

    @Test
    void loadsProgressAndBaseGameInOneCatalogSummary() {
        try {
            long entryId = createLibraryEntry("XBOX_SERIES");
            progressService.put(entryId, new XboxProgressRequest(50, 25, 1000, 300));

            var summary = summaryService.getAll().stream()
                    .filter(item -> item.libraryEntryId().equals(entryId)).findFirst().orElseThrow();

            assertEquals(25, summary.progress().unlockedAchievements());
            assertNotNull(summary.baseGame());
            assertEquals(XboxAchievementGroupType.BASE_GAME, summary.baseGame().groupType());
            assertEquals(300, summary.baseGame().earnedGamerscore());
        } finally { cleanup(); }
    }

    private long createLibraryEntry(String platformCode) {
        long contentId = contentService.create(new ContentItemRequest(TITLE, null, ContentType.GAME,
                null, 2025, null, null, null, ReleaseStatus.RELEASED)).id();
        long platform = platforms.findByCode(platformCode).orElseThrow().getId();
        long source = sources.findByCode("XBOX_STORE").orElseThrow().getId();
        return gameLibraryService.create(contentId, new GameLibraryRequest(platform, source,
                GameAccessType.OWNED, null, null, null, 0L)).id();
    }
    private void cleanup() {
        contentRepository.findByTitle(TITLE).ifPresent(contentRepository::delete);
    }
}
