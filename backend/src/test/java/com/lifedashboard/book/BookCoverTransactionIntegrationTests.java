package com.lifedashboard.book;

import com.lifedashboard.book.dto.BookRequest;
import com.lifedashboard.book.dto.BookResponse;
import com.lifedashboard.content.ContentItemRepository;
import com.lifedashboard.content.ContentService;
import com.lifedashboard.content.UserContentRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
class BookCoverTransactionIntegrationTests {
    private static final String REMOTE = "https://covers.example.invalid/book.png";
    private static final byte[] PNG = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};

    @TempDir Path directory;
    @Autowired BookRepository books;
    @Autowired BookProgressRepository progress;
    @Autowired ReadingSessionRepository sessions;
    @Autowired ContentItemRepository content;
    @Autowired UserContentRepository library;
    @Autowired ContentService contentService;
    @Autowired PlatformTransactionManager transactionManager;

    private final Set<Long> createdContent = new HashSet<>();
    private final AtomicReference<String> downloaded = new AtomicReference<>();
    private TransactionTemplate transaction;
    private BookCoverStorage storage;
    private BookService service;

    @BeforeEach
    void setUp() {
        transaction = new TransactionTemplate(transactionManager);
        storage = spy(new BookCoverStorage(directory.toString()));
        BookCoverCleanup cleanup = new BookCoverCleanup(storage, content, transactionManager);
        service = new BookService(books, progress, sessions, content, library, contentService, storage, cleanup, 1L);
        // Replace only the remote download; the actual file write and transaction callbacks remain real.
        doAnswer(invocation -> {
            String url = upload();
            downloaded.set(url);
            return url;
        }).when(storage).localize(REMOTE);
    }

    @AfterEach
    void cleanCommittedFixtures() {
        transaction.executeWithoutResult(status -> content.deleteAllById(createdContent));
    }

    @Test
    void replacementRemovesOldFileOnlyAfterCommit() {
        String oldCover = upload();
        String newCover = upload();
        BookResponse book = create(oldCover);

        transaction.executeWithoutResult(status -> {
            service.update(book.id(), request(newCover));
            assertTrue(exists(oldCover), "The old cover must exist until the transaction commits");
            assertTrue(exists(newCover));
        });

        assertFalse(exists(oldCover));
        assertTrue(exists(newCover));
        assertEquals(newCover, read(book.id()).coverUrl());
    }

    @Test
    void clearingCoverWaitsForCommit() {
        String oldCover = upload();
        BookResponse book = create(oldCover);

        transaction.executeWithoutResult(status -> {
            service.update(book.id(), request(null));
            assertTrue(exists(oldCover));
        });

        assertFalse(exists(oldCover));
        assertNull(read(book.id()).coverUrl());
    }

    @Test
    void rollbackKeepsOldCoverAndEarlierUpload() {
        String oldCover = upload();
        String earlierUpload = upload();
        BookResponse book = create(oldCover);

        transaction.executeWithoutResult(status -> {
            service.update(book.id(), request(earlierUpload));
            status.setRollbackOnly();
        });

        assertTrue(exists(oldCover));
        assertTrue(exists(earlierUpload), "An upload from an earlier request does not belong to this transaction");
        assertEquals(book, read(book.id()));
    }

    @Test
    void databaseCommitFailureKeepsOldCoverAndRemovesNewDownload() {
        String oldCover = upload();
        BookResponse book = create(oldCover);

        assertThrows(DataIntegrityViolationException.class, () -> transaction.executeWithoutResult(status -> {
            service.update(book.id(), request(REMOTE));
            // Fail at commit, after update() has returned and registered file cleanup.
            books.findById(book.id()).orElseThrow().update("a".repeat(301), BookFormat.PAPER,
                    100, null, null, null);
        }));

        assertNotNull(downloaded.get());
        assertTrue(exists(oldCover));
        assertFalse(exists(downloaded.get()));
        assertEquals(book, read(book.id()));
    }

    @Test
    void deletionRemovesCoverOnlyAfterCommit() {
        String cover = upload();
        BookResponse book = create(cover);

        transaction.executeWithoutResult(status -> {
            service.delete(book.id());
            assertTrue(exists(cover));
        });

        assertFalse(exists(cover));
        assertFalse(books.existsById(book.id()));
    }

    @Test
    void deletionRollbackRestoresBookWithItsCover() {
        String cover = upload();
        BookResponse book = create(cover);

        transaction.executeWithoutResult(status -> {
            service.delete(book.id());
            status.setRollbackOnly();
        });

        assertTrue(exists(cover));
        assertEquals(book, read(book.id()));
    }

    @Test
    void sharedCoverSurvivesUntilLastBookStopsUsingIt() {
        String shared = upload();
        BookResponse first = create(shared);
        BookResponse second = create(shared);
        String replacement = upload();

        transaction.executeWithoutResult(status -> service.update(first.id(), request(replacement)));

        assertTrue(exists(shared));
        assertEquals(shared, read(second.id()).coverUrl());
        transaction.executeWithoutResult(status -> service.delete(second.id()));

        assertFalse(exists(shared));
        assertTrue(exists(replacement));
        assertEquals(replacement, read(first.id()).coverUrl());
    }

    @Test
    void switchingBackWithinOneTransactionKeepsFinalCover() {
        String original = upload();
        String intermediate = upload();
        BookResponse book = create(original);

        transaction.executeWithoutResult(status -> {
            service.update(book.id(), request(intermediate));
            service.update(book.id(), request(original));
        });

        assertTrue(exists(original));
        assertFalse(exists(intermediate));
        assertEquals(original, read(book.id()).coverUrl());
    }

    @Test
    void newBookDownloadIsRemovedOnRollback() {
        transaction.executeWithoutResult(status -> {
            service.create(request(REMOTE));
            status.setRollbackOnly();
        });

        assertNotNull(downloaded.get());
        assertFalse(exists(downloaded.get()));
    }

    @Test
    void newBookDownloadSurvivesCommit() {
        BookResponse book = create(REMOTE);

        assertNotNull(downloaded.get());
        assertTrue(exists(downloaded.get()));
        assertEquals(downloaded.get(), read(book.id()).coverUrl());
    }

    @Test
    void cleanupFailureKeepsFileWithoutFailingCommittedBookChange() {
        String oldCover = upload();
        String newCover = upload();
        BookResponse book = create(oldCover);
        ContentItemRepository unavailableLookup = mock(ContentItemRepository.class);
        when(unavailableLookup.existsByCoverUrl(oldCover))
                .thenThrow(new DataAccessResourceFailureException("Simulated cleanup query failure"));
        BookCoverCleanup cleanup = new BookCoverCleanup(storage, unavailableLookup, transactionManager);
        service = new BookService(books, progress, sessions, content, library, contentService, storage, cleanup, 1L);

        assertDoesNotThrow(() -> transaction.executeWithoutResult(status -> service.update(book.id(), request(newCover))));

        assertTrue(exists(oldCover));
        assertTrue(exists(newCover));
        assertEquals(newCover, read(book.id()).coverUrl());
        verify(unavailableLookup).existsByCoverUrl(oldCover);
    }

    private BookResponse create(String cover) {
        BookResponse book = transaction.execute(status -> service.create(request(cover)));
        assertNotNull(book);
        createdContent.add(book.contentId());
        return book;
    }

    private BookResponse read(long id) {
        return transaction.execute(status -> service.get(id));
    }

    private BookRequest request(String cover) {
        return new BookRequest("Cover transaction " + UUID.randomUUID(), "Test Author",
                BookFormat.PAPER, 100, null, 2020, null, cover, null);
    }

    private String upload() {
        return storage.store(new MockMultipartFile("file", "cover.png", "image/png", PNG));
    }

    private boolean exists(String url) {
        return Files.isRegularFile(directory.resolve(url.substring(url.lastIndexOf('/') + 1)));
    }
}
