package com.lifedashboard.book;

import com.lifedashboard.content.UserContent;
import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="reading_sessions")
public class ReadingSession {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_content_id",nullable=false) private UserContent userContent;
    @Column(name="started_at",nullable=false) private Instant startedAt;
    @Column(name="duration_minutes",nullable=false) private int durationMinutes;
    @Column(name="pages_read",nullable=false) private int pagesRead;
    @Column(columnDefinition="text") private String note;
    protected ReadingSession(){} public ReadingSession(UserContent userContent){this.userContent=userContent;}
    public void update(Instant startedAt,int durationMinutes,int pagesRead,String note){this.startedAt=startedAt;this.durationMinutes=durationMinutes;this.pagesRead=pagesRead;this.note=note;}
    public Long getId(){return id;} public UserContent getUserContent(){return userContent;} public Instant getStartedAt(){return startedAt;}
    public int getDurationMinutes(){return durationMinutes;} public int getPagesRead(){return pagesRead;} public String getNote(){return note;}
}
