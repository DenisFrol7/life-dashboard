package com.lifedashboard.content;

import com.lifedashboard.content.dto.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class SeriesCatalogServiceIntegrationTests {
    private static final String TITLE = "Series catalog summary test";

    @Autowired ContentService contentService;
    @Autowired ViewingService viewingService;
    @Autowired SeriesCatalogService catalogService;
    @Autowired ContentItemRepository contentRepository;

    @BeforeEach void setUp() { cleanup(); }
    @AfterEach void tearDown() { cleanup(); }

    @Test
    void returnsCompleteCatalogSummaryInOneQuery() {
        long contentId = contentService.create(new ContentItemRequest(TITLE, "Original", ContentType.SERIES,
                ContentFormat.LIVE_ACTION, 2026, null, null, null, ReleaseStatus.ONGOING)).id();
        contentService.putInLibrary(contentId, new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,
                (short) 8, true, null, null, null));
        long seasonId = viewingService.createSeason(contentId, new SeasonRequest(1, null, 2026)).id();
        long watchedEpisodeId = viewingService.createEpisode(seasonId,
                new EpisodeRequest(1, "First", 50, null)).id();
        viewingService.createEpisode(seasonId, new EpisodeRequest(2, "Second", 45, null));
        viewingService.watchEpisode(watchedEpisodeId, new WatchRequest(null));

        var result = catalogService.getAll().stream().filter(item -> item.id() == contentId).findFirst().orElseThrow();

        assertEquals(UserContentStatus.IN_PROGRESS, result.userStatus());
        assertEquals((short) 8, result.rating());
        assertTrue(result.favorite());
        assertEquals(1, result.seasonCount());
        assertEquals(2, result.episodeCount());
        assertEquals(1, result.watchedEpisodeCount());
        assertEquals(50, result.watchedMinutes());
    }

    private void cleanup() { contentRepository.findByTitle(TITLE).ifPresent(contentRepository::delete); }
}
