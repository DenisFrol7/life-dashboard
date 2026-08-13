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
        var created=service.create(new BookRequest(TITLE,"Test Author",BookFormat.PAPER,400,null,2026,"Фантастика",null,null));
        var library=service.putLibrary(created.id(),new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,null,false,Instant.now(),null,null));
        assertNotNull(library.libraryEntryId());
        var progress=service.putProgress(created.id(),new BookProgressRequest(125,null));
        assertEquals(125,progress.currentPage());assertEquals(31.25,progress.progressPercent());
        var session=service.addSession(created.id(),new ReadingSessionRequest(Instant.now(),45,30,0,"Chapter 1"));
        var result=service.get(created.id());assertEquals(1,result.sessions().size());assertEquals(30,result.sessions().getFirst().pagesRead());assertEquals(155,result.currentPage());
        service.updateSession(session.id(),new ReadingSessionRequest(Instant.now(),50,40,0,"Chapter 1 updated"));
        assertEquals(165,service.get(created.id()).currentPage());
        service.deleteSession(session.id());
        assertEquals(125,service.get(created.id()).currentPage());
    }
    @Test void supportsAudiobookMinuteProgress(){
        var created=service.create(new BookRequest(TITLE,"Test Author",BookFormat.AUDIOBOOK,null,600,2026,"Audiobook",null,null));
        service.putLibrary(created.id(),new LibraryEntryRequest(UserContentStatus.IN_PROGRESS,null,false,Instant.now(),null,null));
        var progress=service.putProgress(created.id(),new BookProgressRequest(null,100));
        assertEquals(100,progress.currentMinute());
        var session=service.addSession(created.id(),new ReadingSessionRequest(Instant.now(),45,0,45,"Listened"));
        assertEquals(145,service.get(created.id()).currentMinute());
        service.updateSession(session.id(),new ReadingSessionRequest(Instant.now(),60,0,60,"Listened more"));
        assertEquals(160,service.get(created.id()).currentMinute());
        service.deleteSession(session.id());
        assertEquals(100,service.get(created.id()).currentMinute());
    }
    @Test void completedPaperBookStartsWithFullProgress(){
        var created=service.create(new BookRequest(TITLE,"Test Author",BookFormat.PAPER,230,null,2026,"Novel",null,null));
        var result=service.putLibrary(created.id(),new LibraryEntryRequest(UserContentStatus.COMPLETED,null,false,null,Instant.now(),null));
        assertEquals(230,result.currentPage());
        assertEquals(100.0,result.progressPercent());
    }
    @Test void completedAudiobookStartsWithFullProgress(){
        var created=service.create(new BookRequest(TITLE,"Test Author",BookFormat.AUDIOBOOK,null,480,2026,"Audiobook",null,null));
        var result=service.putLibrary(created.id(),new LibraryEntryRequest(UserContentStatus.COMPLETED,null,false,null,Instant.now(),null));
        assertEquals(480,result.currentMinute());
        assertEquals(100.0,result.progressPercent());
    }
    private void cleanup(){content.findByTitle(TITLE).ifPresent(content::delete);}
}
