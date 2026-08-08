package com.lifedashboard.book;

import com.lifedashboard.book.dto.*;
import com.lifedashboard.common.error.*;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.jspecify.annotations.NonNull;
import java.util.List;

@Service @Transactional(readOnly=true)
public class BookService {
    private final BookRepository books; private final BookProgressRepository progress; private final ReadingSessionRepository sessions;
    private final ContentItemRepository contentItems; private final UserContentRepository library; private final ContentService contentService; private final long userId;
    public BookService(BookRepository books,BookProgressRepository progress,ReadingSessionRepository sessions,
            ContentItemRepository contentItems,UserContentRepository library,ContentService contentService,
            @Value("${app.default-user-id}") long userId){this.books=books;this.progress=progress;this.sessions=sessions;this.contentItems=contentItems;this.library=library;this.contentService=contentService;this.userId=userId;}
    public List<BookResponse> getAll(){return books.findCatalog().stream().map((@NonNull Book book)->response(book)).toList();}
    public BookResponse get(Long id){return response(find(id));}
    @Transactional public BookResponse create(BookRequest request){
        var content=contentService.create(contentRequest(request)); Book book=new Book(contentItems.findById(content.id()).orElseThrow()); apply(book,request); return response(books.save(book));
    }
    @Transactional public BookResponse update(Long id,BookRequest request){Book book=find(id);contentService.update(book.getContent().getId(),contentRequest(request));apply(book,request);return response(book);}
    @Transactional public void delete(Long id){contentService.delete(find(id).getContent().getId());}
    @Transactional public BookResponse putLibrary(Long id,LibraryEntryRequest request){Book book=find(id);contentService.putInLibrary(book.getContent().getId(),request);return response(book);}
    @Transactional public BookResponse removeLibrary(Long id){Book book=find(id);contentService.removeFromLibrary(book.getContent().getId());return response(book);}
    @Transactional public BookResponse putProgress(Long id,BookProgressRequest request){Book book=find(id);UserContent entry=findLibrary(book);if(book.getPageCount()!=null&&request.currentPage()>book.getPageCount())throw new InvalidRequestException("currentPage must not exceed pageCount");BookProgress value=progress.findByUserContentId(entry.getId()).orElseGet(()->new BookProgress(entry));value.update(request.currentPage());progress.save(value);return response(book);}
    @Transactional public ReadingSessionResponse addSession(Long id,ReadingSessionRequest request){Book book=find(id);UserContent entry=findLibrary(book);ReadingSession value=new ReadingSession(entry);value.update(request.startedAt(),request.durationMinutes(),request.pagesRead(),normalize(request.note()));return sessionResponse(sessions.save(value));}
    private Book find(Long id){return books.findById(id).orElseThrow(()->new ResourceNotFoundException("Book with id "+id+" was not found"));}
    private UserContent findLibrary(Book book){return library.findByUserIdAndContentId(userId,book.getContent().getId()).orElseThrow(()->new InvalidRequestException("Book must be in the library"));}
    private void apply(Book book,BookRequest request){book.update(request.author().trim(),request.bookFormat(),request.pageCount());}
    private ContentItemRequest contentRequest(BookRequest r){return new ContentItemRequest(r.title(),null,ContentType.BOOK,null,r.releaseYear(),r.description(),r.coverUrl(),null,ReleaseStatus.RELEASED,r.genre(),null,null,false);}
    private String normalize(String value){return value==null||value.isBlank()?null:value.trim();}
    private BookResponse response(Book book){UserContent entry=library.findByUserIdAndContentId(userId,book.getContent().getId()).orElse(null);BookProgress current=entry==null?null:progress.findByUserContentId(entry.getId()).orElse(null);int page=current==null?0:current.getCurrentPage();double percent=book.getPageCount()==null?0.0:Math.round(page*10000.0/book.getPageCount())/100.0;List<ReadingSessionResponse> history=entry==null?List.of():sessions.findAllByUserContentIdOrderByStartedAtDesc(entry.getId()).stream().map((@NonNull ReadingSession session)->sessionResponse(session)).toList();ContentItem c=book.getContent();return new BookResponse(book.getId(),c.getId(),c.getTitle(),book.getAuthor(),book.getBookFormat(),book.getPageCount(),c.getReleaseYear(),c.getGenre(),c.getCoverUrl(),c.getDescription(),entry==null?null:entry.getId(),entry==null?null:entry.getStatus(),entry==null?null:entry.getRating(),entry!=null&&entry.isFavorite(),entry==null?null:entry.getPersonalNote(),entry==null?null:entry.getStartedAt(),entry==null?null:entry.getCompletedAt(),entry==null?null:page,percent,history);}
    private ReadingSessionResponse sessionResponse(ReadingSession value){return new ReadingSessionResponse(value.getId(),value.getStartedAt(),value.getDurationMinutes(),value.getPagesRead(),value.getNote());}
}
