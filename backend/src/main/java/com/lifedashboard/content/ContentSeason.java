package com.lifedashboard.content;
import jakarta.persistence.*;
@Entity @Table(name="content_seasons")
public class ContentSeason {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="content_id",nullable=false) private ContentItem content;
 @Column(name="season_number",nullable=false) private Integer seasonNumber;
 @Column(length=300) private String title;
 @Column(name="release_year") private Integer releaseYear;
 protected ContentSeason() {} public ContentSeason(ContentItem c){content=c;}
 public void update(Integer n,String t,Integer y){seasonNumber=n;title=t;releaseYear=y;}
 public Long getId(){return id;} public ContentItem getContent(){return content;} public Integer getSeasonNumber(){return seasonNumber;}
 public String getTitle(){return title;} public Integer getReleaseYear(){return releaseYear;}
}
