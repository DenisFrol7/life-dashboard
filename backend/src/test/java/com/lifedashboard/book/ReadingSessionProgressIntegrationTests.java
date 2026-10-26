package com.lifedashboard.book;

import com.lifedashboard.book.dto.*;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.ContentItemRepository;
import com.lifedashboard.content.UserContentStatus;
import com.lifedashboard.content.dto.LibraryEntryRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class ReadingSessionProgressIntegrationTests {
    private static final String TITLE = "Reading session progress regression test";
    private static final Instant STARTED = Instant.parse("2026-10-01T12:00:00Z");
    @Autowired BookService service;
    @Autowired ContentItemRepository content;

    @BeforeEach
    @AfterEach
    void cleanup() {
        content.findByTitle(TITLE).ifPresent(content::delete);
    }

    @ParameterizedTest
    @EnumSource(BookFormat.class)
    void rejectsExcessSessionWithoutChangingProgressOrHistory(BookFormat format) {
        long id = createBook(format, 90);
        var before = service.get(id);

        var error = assertThrows(InvalidRequestException.class,
                () -> service.addSession(id, session(format, 20, "Too much")));

        assertTrue(error.getMessage().contains(format == BookFormat.AUDIOBOOK ? "аудиокниги" : "страниц"));
        assertEquals(before, service.get(id));
    }

    @ParameterizedTest
    @EnumSource(BookFormat.class)
    void rejectsExcessEditWithoutChangingStoredSessionOrProgress(BookFormat format) {
        long id = createBook(format, 90);
        long sessionId = service.addSession(id, session(format, 5, "Original note")).id();
        var before = service.get(id);

        assertThrows(InvalidRequestException.class,
                () -> service.updateSession(sessionId, session(format, 20, "Rejected note")));

        assertEquals(before, service.get(id));
        service.deleteSession(sessionId);
        assertProgress(id, format, 90);
    }

    @ParameterizedTest
    @EnumSource(BookFormat.class)
    void exactFinishCanBeEditedAndDeletedWithoutLosingProgress(BookFormat format) {
        long id = createBook(format, 90);
        long sessionId = service.addSession(id, session(format, 10, "Finished")).id();
        assertProgress(id, format, 100);

        service.updateSession(sessionId, session(format, 10, "Only changing the note"));
        assertProgress(id, format, 100);
        assertEquals("Only changing the note", service.get(id).sessions().getFirst().note());

        service.updateSession(sessionId, session(format, 5, "Read less"));
        assertProgress(id, format, 95);
        service.updateSession(sessionId, session(format, 10, "Finished again"));
        assertProgress(id, format, 100);

        service.deleteSession(sessionId);
        assertProgress(id, format, 90);
        assertTrue(service.get(id).sessions().isEmpty());
    }

    @ParameterizedTest
    @EnumSource(BookFormat.class)
    void finishedBookRejectsMoreProgressButAllowsTimeOnlySession(BookFormat format) {
        long id = createBook(format, 100);
        var before = service.get(id);

        assertThrows(InvalidRequestException.class,
                () -> service.addSession(id, session(format, 1, "Beyond the end")));
        assertEquals(before, service.get(id));

        long sessionId = service.addSession(id, session(format, 0, "Time only")).id();
        assertProgress(id, format, 100);
        service.deleteSession(sessionId);
        assertEquals(before, service.get(id));
    }

    @ParameterizedTest
    @EnumSource(BookFormat.class)
    void largeSessionCannotOverflowAndResetProgress(BookFormat format) {
        long id = createBook(format, 90);
        var before = service.get(id);

        assertThrows(InvalidRequestException.class,
                () -> service.addSession(id, session(format, Integer.MAX_VALUE, "Overflow")));

        assertEquals(before, service.get(id));
    }

    private long createBook(BookFormat format, int current) {
        boolean audio = format == BookFormat.AUDIOBOOK;
        long id = service.create(new BookRequest(TITLE, "Test Author", format,
                audio ? null : 100, audio ? 100 : null, 2026, null, null, null)).id();
        service.putLibrary(id, new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,
                null, false, STARTED, null, null));
        service.putProgress(id, new BookProgressRequest(audio ? null : current, audio ? current : null));
        return id;
    }

    private ReadingSessionRequest session(BookFormat format, int amount, String note) {
        boolean audio = format == BookFormat.AUDIOBOOK;
        return new ReadingSessionRequest(STARTED, 30, audio ? 0 : amount, audio ? amount : 0, note);
    }

    private void assertProgress(long id, BookFormat format, int expected) {
        var book = service.get(id);
        assertEquals(expected, format == BookFormat.AUDIOBOOK ? book.currentMinute() : book.currentPage());
        assertEquals((double) expected, book.progressPercent());
    }
}
