package com.lifedashboard.anime;

import com.lifedashboard.anime.dto.AnimeRequest;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class AnimeServiceIntegrationTests {
    private static final String ANIME = "Anime section integration test";
    private static final String MOVIE = "Animated movie integration test";
    @Autowired AnimeService animeService;
    @Autowired ContentService contentService;
    @Autowired ViewingService viewingService;
    @Autowired ContentItemRepository contentRepository;

    @BeforeEach void setUp() { cleanup(); }

    @Test
    void createsEpisodicAnimeAndPausesAfterAllAvailableEpisodes() {
        try {
            var created = animeService.create(new AnimeRequest(ANIME, null, 2026,
                    "Series description", null, ReleaseStatus.ONGOING));
            animeService.putInLibrary(created.id(), new LibraryEntryRequest(UserContentStatus.PLANNED,
                    null, true, null, null, null));
            long seasonId = viewingService.createSeason(created.id(), new SeasonRequest(1, null, 2026)).id();
            long episodeId = viewingService.createEpisode(seasonId,
                    new EpisodeRequest(1, "First episode", 24, null)).id();
            viewingService.watchEpisode(episodeId, new WatchRequest(null));

            var details = animeService.get(created.id());
            assertEquals(UserContentStatus.PAUSED, details.userStatus());
            assertEquals(1, details.seasons().size());
            assertTrue(details.seasons().getFirst().episodes().getFirst().watched());
            assertEquals(1, details.seasons().getFirst().episodes().getFirst().watchCount());
            assertEquals(1, animeService.getAll(ReleaseStatus.ONGOING, UserContentStatus.PAUSED).size());
        } finally { cleanup(); }
    }

    @Test
    void doesNotExposeAnimatedMoviesAsAnime() {
        try {
            long movieId = contentService.create(new ContentItemRequest(MOVIE, null, ContentType.MOVIE,
                    ContentFormat.ANIMATION, 2026, null, null, 100, ReleaseStatus.RELEASED)).id();
            assertThrows(ResourceNotFoundException.class, () -> animeService.get(movieId));
            assertTrue(animeService.getAll(null, null).stream().noneMatch(item -> item.id().equals(movieId)));
        } finally { cleanup(); }
    }

    private void cleanup() {
        contentRepository.findByTitle(ANIME).ifPresent(contentRepository::delete);
        contentRepository.findByTitle(MOVIE).ifPresent(contentRepository::delete);
    }
}
