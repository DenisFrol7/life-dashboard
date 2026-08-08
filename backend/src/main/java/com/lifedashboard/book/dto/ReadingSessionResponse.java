package com.lifedashboard.book.dto;
import java.time.Instant;
public record ReadingSessionResponse(Long id,Instant startedAt,int durationMinutes,int pagesRead,int listenedMinutes,String note){}
