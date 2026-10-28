package com.lifedashboard.content;

import com.lifedashboard.book.BookFormat;
import com.lifedashboard.book.BookService;
import com.lifedashboard.book.BookRepository;
import com.lifedashboard.book.BookProgress;
import com.lifedashboard.book.BookProgressRepository;
import com.lifedashboard.book.ReadingSession;
import com.lifedashboard.book.ReadingSessionRepository;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import com.lifedashboard.book.dto.*;
import com.lifedashboard.analytics.AnalyticsService;
import com.lifedashboard.timeline.TimelineService;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.content.dto.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class LibraryRemovalIntegrationTests {
    private static final Instant WATCHED = Instant.parse("2020-02-01T12:00:00Z");
    @Autowired ContentService contentService;
    @Autowired ViewingService viewing;
    @Autowired AnimeService anime;
    @Autowired BookService books;
    @Autowired AnalyticsService analytics;
    @Autowired TimelineService timeline;
    @Autowired UserContentRepository library;
    @Autowired EntityManager entityManager;
    @Autowired BookRepository bookRepository;
    @Autowired BookProgressRepository progressRepository;
    @Autowired ReadingSessionRepository sessionsRepository;
    @Autowired UserRepository users;

    @ParameterizedTest
    @EnumSource(value = ContentType.class, names = {"MOVIE", "SERIES", "ANIME"})
    void removingMediaFromLibraryPreservesCatalogAndWatchHistory(ContentType type) {
        long id = contentService.create(new ContentItemRequest("Library removal regression test", null, type,
                type == ContentType.ANIME ? ContentFormat.ANIME : ContentFormat.LIVE_ACTION,
                2020, "Description", null, 25, ReleaseStatus.ENDED)).id();
        List<WatchResponse> movieHistory = null;
        ViewingStructureResponse structure = null;
        if (type == ContentType.MOVIE) {
            viewing.watchMovie(id, new WatchRequest(WATCHED));
            movieHistory = viewing.movieHistory(id);
        } else {
            long season = viewing.createSeason(id, new SeasonRequest(1, "Season 1", 2020)).id();
            viewing.createEpisode(season, new EpisodeRequest(1, "Episode 1", 25, null));
            viewing.watchSeason(season, new WatchRequest(WATCHED));
            structure = viewing.viewingStructure(id);
        }
        contentService.putInLibrary(id, new LibraryEntryRequest(UserContentStatus.COMPLETED,
                (short) 9, true, WATCHED, WATCHED, "Personal note"));
        var catalogItem = contentService.get(id);

        if (type == ContentType.ANIME) anime.removeFromLibrary(id);
        else contentService.removeFromLibrary(id);
        flushAndClear();

        assertTrue(library.findByUserIdAndContentId(1L, id).isEmpty());
        assertEquals(catalogItem, contentService.get(id));
        if (type == ContentType.MOVIE) assertEquals(movieHistory, viewing.movieHistory(id));
        else assertEquals(structure, viewing.viewingStructure(id));

        contentService.putInLibrary(id, new LibraryEntryRequest(UserContentStatus.PLANNED,
                null, false, null, null, null));
        flushAndClear();
        UserContent restored = library.findByUserIdAndContentId(1L, id).orElseThrow();
        assertNull(restored.getRating());
        assertFalse(restored.isFavorite());
        assertNull(restored.getPersonalNote());
    }

    @ParameterizedTest
    @EnumSource(BookFormat.class)
    void removingBookFromLibraryPreservesProgressSessionsAndStatistics(BookFormat format) {
        boolean audio = format == BookFormat.AUDIOBOOK;
        long id = books.create(new BookRequest("Book library removal regression test", "Author", format,
                audio ? null : 200, audio ? 200 : null, 2020, null, null, "Description")).id();
        books.putLibrary(id, new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,
                (short) 9, true, WATCHED, null, "Reading note"));
        books.putProgress(id, new BookProgressRequest(audio ? null : 50, audio ? 50 : null));
        books.addSession(id, new ReadingSessionRequest(WATCHED, 30, audio ? 0 : 20, audio ? 20 : 0, "Session"));
        var original = books.get(id);
        LocalDate day = LocalDate.of(2020,2,1);
        var statistics = analytics.get(day,day,false);
        var journal = timeline.get(day);
        assertEquals(1, original.sessions().size());
        // Removal is a separate request, with no managed progress/session entities from the edit form.
        flushAndClear();

        books.removeLibrary(id);
        flushAndClear();

        var removed = books.get(id);
        assertEquals(original.title(), removed.title());
        assertEquals(original.contentId(), removed.contentId());
        assertEquals(original.description(), removed.description());
        assertNull(removed.libraryEntryId());
        assertNull(removed.status());
        assertNull(removed.rating());
        assertFalse(removed.favorite());
        assertNull(removed.personalNote());
        assertNull(removed.startedAt());
        assertNull(removed.completedAt());
        assertEquals(original.currentPage(),removed.currentPage());
        assertEquals(original.currentMinute(),removed.currentMinute());
        assertEquals(original.progressPercent(),removed.progressPercent());
        assertEquals(original.sessions(),removed.sessions());
        assertEquals(removed,books.getAll().stream().filter(book -> book.id().equals(id)).findFirst().orElseThrow());
        assertEquals(statistics,analytics.get(day,day,false));
        assertEquals(journal,timeline.get(day));

        var restored = books.putLibrary(id, new LibraryEntryRequest(UserContentStatus.NOT_STARTED,
                null, false, null, null, null));
        assertNotEquals(original.libraryEntryId(),restored.libraryEntryId());
        assertEquals(original.currentPage(),restored.currentPage());
        assertEquals(original.currentMinute(),restored.currentMinute());
        assertEquals(original.sessions(),restored.sessions());

        // The generic library endpoint must preserve the same data as the book endpoint.
        contentService.removeFromLibrary(original.contentId());
        flushAndClear();
        assertEquals(original.sessions(),books.get(id).sessions());
        assertEquals(original.currentPage(),books.get(id).currentPage());
        var session = original.sessions().getFirst();
        books.updateSession(session.id(),new ReadingSessionRequest(WATCHED,35,audio?0:25,audio?25:0,"Corrected"));
        assertEquals(75,audio?books.get(id).currentMinute():books.get(id).currentPage());
        books.deleteSession(session.id());
        assertEquals(50,audio?books.get(id).currentMinute():books.get(id).currentPage());
    }

    @Test
    void clearingReadingHistoryIsAnExplicitSeparateActionAndKeepsOtherBooks() {
        long id = books.create(new BookRequest("Clear reading history test","Author",BookFormat.PAPER,
                200,null,2020,null,null,null)).id();
        long other = books.create(new BookRequest("Other book history test","Author",BookFormat.PAPER,
                200,null,2020,null,null,null)).id();
        for(long bookId : List.of(id,other)) {
            books.putLibrary(bookId,new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,(short)8,true,WATCHED,null,"Note"));
            books.addSession(bookId,new ReadingSessionRequest(WATCHED,30,20,0,"Session"));
        }
        var otherBefore = books.get(other);
        var cleared = books.clearReadingHistory(id);
        flushAndClear();

        assertTrue(cleared.sessions().isEmpty());
        assertEquals(0,cleared.currentPage());
        assertNotNull(cleared.libraryEntryId());
        assertEquals((short)8,cleared.rating());
        assertTrue(cleared.favorite());
        assertEquals("Note",cleared.personalNote());
        assertEquals(otherBefore,books.get(other));

        books.removeLibrary(other);
        flushAndClear();
        var outside = books.clearReadingHistory(other);
        assertNull(outside.libraryEntryId());
        assertNull(outside.currentPage());
        assertTrue(outside.sessions().isEmpty());
    }

    @Test
    void readingHistoryRemainsScopedToItsOwner() {
        long id = books.create(new BookRequest("Reading owner isolation test","Author",BookFormat.PAPER,
                200,null,2020,null,null,null)).id();
        books.putLibrary(id,new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,null,false,null,null,null));
        books.addSession(id,new ReadingSessionRequest(WATCHED,30,20,0,"Owner session"));
        User other = users.save(new User("reading_other_owner","Other",null,"Europe/Moscow"));
        var book = bookRepository.findById(id).orElseThrow();
        var progress = new BookProgress(other,book); progress.update(80,0); progressRepository.save(progress);
        var session = new ReadingSession(other,book); session.update(WATCHED,40,30,0,"Other owner");
        long otherSession = sessionsRepository.save(session).getId();
        flushAndClear();

        assertEquals(1,books.get(id).sessions().size());
        assertEquals(20,books.get(id).currentPage());
        assertThrows(ResourceNotFoundException.class,()->books.deleteSession(otherSession));
        books.clearReadingHistory(id);
        flushAndClear();

        assertEquals(80,progressRepository.findByUserIdAndBookId(other.getId(),id).orElseThrow().getCurrentPage());
        assertTrue(sessionsRepository.findByIdAndUserId(otherSession,other.getId()).isPresent());
    }

    @Test
    void deletingCatalogBookStillDeletesItsReadingHistory() {
        long id = books.create(new BookRequest("Delete reading history test","Author",BookFormat.PAPER,
                200,null,2020,null,null,null)).id();
        books.putLibrary(id,new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,null,false,null,null,null));
        long session = books.addSession(id,new ReadingSessionRequest(WATCHED,30,20,0,null)).id();
        books.removeLibrary(id);
        flushAndClear();
        books.delete(id);
        flushAndClear();

        assertThrows(ResourceNotFoundException.class,()->books.get(id));
        assertThrows(ResourceNotFoundException.class,()->books.deleteSession(session));
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }
}
