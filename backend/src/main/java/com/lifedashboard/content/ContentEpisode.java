package com.lifedashboard.content;
import jakarta.persistence.*; import java.time.LocalDate;
@Entity @Table(name="content_episodes")
public class ContentEpisode {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="season_id",nullable=false) private ContentSeason season;
 @Column(name="episode_number",nullable=false) private Integer episodeNumber;
 @Column(nullable=false,length=300) private String title;
 @Column(name="duration_minutes") private Integer durationMinutes;
 @Column(name="release_date") private LocalDate releaseDate;
 protected ContentEpisode(){} public ContentEpisode(ContentSeason s){season=s;}
 public void update(Integer n,String t,Integer d,LocalDate r){episodeNumber=n;title=t;durationMinutes=d;releaseDate=r;}
 public Long getId(){return id;} public ContentSeason getSeason(){return season;} public Integer getEpisodeNumber(){return episodeNumber;}
 public String getTitle(){return title;} public Integer getDurationMinutes(){return durationMinutes;} public LocalDate getReleaseDate(){return releaseDate;}
}
