package com.lifedashboard.content.dto; import java.time.Instant;
public record WatchResponse(Long id,Long targetId,Instant watchedAt,Integer watchNumber,boolean bulk){
 public WatchResponse(Long id,Long targetId,Instant watchedAt,Integer watchNumber){this(id,targetId,watchedAt,watchNumber,false);}
}
