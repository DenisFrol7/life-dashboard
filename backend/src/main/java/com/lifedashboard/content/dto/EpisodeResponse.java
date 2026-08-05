package com.lifedashboard.content.dto; import java.time.LocalDate;
public record EpisodeResponse(Long id,Long seasonId,Integer episodeNumber,String title,Integer durationMinutes,LocalDate releaseDate){}
