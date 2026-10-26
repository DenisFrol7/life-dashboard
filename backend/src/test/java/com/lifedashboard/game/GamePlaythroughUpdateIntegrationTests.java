package com.lifedashboard.game;

import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.game.dto.GameLibraryRequest;
import com.lifedashboard.game.dto.GamePlaythroughRequest;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class GamePlaythroughUpdateIntegrationTests {
    private static final Instant OLD_DATE = Instant.parse("2020-01-01T12:00:00Z");
    private static final Instant STARTED = Instant.parse("2026-10-01T12:00:00Z");
    private static final Instant COMPLETED = Instant.parse("2026-10-10T12:00:00Z");
    private static final Instant CORRECTED = Instant.parse("2026-10-11T12:00:00Z");

    @Autowired ContentService contentService;
    @Autowired GameLibraryService libraryService;
    @Autowired GamePlaythroughService service;
    @Autowired UserGameRepository games;
    @Autowired GamePlaythroughRepository playthroughs;
    @Autowired GamingPlatformRepository platforms;
    @Autowired GameSourceRepository sources;
    @Autowired EntityManager entityManager;
    private long libraryId;

    @BeforeEach
    void setUp() {
        long contentId = contentService.create(new ContentItemRequest("Playthrough update regression test",
                null, ContentType.GAME, null, 2020, null, null, null, ReleaseStatus.RELEASED)).id();
        libraryId = libraryService.create(contentId, new GameLibraryRequest(
                platforms.findByCode("PC").orElseThrow().getId(), sources.findByCode("STEAM").orElseThrow().getId(),
                GameAccessType.OWNED, null, null, "Copy note", 120L,
                UserContentStatus.IN_PROGRESS, STARTED, null)).id();
    }

    @ParameterizedTest
    @EnumSource(value = UserContentStatus.class, mode = EnumSource.Mode.EXCLUDE, names = "COMPLETED")
    void editingHistoryPreservesNonCompletedCopy(UserContentStatus status) {
        long id = addHistory(1, OLD_DATE);
        setCopy(status, null);
        var before = libraryService.get(libraryId);

        service.update(id, new GamePlaythroughRequest(null, "Updated note"));
        flushAndClear();
        assertEquals(before, libraryService.get(libraryId));
        assertEquals(OLD_DATE, playthroughs.findById(id).orElseThrow().getCompletedAt());

        service.update(id, new GamePlaythroughRequest(CORRECTED, "Corrected history"));
        flushAndClear();
        assertEquals(before, libraryService.get(libraryId));
        assertEquals(CORRECTED, playthroughs.findById(id).orElseThrow().getCompletedAt());
        assertEquals("Corrected history", playthroughs.findById(id).orElseThrow().getNote());
    }

    @Test
    void editingOlderCompletionDoesNotReplaceLatestCompletion() {
        long oldId = addHistory(1, OLD_DATE);
        long latestId = addHistory(2, COMPLETED);
        setCopy(UserContentStatus.COMPLETED, COMPLETED);
        var before = libraryService.get(libraryId);

        service.update(oldId, new GamePlaythroughRequest(CORRECTED, "Historical correction"));
        flushAndClear();

        assertEquals(before, libraryService.get(libraryId));
        assertEquals(COMPLETED, playthroughs.findById(latestId).orElseThrow().getCompletedAt());
        assertEquals(CORRECTED, playthroughs.findById(oldId).orElseThrow().getCompletedAt());
    }

    @Test
    void matchingDateOnOlderRecordDoesNotMakeItCurrent() {
        long oldId = addHistory(1, COMPLETED);
        addHistory(2, COMPLETED);
        setCopy(UserContentStatus.COMPLETED, COMPLETED);
        var before = libraryService.get(libraryId);

        service.update(oldId, new GamePlaythroughRequest(CORRECTED, null));
        flushAndClear();

        assertEquals(before, libraryService.get(libraryId));
    }

    @Test
    void latestCompletionDateIsStillSynchronizedForCompletedCopy() {
        addHistory(1, OLD_DATE);
        long id = addHistory(2, COMPLETED);
        setCopy(UserContentStatus.COMPLETED, COMPLETED);

        service.update(id, new GamePlaythroughRequest(CORRECTED, "Corrected date"));
        flushAndClear();

        var copy = libraryService.get(libraryId);
        assertEquals(UserContentStatus.COMPLETED, copy.status());
        assertEquals(STARTED, copy.startedAt());
        assertEquals(CORRECTED, copy.completedAt());
        assertEquals(120L, copy.legacyPlaytimeMinutes());
        assertEquals(100L, playthroughs.findById(id).orElseThrow().getPlaytimeMinutes());
    }

    @Test
    void editingNoteOrDatePreservesIndependentCopyCompletionDate() {
        long id = addHistory(1, OLD_DATE);
        setCopy(UserContentStatus.COMPLETED, COMPLETED);
        var before = libraryService.get(libraryId);

        service.update(id, new GamePlaythroughRequest(null, "Only a note"));
        flushAndClear();
        assertEquals(before, libraryService.get(libraryId));

        service.update(id, new GamePlaythroughRequest(CORRECTED, "Historical date"));
        flushAndClear();
        assertEquals(before, libraryService.get(libraryId));
    }

    private long addHistory(int number, Instant date) {
        return playthroughs.save(new GamePlaythrough(games.findById(libraryId).orElseThrow(),
                number, date, 100L, "Original note")).getId();
    }

    private void setCopy(UserContentStatus status, Instant completedAt) {
        UserGame game = games.findById(libraryId).orElseThrow();
        game.update(game.getPlatform(), game.getSource(), game.getAccessType(), game.getEdition(),
                game.getAcquiredAt(), game.getNote(), game.getLegacyPlaytimeMinutes(), status, STARTED, completedAt);
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }
}
