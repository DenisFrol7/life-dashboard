package com.lifedashboard.book;

import com.lifedashboard.book.dto.*;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.LibraryEntryRequest;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class BookServiceIntegrationTests {
    private static final String TITLE="Book integration test";
    @Autowired BookService service; @Autowired ContentItemRepository content;
    @BeforeEach void before(){cleanup();} @AfterEach void after(){cleanup();}
    @Test void supportsLibraryProgressAndReadingSessions(){
        var created=service.create(new BookRequest(TITLE,"Test Author",BookFormat.PAPER,400,2026,"Фантастика",null,null));
        var library=service.putLibrary(created.id(),new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,null,false,Instant.now(),null,null));
        assertNotNull(library.libraryEntryId());
        var progress=service.putProgress(created.id(),new BookProgressRequest(125));
        assertEquals(125,progress.currentPage());assertEquals(31.25,progress.progressPercent());
        service.addSession(created.id(),new ReadingSessionRequest(Instant.now(),45,30,"Chapter 1"));
        var result=service.get(created.id());assertEquals(1,result.sessions().size());assertEquals(30,result.sessions().getFirst().pagesRead());
    }
    private void cleanup(){content.findByTitle(TITLE).ifPresent(content::delete);}
}
