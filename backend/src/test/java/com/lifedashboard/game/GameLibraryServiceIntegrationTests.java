package com.lifedashboard.game;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.game.dto.GameLibraryRequest;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class GameLibraryServiceIntegrationTests {
    private static final String GAME = "Game library integration test";
    private static final String MOVIE = "Not a game integration test";
    @Autowired ContentService contentService;
    @Autowired ContentItemRepository contentRepository;
    @Autowired GameLibraryService gameService;
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

            assertEquals("STEAM", created.source().code());
            assertEquals(UserContentStatus.IN_PROGRESS, created.status());
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

    private long create(String title, ContentType type, ContentFormat format) {
        return contentService.create(new ContentItemRequest(title, null, type, format, 2025,
                null, null, null, ReleaseStatus.RELEASED)).id();
    }
    private GameLibraryRequest request(long platform, long source, GameAccessType access, UserContentStatus status) {
        return new GameLibraryRequest(platform, source, access, null, null, null, status,
                null, false, null, null, null);
    }
    private void cleanup() {
        contentRepository.findByTitle(GAME).ifPresent(contentRepository::delete);
        contentRepository.findByTitle(MOVIE).ifPresent(contentRepository::delete);
    }
}
