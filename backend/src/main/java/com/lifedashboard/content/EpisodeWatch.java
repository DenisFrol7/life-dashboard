package com.lifedashboard.content;
import com.lifedashboard.user.User; import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="episode_watch_history")
public class EpisodeWatch {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_id",nullable=false) private User user;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="episode_id",nullable=false) private ContentEpisode episode;
 @Column(name="watched_at",nullable=false) private Instant watchedAt;
 @Column(name="watch_number",nullable=false) private Integer watchNumber;
 @Column(name="is_bulk",nullable=false) private boolean bulk;
 protected EpisodeWatch(){} public EpisodeWatch(User u,ContentEpisode e,Instant w,Integer n){this(u,e,w,n,false);} public EpisodeWatch(User u,ContentEpisode e,Instant w,Integer n,boolean b){user=u;episode=e;watchedAt=w;watchNumber=n;bulk=b;}
 public Long getId(){return id;} public ContentEpisode getEpisode(){return episode;} public Instant getWatchedAt(){return watchedAt;} public Integer getWatchNumber(){return watchNumber;} public boolean isBulk(){return bulk;}
}
