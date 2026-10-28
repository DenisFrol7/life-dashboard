package com.lifedashboard.book;

import com.lifedashboard.user.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="reading_sessions")
public class ReadingSession {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_id",nullable=false) private User user;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="book_id",nullable=false) private Book book;
    @Column(name="started_at",nullable=false) private Instant startedAt;
    @Column(name="duration_minutes",nullable=false) private int durationMinutes;
    @Column(name="pages_read",nullable=false) private int pagesRead;
    @Column(name="listened_minutes",nullable=false) private int listenedMinutes;
    @Column(columnDefinition="text") private String note;
    protected ReadingSession(){} public ReadingSession(User user,Book book){this.user=user;this.book=book;}
    public void update(Instant startedAt,int durationMinutes,int pagesRead,int listenedMinutes,String note){this.startedAt=startedAt;this.durationMinutes=durationMinutes;this.pagesRead=pagesRead;this.listenedMinutes=listenedMinutes;this.note=note;}
    public Long getId(){return id;} public User getUser(){return user;} public Book getBook(){return book;} public Instant getStartedAt(){return startedAt;}
    public int getDurationMinutes(){return durationMinutes;} public int getPagesRead(){return pagesRead;} public int getListenedMinutes(){return listenedMinutes;} public String getNote(){return note;}
}
