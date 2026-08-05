package com.lifedashboard.content.dto; import java.time.Instant;
public record WatchResponse(Long id,Long targetId,Instant watchedAt,Integer watchNumber){}
