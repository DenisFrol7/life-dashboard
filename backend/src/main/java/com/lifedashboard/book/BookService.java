package com.lifedashboard.book;

import com.lifedashboard.book.dto.*;
import com.lifedashboard.common.error.*;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.*;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class BookService {
    private final BookRepository books;
    private final BookProgressRepository progress;
    private final ReadingSessionRepository sessions;
    private final ContentItemRepository contentItems;
    private final UserContentRepository library;
    private final ContentService contentService;
    private final long userId;

    public BookService(BookRepository books, BookProgressRepository progress, ReadingSessionRepository sessions,
            ContentItemRepository contentItems, UserContentRepository library, ContentService contentService,
            @Value("${app.default-user-id}") long userId) {
        this.books=books; this.progress=progress; this.sessions=sessions; this.contentItems=contentItems;
        this.library=library; this.contentService=contentService; this.userId=userId;
    }

    public List<BookResponse> getAll() {
        Map<Long,UserContent> libraryByContent=new HashMap<>();
        for(UserContent entry:library.findAllByUserIdOrderByIdDesc(userId))
            libraryByContent.put(entry.getContent().getId(),entry);
        Map<Long,BookProgress> progressByLibrary=new HashMap<>();
        for(BookProgress value:progress.findAllByUserContentUserId(userId))
            progressByLibrary.put(value.getUserContent().getId(),value);
        Map<Long,List<ReadingSession>> sessionsByLibrary=new HashMap<>();
        for(ReadingSession session:sessions.findAllByUserContentUserIdOrderByStartedAtDesc(userId))
            sessionsByLibrary.computeIfAbsent(session.getUserContent().getId(),ignored->new ArrayList<>()).add(session);
        return books.findCatalog().stream().map((@NonNull Book book)->{
            UserContent entry=libraryByContent.get(book.getContent().getId());
            BookProgress current=entry==null?null:progressByLibrary.get(entry.getId());
            List<ReadingSession> history=entry==null?List.of():sessionsByLibrary.getOrDefault(entry.getId(),List.of());
            return response(book,entry,current,history);
        }).toList();
    }
    public BookResponse get(Long id) { return response(find(id)); }

    @Transactional public BookResponse create(BookRequest request) {
        validateBook(request);
        var content=contentService.create(contentRequest(request));
        Book book=new Book(contentItems.findById(content.id()).orElseThrow()); apply(book,request);
        return response(books.save(book));
    }
    @Transactional public BookResponse update(Long id,BookRequest request) {
        validateBook(request); Book book=find(id);
        contentService.update(book.getContent().getId(),contentRequest(request)); apply(book,request);
        return response(book);
    }
    @Transactional public void delete(Long id) { contentService.delete(find(id).getContent().getId()); }
    @Transactional public BookResponse putLibrary(Long id,LibraryEntryRequest request) {
        Book book=find(id); contentService.putInLibrary(book.getContent().getId(),request);
        if(request.status()==UserContentStatus.COMPLETED) completeProgress(book,findLibrary(book));
        return response(book);
    }
    @Transactional public BookResponse removeLibrary(Long id) {
        Book book=find(id); contentService.removeFromLibrary(book.getContent().getId()); return response(book);
    }
    @Transactional public BookResponse putProgress(Long id,BookProgressRequest request) {
        Book book=find(id); UserContent entry=findLibrary(book); BookProgress value=findProgress(entry);
        if(book.getBookFormat()==BookFormat.AUDIOBOOK) {
            int minute=request.currentMinute()==null?0:request.currentMinute();
            if(minute>book.getDurationMinutes()) throw new InvalidRequestException("currentMinute must not exceed durationMinutes");
            value.update(0,minute);
        } else {
            int page=request.currentPage()==null?0:request.currentPage();
            if(page>book.getPageCount()) throw new InvalidRequestException("currentPage must not exceed pageCount");
            value.update(page,0);
        }
        progress.save(value); return response(book);
    }
    @Transactional public ReadingSessionResponse addSession(Long id,ReadingSessionRequest request) {
        Book book=find(id); validateSession(book,request); UserContent entry=findLibrary(book);
        ReadingSession value=new ReadingSession(entry); apply(value,request); sessions.save(value);
        adjustProgress(book,entry,request.pagesRead(),request.listenedMinutes()); return sessionResponse(value);
    }
    @Transactional public ReadingSessionResponse updateSession(Long sessionId,ReadingSessionRequest request) {
        ReadingSession value=findSession(sessionId); Book book=findByContent(value.getUserContent().getContent().getId()); validateSession(book,request);
        int pageDelta=request.pagesRead()-value.getPagesRead(); int minuteDelta=request.listenedMinutes()-value.getListenedMinutes();
        apply(value,request); adjustProgress(book,value.getUserContent(),pageDelta,minuteDelta); return sessionResponse(value);
    }
    @Transactional public void deleteSession(Long sessionId) {
        ReadingSession value=findSession(sessionId); Book book=findByContent(value.getUserContent().getContent().getId());
        adjustProgress(book,value.getUserContent(),-value.getPagesRead(),-value.getListenedMinutes()); sessions.delete(value);
    }

    private void adjustProgress(Book book,UserContent entry,int pageDelta,int minuteDelta) {
        BookProgress value=findProgress(entry);
        int page=book.getBookFormat()==BookFormat.AUDIOBOOK?0:Math.max(0,Math.min(book.getPageCount(),value.getCurrentPage()+pageDelta));
        int minute=book.getBookFormat()==BookFormat.AUDIOBOOK?Math.max(0,Math.min(book.getDurationMinutes(),value.getCurrentMinute()+minuteDelta)):0;
        value.update(page,minute); progress.save(value);
    }
    private void completeProgress(Book book,UserContent entry) {
        BookProgress value=findProgress(entry);
        if(book.getBookFormat()==BookFormat.AUDIOBOOK) value.update(0,book.getDurationMinutes());
        else value.update(book.getPageCount(),0);
        progress.save(value);
    }
    private BookProgress findProgress(UserContent entry) { return progress.findByUserContentId(entry.getId()).orElseGet(() -> new BookProgress(entry)); }
    private ReadingSession findSession(Long id) { return sessions.findByIdAndUserContentUserId(id,userId)
            .orElseThrow(() -> new ResourceNotFoundException("Reading session with id "+id+" was not found")); }
    private Book find(Long id) { return books.findById(id).orElseThrow(() -> new ResourceNotFoundException("Book with id "+id+" was not found")); }
    private Book findByContent(Long contentId) { return books.findByContentId(contentId).orElseThrow(); }
    private UserContent findLibrary(Book book) { return library.findByUserIdAndContentId(userId,book.getContent().getId())
            .orElseThrow(() -> new InvalidRequestException("Book must be in the library")); }
    private void validateBook(BookRequest request) {
        boolean audio=request.bookFormat()==BookFormat.AUDIOBOOK;
        if(audio&&(request.durationMinutes()==null||request.pageCount()!=null)) throw new InvalidRequestException("Audiobook requires durationMinutes and must not have pageCount");
        if(!audio&&(request.pageCount()==null||request.durationMinutes()!=null)) throw new InvalidRequestException("Paper and electronic books require pageCount and must not have durationMinutes");
    }
    private void validateSession(Book book,ReadingSessionRequest request) {
        if(book.getBookFormat()==BookFormat.AUDIOBOOK&&request.pagesRead()!=0) throw new InvalidRequestException("Audiobook session must not contain pagesRead");
        if(book.getBookFormat()!=BookFormat.AUDIOBOOK&&request.listenedMinutes()!=0) throw new InvalidRequestException("Reading session must not contain listenedMinutes");
    }
    private void apply(Book book,BookRequest request) { book.update(request.author().trim(),request.bookFormat(),request.pageCount(),request.durationMinutes()); }
    private void apply(ReadingSession value,ReadingSessionRequest request) { value.update(request.startedAt(),request.durationMinutes(),request.pagesRead(),request.listenedMinutes(),normalize(request.note())); }
    private ContentItemRequest contentRequest(BookRequest r) { return new ContentItemRequest(r.title(),null,ContentType.BOOK,null,r.releaseYear(),r.description(),r.coverUrl(),null,ReleaseStatus.RELEASED,r.genre(),null,null,false); }
    private String normalize(String value) { return value==null||value.isBlank()?null:value.trim(); }
    private BookResponse response(Book book) {
        UserContent entry=library.findByUserIdAndContentId(userId,book.getContent().getId()).orElse(null);
        BookProgress current=entry==null?null:progress.findByUserContentId(entry.getId()).orElse(null);
        List<ReadingSession> history=entry==null?List.of():sessions.findAllByUserContentIdOrderByStartedAtDesc(entry.getId());
        return response(book,entry,current,history);
    }
    private BookResponse response(Book book,UserContent entry,BookProgress current,List<ReadingSession> history) {
        int page=current==null?0:current.getCurrentPage(), minute=current==null?0:current.getCurrentMinute();
        int value=book.getBookFormat()==BookFormat.AUDIOBOOK?minute:page;
        int total=book.getBookFormat()==BookFormat.AUDIOBOOK?book.getDurationMinutes():book.getPageCount();
        double percent=Math.round(value*10000.0/total)/100.0;
        List<ReadingSessionResponse> sessionHistory=history.stream()
                .map((@NonNull ReadingSession session)->sessionResponse(session)).toList();
        ContentItem c=book.getContent();
        return new BookResponse(book.getId(),c.getId(),c.getTitle(),book.getAuthor(),book.getBookFormat(),book.getPageCount(),book.getDurationMinutes(),c.getReleaseYear(),c.getGenre(),c.getCoverUrl(),c.getDescription(),entry==null?null:entry.getId(),entry==null?null:entry.getStatus(),entry==null?null:entry.getRating(),entry!=null&&entry.isFavorite(),entry==null?null:entry.getPersonalNote(),entry==null?null:entry.getStartedAt(),entry==null?null:entry.getCompletedAt(),entry==null?null:page,entry==null?null:minute,percent,sessionHistory);
    }
    private ReadingSessionResponse sessionResponse(ReadingSession value) { return new ReadingSessionResponse(value.getId(),value.getStartedAt(),value.getDurationMinutes(),value.getPagesRead(),value.getListenedMinutes(),value.getNote()); }
}
