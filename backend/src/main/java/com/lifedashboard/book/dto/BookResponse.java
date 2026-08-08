package com.lifedashboard.book.dto;
import com.lifedashboard.book.BookFormat;
import com.lifedashboard.content.UserContentStatus;
import java.time.*;
import java.util.List;
public record BookResponse(Long id,Long contentId,String title,String author,BookFormat bookFormat,Integer pageCount,Integer durationMinutes,
        Integer releaseYear,String genre,String coverUrl,String description,Long libraryEntryId,UserContentStatus status,
        Short rating,boolean favorite,String personalNote,Instant startedAt,Instant completedAt,Integer currentPage,Integer currentMinute,
        double progressPercent,List<ReadingSessionResponse> sessions){}
