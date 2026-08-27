package com.lifedashboard.game;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.content.dto.LibraryEntryRequest;
import com.lifedashboard.game.dto.GameLibraryRequest;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class GameLibraryServiceIntegrationTests {
    private static final String GAME = "Game library integration test";
    private static final String MOVIE = "Not a game integration test";
    @Autowired ContentService contentService;
    @Autowired ContentItemRepository contentRepository;
    @Autowired GameLibraryService gameService;
    @Autowired GamePlaythroughService playthroughService;
    @Autowired GamingPlatformRepository platforms;
    @Autowired GameSourceRepository sources;

    @BeforeEach void setUp() { cleanup(); }

    @Test
    void createsAndFiltersOwnedGame() {
        try {
            long contentId = create(GAME, ContentType.GAME, null);
            long platformId = platforms.findByCode("PC").orElseThrow().getId();
            long sourceId = sources.findByCode("STEAM").orElseThrow().getId();
            var created = gameService.create(contentId, request(platformId, sourceId,
                    GameAccessType.OWNED, UserContentStatus.IN_PROGRESS));
            gameService.updateProfile(contentId, new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,
                    null, false, null, null, null));

            assertEquals("STEAM", created.source().code());
            assertEquals(UserContentStatus.IN_PROGRESS, gameService.get(created.id()).status());
            assertEquals(1, gameService.getAll(UserContentStatus.IN_PROGRESS, platformId).size());
        } finally { cleanup(); }
    }

    @Test
    void validatesContentTypeAndSubscriptionSource() {
        try {
            long movieId = create(MOVIE, ContentType.MOVIE, ContentFormat.LIVE_ACTION);
            long platformId = platforms.findByCode("PC").orElseThrow().getId();
            long steamId = sources.findByCode("STEAM").orElseThrow().getId();
            assertThrows(InvalidRequestException.class, () -> gameService.create(movieId,
                    request(platformId, steamId, GameAccessType.OWNED, UserContentStatus.PLANNED)));

            long gameId = create(GAME, ContentType.GAME, null);
            assertThrows(InvalidRequestException.class, () -> gameService.create(gameId,
                    request(platformId, steamId, GameAccessType.SUBSCRIPTION, UserContentStatus.PLANNED)));
            long gamePassId = sources.findByCode("GAME_PASS").orElseThrow().getId();
            assertEquals(GameAccessType.SUBSCRIPTION, gameService.create(gameId,
                    request(platformId, gamePassId, GameAccessType.SUBSCRIPTION, UserContentStatus.PLANNED)).accessType());
        } finally { cleanup(); }
    }

    @Test
    void keepsMultipleLibraryCopiesForOneGame() {
        try {
            long contentId = create(GAME, ContentType.GAME, null);
            long pcId = platforms.findByCode("PC").orElseThrow().getId();
            long xbox360Id = platforms.findByCode("XBOX_360").orElseThrow().getId();
            long steamId = sources.findByCode("STEAM").orElseThrow().getId();
            long xboxStoreId = sources.findByCode("XBOX_STORE").orElseThrow().getId();

            var steam = gameService.create(contentId,
                    request(pcId, steamId, GameAccessType.OWNED, UserContentStatus.IN_PROGRESS));
            var xbox = gameService.create(contentId,
                    request(xbox360Id, xboxStoreId, GameAccessType.OWNED, UserContentStatus.IN_PROGRESS));

            gameService.updateProfile(contentId, new LibraryEntryRequest(UserContentStatus.COMPLETED,
                    (short) 9, true, null, Instant.parse("2025-08-12T09:00:00Z"), "Пройдено полностью"));
            gameService.update(steam.id(), new GameLibraryRequest(pcId, steamId, GameAccessType.OWNED,
                    "Deluxe Edition", null, "Физическая копия", 120L));

            var copies = gameService.getAll(null, null).stream()
                    .filter(entry -> entry.contentId().equals(contentId)).toList();
            assertEquals(2, copies.size());
            assertNotEquals(steam.id(), xbox.id());
            assertTrue(copies.stream().anyMatch(entry -> entry.source().code().equals("STEAM")));
            assertTrue(copies.stream().anyMatch(entry -> entry.source().code().equals("XBOX_STORE")));
            assertTrue(copies.stream().allMatch(entry -> entry.status() == UserContentStatus.COMPLETED));
            assertTrue(copies.stream().allMatch(entry -> Short.valueOf((short) 9).equals(entry.rating())));
            assertTrue(copies.stream().allMatch(entry -> entry.favorite()));
            assertEquals("Deluxe Edition", gameService.get(steam.id()).edition());
            assertNull(gameService.get(xbox.id()).edition());
        } finally { cleanup(); }
    }

    @Test
    void backfillsEmptyFirstPlaythroughFromLegacyPlaytime() {
        try {
            long contentId = create(GAME, ContentType.GAME, null);
            long platformId = platforms.findByCode("PC").orElseThrow().getId();
            long sourceId = sources.findByCode("STEAM").orElseThrow().getId();
            Instant completedAt = Instant.parse("2025-08-12T09:00:00Z");
            var initial = new GameLibraryRequest(platformId, sourceId, GameAccessType.OWNED,
                    null, null, null, 0L);
            long libraryId = gameService.create(contentId, initial).id();
            gameService.updateProfile(contentId, new LibraryEntryRequest(UserContentStatus.COMPLETED,
                    null, false, null, completedAt, null));
            assertEquals(0, playthroughService.getAll(libraryId).getFirst().playtimeMinutes());

            var withLegacyTime = new GameLibraryRequest(platformId, sourceId, GameAccessType.OWNED,
                    null, null, null, 600L);
            gameService.update(libraryId, withLegacyTime);
            gameService.updateProfile(contentId, new LibraryEntryRequest(UserContentStatus.COMPLETED,
                    null, false, null, completedAt, null));

            assertEquals(600, playthroughService.getAll(libraryId).getFirst().playtimeMinutes());
        } finally { cleanup(); }
    }

    private long create(String title, ContentType type, ContentFormat format) {
        return contentService.create(new ContentItemRequest(title, null, type, format, 2025,
                null, null, null, ReleaseStatus.RELEASED)).id();
    }
    private GameLibraryRequest request(long platform, long source, GameAccessType access, UserContentStatus status) {
        return new GameLibraryRequest(platform, source, access, null, null, null, 0L);
    }
    private void cleanup() {
        contentRepository.findByTitle(GAME).ifPresent(contentRepository::delete);
        contentRepository.findByTitle(MOVIE).ifPresent(contentRepository::delete);
    }
}
