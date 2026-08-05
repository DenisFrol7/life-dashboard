package com.lifedashboard.content;
import com.lifedashboard.user.User; import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="movie_watch_history")
public class MovieWatch {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_id",nullable=false) private User user;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="content_id",nullable=false) private ContentItem content;
 @Column(name="watched_at",nullable=false) private Instant watchedAt; @Column(name="watch_number",nullable=false) private Integer watchNumber;
 protected MovieWatch(){} public MovieWatch(User u,ContentItem c,Instant w,Integer n){user=u;content=c;watchedAt=w;watchNumber=n;}
 public Long getId(){return id;} public Instant getWatchedAt(){return watchedAt;} public Integer getWatchNumber(){return watchNumber;}
}
